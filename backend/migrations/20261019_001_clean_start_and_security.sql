-- ====================================================================
-- NEUROSCAN AI — CLEAN START & SECURITY MIGRATION
-- Migration Version: 20261019_001_clean_start_and_security.sql
-- Description:
--   1. Clean legacy application records in strict dependency order
--   2. Establish Supabase Auth to public.users auto-sync trigger
--   3. Apply role protection triggers (disallow self-assignment of Doctor/Admin)
--   4. Enable RLS and apply granular security policies across 15 public tables
--   5. Maintain AI model & system catalog integrity
-- ====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- STEP 1: REMOVE OLD APPLICATION DATA (STRICT DEPENDENCY-AWARE ORDER)
-- --------------------------------------------------------------------
DELETE FROM public.chat_history;
DELETE FROM public.chat_sessions;
DELETE FROM public.doctor_notes;
DELETE FROM public.appointments;
DELETE FROM public.prescriptions;
DELETE FROM public.reports;
DELETE FROM public.analysis_results;
DELETE FROM public.analysis_history;
DELETE FROM public.refresh_tokens;
DELETE FROM public.audit_logs;
DELETE FROM public.user_settings;
DELETE FROM public.scans;
DELETE FROM public.doctor_patient_assignments;
DELETE FROM public.patient_profiles;
DELETE FROM public.users;

-- --------------------------------------------------------------------
-- STEP 2: HELPER FUNCTIONS FOR ROLE-BASED ACCESS CONTROL
-- --------------------------------------------------------------------

-- Check if current authenticated user has Admin role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'Admin' AND is_active = TRUE
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

-- Check if current authenticated user is an active assigned doctor for a patient
CREATE OR REPLACE FUNCTION public.is_assigned_doctor_for_patient(target_patient_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.doctor_patient_assignments
    WHERE doctor_id = auth.uid()
      AND patient_id = target_patient_id
      AND status = 'Active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

-- --------------------------------------------------------------------
-- STEP 3: AUTH.USERS -> PUBLIC.USERS PROFILE SYNC TRIGGER
-- --------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (
    id,
    name,
    full_name,
    email,
    role,
    is_active,
    join_date,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'User', -- Strictly enforce Patient/User role on public registration
    TRUE,
    NOW(),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW();

  INSERT INTO public.patient_profiles (
    user_id,
    patient_id,
    full_name,
    email,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    'NSA-' || UPPER(SUBSTRING(MD5(NEW.id::text) FROM 1 FOR 6)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- --------------------------------------------------------------------
-- STEP 4: ROLE ELEVATION PROTECTION TRIGGER
-- --------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.protect_user_role()
RETURNS trigger AS $$
DECLARE
  claims_raw text;
  jwt_role text := '';
  is_authorized boolean := FALSE;
BEGIN
  -- Only evaluate if role or active status is being changed
  IF (NEW.role IS DISTINCT FROM OLD.role) OR (NEW.is_active IS DISTINCT FROM OLD.is_active) THEN
    -- Check 1: Direct database connection as superuser/postgres (e.g. backend psycopg2 direct connection)
    IF session_user = 'postgres' OR session_user = 'supabase_admin' THEN
      is_authorized := TRUE;
    END IF;

    -- Check 2: PostgREST request using verified service_role key
    IF NOT is_authorized THEN
      BEGIN
        claims_raw := current_setting('request.jwt.claims', true);
        IF claims_raw IS NOT NULL AND claims_raw <> '' THEN
          jwt_role := COALESCE(claims_raw::jsonb->>'role', '');
          IF jwt_role = 'service_role' THEN
            is_authorized := TRUE;
          END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        is_authorized := FALSE;
      END;
    END IF;

    -- Fail-closed: Reject any request that did not conclusively prove service_role or postgres credentials
    IF NOT is_authorized THEN
      RAISE EXCEPTION 'Unauthorized: Modification of role or account status is restricted to administrators.';
    END IF;
  END IF;

  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_protect_user_role ON public.users;
CREATE TRIGGER trg_protect_user_role
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.protect_user_role();

-- --------------------------------------------------------------------
-- STEP 5: ROW-LEVEL SECURITY ENFORCEMENT & POLICIES
-- --------------------------------------------------------------------

-- 1. public.users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_select_self" ON public.users;
CREATE POLICY "users_select_self" ON public.users FOR SELECT
  USING (id = auth.uid() OR public.is_admin() OR public.is_assigned_doctor_for_patient(id));

DROP POLICY IF EXISTS "users_update_self" ON public.users;
CREATE POLICY "users_update_self" ON public.users FOR UPDATE
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());
  -- Note: Role and account status immutability is strictly enforced by the trg_protect_user_role trigger function,
  -- avoiding recursive subqueries on public.users during policy evaluation.

-- 2. public.scans
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scans_select" ON public.scans;
CREATE POLICY "scans_select" ON public.scans FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_admin()
    OR public.is_assigned_doctor_for_patient(user_id)
    OR reviewed_by = auth.uid()
  );

DROP POLICY IF EXISTS "scans_insert" ON public.scans;
CREATE POLICY "scans_insert" ON public.scans FOR INSERT
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- 3. public.analysis_results
ALTER TABLE public.analysis_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "analysis_results_select" ON public.analysis_results;
CREATE POLICY "analysis_results_select" ON public.analysis_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.scans s
      WHERE s.id = scan_id AND (
        s.user_id = auth.uid()
        OR public.is_admin()
        OR public.is_assigned_doctor_for_patient(s.user_id)
      )
    )
  );

-- 4. public.analysis_history
ALTER TABLE public.analysis_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "analysis_history_select" ON public.analysis_history;
CREATE POLICY "analysis_history_select" ON public.analysis_history FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin() OR public.is_assigned_doctor_for_patient(user_id));

DROP POLICY IF EXISTS "analysis_history_delete" ON public.analysis_history;
CREATE POLICY "analysis_history_delete" ON public.analysis_history FOR DELETE
  USING (user_id = auth.uid() OR public.is_admin());

-- 5. public.reports
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reports_select" ON public.reports;
CREATE POLICY "reports_select" ON public.reports FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin() OR public.is_assigned_doctor_for_patient(user_id));

DROP POLICY IF EXISTS "reports_delete" ON public.reports;
CREATE POLICY "reports_delete" ON public.reports FOR DELETE
  USING (user_id = auth.uid() OR public.is_admin());

-- 6. public.doctor_patient_assignments
ALTER TABLE public.doctor_patient_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "assignments_select" ON public.doctor_patient_assignments;
CREATE POLICY "assignments_select" ON public.doctor_patient_assignments FOR SELECT
  USING (doctor_id = auth.uid() OR patient_id = auth.uid() OR public.is_admin());

-- 7. public.patient_profiles
ALTER TABLE public.patient_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select" ON public.patient_profiles;
CREATE POLICY "profiles_select" ON public.patient_profiles FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin() OR public.is_assigned_doctor_for_patient(user_id));

DROP POLICY IF EXISTS "profiles_update" ON public.patient_profiles;
CREATE POLICY "profiles_update" ON public.patient_profiles FOR UPDATE
  USING (user_id = auth.uid() OR public.is_admin());

-- 8. public.doctor_notes
ALTER TABLE public.doctor_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "doctor_notes_select" ON public.doctor_notes;
CREATE POLICY "doctor_notes_select" ON public.doctor_notes FOR SELECT
  USING (
    doctor_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.scans s
      WHERE s.id = scan_id AND public.is_assigned_doctor_for_patient(s.user_id)
    )
  );

DROP POLICY IF EXISTS "doctor_notes_insert" ON public.doctor_notes;
CREATE POLICY "doctor_notes_insert" ON public.doctor_notes FOR INSERT
  WITH CHECK (
    doctor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.scans s
      WHERE s.id = scan_id AND public.is_assigned_doctor_for_patient(s.user_id)
    )
  );

-- 9. public.appointments
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "appointments_all" ON public.appointments;
CREATE POLICY "appointments_all" ON public.appointments FOR ALL
  USING (doctor_id = auth.uid() OR patient_id = auth.uid() OR public.is_admin());

-- 10. public.prescriptions
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prescriptions_select" ON public.prescriptions;
CREATE POLICY "prescriptions_select" ON public.prescriptions FOR SELECT
  USING (patient_id = auth.uid() OR doctor_id = auth.uid() OR public.is_admin());

-- 11. public.chat_sessions
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chat_sessions_all" ON public.chat_sessions;
CREATE POLICY "chat_sessions_all" ON public.chat_sessions FOR ALL
  USING (user_id = auth.uid() OR public.is_admin());

-- 12. public.chat_history
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chat_history_all" ON public.chat_history;
CREATE POLICY "chat_history_all" ON public.chat_history FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_sessions cs
      WHERE cs.id = session_id AND (cs.user_id = auth.uid() OR public.is_admin())
    )
  );

-- 13. public.audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_logs_select" ON public.audit_logs;
CREATE POLICY "audit_logs_select" ON public.audit_logs FOR SELECT
  USING (public.is_admin());

-- 14. public.refresh_tokens
ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;
-- Restrict direct PostgREST access completely
DROP POLICY IF EXISTS "refresh_tokens_deny_all" ON public.refresh_tokens;
CREATE POLICY "refresh_tokens_deny_all" ON public.refresh_tokens FOR ALL
  USING (public.is_admin());

-- 15. public.user_settings
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_settings_all" ON public.user_settings;
CREATE POLICY "user_settings_all" ON public.user_settings FOR ALL
  USING (user_id = auth.uid() OR public.is_admin());

COMMIT;
