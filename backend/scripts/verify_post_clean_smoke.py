"""Dedicated post-migration verification script for NeuroScan AI.
Validates:
1. Supabase Auth signup and profile sync trigger (public.users and public.patient_profiles).
2. Fail-closed role protection trigger (blocks privilege escalation to Doctor/Admin).
3. Private storage signed URL generation and upload.
4. Guaranteed cleanup of test accounts and test files via try-finally with strict failure tracking.
"""

import sys
import uuid
import time
from typing import Optional, Callable
from app.core.config import get_settings
from supabase import create_client


def run_post_migration_smoke_test(admin_client=None, anon_client_factory: Optional[Callable] = None) -> int:
    print("==================================================")
    print("NEUROSCAN AI — POST-MIGRATION SMOKE VERIFICATION")
    print("==================================================")

    settings = get_settings()
    if admin_client is None:
        admin_client = create_client(settings.supabase_url, settings.supabase_key)

    test_email = f"smoke_test_{int(time.time())}@neuroscan.ai"
    test_password = f"TestPass!_{uuid.uuid4().hex[:12]}"
    test_user_id = None
    test_storage_files = []
    smoke_test_error = None
    cleanup_errors = []

    print(f"\n1. Registering test user: {test_email}...")
    try:
        # Create user via Supabase Auth
        auth_res = admin_client.auth.admin.create_user({
            "email": test_email,
            "password": test_password,
            "email_confirm": True,
            "user_metadata": {"full_name": "Smoke Test Patient"}
        })

        test_user = auth_res.user if hasattr(auth_res, "user") else auth_res
        test_user_id = str(test_user.id)
        print(f"  [OK] Auth user created with UID: {test_user_id}")

        # Wait briefly for trigger execution
        time.sleep(1)

        # 2. Verify public.users sync
        print("\n2. Verifying public.users profile sync trigger...")
        user_row = admin_client.table("users").select("*").eq("id", test_user_id).execute()
        if not user_row.data or len(user_row.data) == 0:
            raise RuntimeError(f"Trigger failed! No public.users record for UID {test_user_id}")
        profile = user_row.data[0]
        print(f"  [OK] public.users found: role='{profile.get('role')}', full_name='{profile.get('full_name')}'")
        assert profile.get("role") == "User", f"Expected role 'User', got {profile.get('role')}"
        assert profile.get("is_active") is True, "Expected is_active=True"

        # 3. Verify public.patient_profiles sync
        print("\n3. Verifying public.patient_profiles profile sync...")
        patient_row = admin_client.table("patient_profiles").select("*").eq("user_id", test_user_id).execute()
        if not patient_row.data or len(patient_row.data) == 0:
            raise RuntimeError(f"Trigger failed! No public.patient_profiles record for user_id {test_user_id}")
        patient_profile = patient_row.data[0]
        print(f"  [OK] public.patient_profiles created: patient_id='{patient_profile.get('patient_id')}', full_name='{patient_profile.get('full_name')}'")

        # 4. Verify role elevation protection
        print("\n4. Testing role protection (attempting unauthorized role escalation to Doctor)...")
        if anon_client_factory:
            anon_client = anon_client_factory()
        else:
            anon_client = create_client(settings.supabase_url, settings.supabase_anon_key or settings.supabase_key)
            anon_client.auth.sign_in_with_password({"email": test_email, "password": test_password})

        escalation_blocked = False
        try:
            anon_client.table("users").update({"role": "Doctor"}).eq("id", test_user_id).execute()
        except Exception as e:
            escalation_blocked = True
            print(f"  [OK] Role escalation successfully rejected by trigger: {e}")

        if not escalation_blocked:
            # Re-read row to see if role changed
            refreshed = admin_client.table("users").select("role").eq("id", test_user_id).execute()
            if refreshed.data and refreshed.data[0].get("role") == "Doctor":
                raise RuntimeError("SECURITY FAILURE: User successfully escalated their own role to Doctor!")
            print("  [OK] Role escalation did not succeed.")

        # 5. Verify private storage and signed URLs
        print("\n5. Testing private bucket upload & signed URL retrieval...")
        test_file_path = f"{test_user_id}/test_mri_{uuid.uuid4().hex[:8]}.txt"
        test_storage_files.append(("mri-images", test_file_path))

        admin_client.storage.from_("mri-images").upload(
            test_file_path,
            b"NEUROSCAN_AI_VERIFICATION_TEST_DATA",
            {"content-type": "text/plain"}
        )
        print(f"  [OK] Uploaded test object to private mri-images/{test_file_path}")

        signed_url_res = admin_client.storage.from_("mri-images").create_signed_url(test_file_path, 60)
        signed_url = signed_url_res.get("signedURL") or signed_url_res.get("signedUrl")
        if not signed_url:
            raise RuntimeError(f"Failed to generate signed URL: {signed_url_res}")
        print("  [OK] Generated signed URL successfully for private object.")

        print("\n==================================================")
        print("ALL POST-MIGRATION SMOKE CHECKS PASSED.")
        print("==================================================")

    except Exception as e:
        smoke_test_error = e
        print(f"\n[ERROR] Smoke test assertion failed: {e}")

    finally:
        # 6. GUARANTEED CLEANUP: Safely remove ONLY the test user's files and records
        print("\n[CLEANUP] Purging test account and test files (isolated to test_user_id)...")
        if test_storage_files:
            for bucket, file_path in test_storage_files:
                try:
                    admin_client.storage.from_(bucket).remove([file_path])
                    print(f"  [OK] Removed test storage file: {bucket}/{file_path}")
                except Exception as e:
                    err_msg = f"Failed to remove test storage file {bucket}/{file_path}: {e}"
                    print(f"  WARNING: {err_msg}")
                    cleanup_errors.append(err_msg)

        if test_user_id:
            # Explicitly delete the test user's public profile first
            try:
                admin_client.table("users").delete().eq("id", test_user_id).execute()
                print(f"  [OK] Deleted test record from public.users (id={test_user_id})")
            except Exception as e:
                err_msg = f"Failed to delete public.users record for {test_user_id}: {e}"
                print(f"  WARNING: {err_msg}")
                cleanup_errors.append(err_msg)

            # Delete the test user from Supabase Auth
            try:
                admin_client.auth.admin.delete_user(test_user_id)
                print(f"  [OK] Deleted test auth user from auth.users (id={test_user_id})")
            except Exception as e:
                err_msg = f"Failed to delete test auth user {test_user_id}: {e}"
                print(f"  WARNING: {err_msg}")
                cleanup_errors.append(err_msg)

            # Verify complete isolation: ensure no test records remain in public tables
            try:
                rem_user = admin_client.table("users").select("id").eq("id", test_user_id).execute()
                rem_profile = admin_client.table("patient_profiles").select("id").eq("user_id", test_user_id).execute()
                if not rem_user.data and not rem_profile.data:
                    print(f"  [OK] Confirmed zero remaining records for test user {test_user_id} across public tables.")
                else:
                    err_msg = f"Test records were not completely removed: users={rem_user.data}, profiles={rem_profile.data}"
                    print(f"  WARNING: {err_msg}")
                    cleanup_errors.append(err_msg)
            except Exception as e:
                err_msg = f"Failed to verify test record cleanup for {test_user_id}: {e}"
                print(f"  WARNING: {err_msg}")
                cleanup_errors.append(err_msg)

    # Post-cleanup evaluation:
    if smoke_test_error and cleanup_errors:
        print("\n==================================================")
        print("FATAL: Both smoke test assertions AND cleanup failed!")
        print(f"Cleanup errors ({len(cleanup_errors)}):")
        for err in cleanup_errors:
            print(f"  - {err}")
        print("==================================================")
        raise RuntimeError(
            f"Smoke test failed ({smoke_test_error}) AND cleanup failed ({'; '.join(cleanup_errors)})"
        ) from smoke_test_error
    elif smoke_test_error:
        print("\n==================================================")
        print("FATAL: Smoke test assertions failed (cleanup succeeded).")
        print("==================================================")
        raise smoke_test_error
    elif cleanup_errors:
        print("\n==================================================")
        print("FATAL: Smoke test assertions passed, but CLEANUP FAILED!")
        print(f"Cleanup errors ({len(cleanup_errors)}):")
        for err in cleanup_errors:
            print(f"  - {err}")
        print("==================================================")
        raise RuntimeError(f"Smoke test cleanup failed: {'; '.join(cleanup_errors)}")

    print("\n==================================================")
    print("SMOKE TEST AND CLEANUP COMPLETED SUCCESSFULLY (CLEAN).")
    print("==================================================")
    return 0


if __name__ == "__main__":
    try:
        run_post_migration_smoke_test()
        sys.exit(0)
    except Exception as exc:
        print(f"\nFATAL SMOKE TEST FAILURE: {exc}", file=sys.stderr)
        sys.exit(1)
