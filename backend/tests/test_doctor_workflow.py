"""Comprehensive automated tests for patient/doctor registration, RBAC routing, and Doctor Dashboard authorization."""

import unittest
from datetime import datetime, timezone
from uuid import uuid4

from app.core.config import get_settings
from app.models.schemas import Role, UserCreate, DoctorApplicationCreate, DoctorApplicationDecision
from app.services.supabase_store import get_store
from app.core.rbac import require_roles
from fastapi import HTTPException


class TestDoctorWorkflowAndRBAC(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.store = get_store()
        cls.settings = get_settings()
        cls.test_id_prefix = str(uuid4())[:8]
        cls.patient_email = f"patient_{cls.test_id_prefix}@neuroscan.ai"
        cls.doctor_email = f"doctor_{cls.test_id_prefix}@neuroscan.ai"
        cls.admin_email = f"admin_{cls.test_id_prefix}@neuroscan.ai"


    def test_01_patient_registration_assigns_user_role(self):
        """Test that registering a patient account creates Role.user."""
        user = self.store.create_user(
            full_name="Test Patient",
            email=self.patient_email,
            password="StrongPassword123!",
            role=Role.user.value
        )
        self.assertEqual(user.role, Role.user.value)
        self.assertEqual(user.email, self.patient_email)

        fetched = self.store.get_user(self.patient_email)
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched.role, Role.user.value)

    def test_02_public_registration_cannot_self_assign_doctor_or_admin(self):
        """Test that public registration endpoint strictly forces Role.user on server."""
        from app.routers.auth import register
        email = f"attacker_{self.test_id_prefix}@neuroscan.ai"

        payload = UserCreate(
            full_name="Attacker Trying To Be Doctor",
            email=email,
            password="SecurePassword123!",
            role=Role.doctor  # Client attempts to assign Doctor
        )
        response = register(payload)

        # Authoritative database role must remain Role.user
        self.assertEqual(response.user.role, Role.user)
        user_in_db = self.store.get_user(email)
        self.assertEqual(user_in_db.role, Role.user.value)

    def test_03_doctor_application_creates_pending_status(self):
        """Test that submitting a doctor application begins in pending status with base role User."""
        from app.routers.auth import apply_doctor

        payload = DoctorApplicationCreate(
            full_name="Dr. Jane Watson",
            email=self.doctor_email,
            password="DoctorSecurePass123!",
            license_number="MD-987654",
            specialization="Neurology",
            hospital_affiliation="Central Hospital"
        )
        result = apply_doctor(payload)

        self.assertEqual(result["status"], "pending")
        self.assertIn("under administrative review", result["message"])

        # User in db must have role 'User' until approved
        user = self.store.get_user(self.doctor_email)
        self.assertIsNotNone(user)
        self.assertEqual(user.role, Role.user.value)

        # Application in db must be 'pending'
        app_rec = self.store.get_doctor_application_by_email(self.doctor_email)
        self.assertIsNotNone(app_rec)
        self.assertEqual(app_rec["status"], "pending")
        self.assertEqual(app_rec["license_number"], "MD-987654")

    def test_04_pending_doctor_denied_doctor_dashboard_endpoints(self):
        """Test that a pending doctor applicant cannot pass Doctor RBAC check."""
        user = self.store.get_user(self.doctor_email)
        self.assertIsNotNone(user)

        doctor_rbac_checker = require_roles(Role.doctor, Role.admin)
        from app.models.schemas import UserOut

        user_out = UserOut(**user.to_public_dict())

        # Calling RBAC dependency with Role.user must raise 403 Forbidden
        with self.assertRaises(HTTPException) as ctx:
            doctor_rbac_checker(user_out)
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("Insufficient permissions", ctx.exception.detail)

    def test_05_admin_approves_doctor_application(self):
        """Test that an administrator can approve a pending application, elevating the user to Doctor."""
        app_rec = self.store.get_doctor_application_by_email(self.doctor_email)
        self.assertIsNotNone(app_rec)

        admin_user_id = str(uuid4())
        approved = self.store.approve_doctor_application(
            application_id=app_rec["id"],
            reviewer_id=admin_user_id,
            notes="Verified against medical board records."
        )

        self.assertEqual(approved["status"], "approved")

        # Verify user in database is now elevated to Doctor
        updated_user = self.store.get_user(self.doctor_email)
        self.assertEqual(updated_user.role, Role.doctor.value)

    def test_06_approved_doctor_passes_doctor_rbac(self):
        """Test that approved doctor passes doctor RBAC check."""
        user = self.store.get_user(self.doctor_email)
        self.assertEqual(user.role, Role.doctor.value)

        doctor_rbac_checker = require_roles(Role.doctor, Role.admin)
        from app.models.schemas import UserOut

        user_out = UserOut(**user.to_public_dict())
        passed_user = doctor_rbac_checker(user_out)
        self.assertEqual(passed_user.role, Role.doctor)

    def test_07_doctor_cannot_access_admin_endpoints(self):
        """Test that an approved doctor is rejected by Admin RBAC checks."""
        user = self.store.get_user(self.doctor_email)
        self.assertEqual(user.role, Role.doctor.value)

        admin_rbac_checker = require_roles(Role.admin)
        from app.models.schemas import UserOut

        user_out = UserOut(**user.to_public_dict())
        with self.assertRaises(HTTPException) as ctx:
            admin_rbac_checker(user_out)
        self.assertEqual(ctx.exception.status_code, 403)

    def test_08_patient_data_isolation(self):
        """Test that patient can only access their own reports and cannot access other patients' data."""
        patient_a_id = str(uuid4())
        patient_b_id = str(uuid4())
        report_a_id = f"report_a_{self.test_id_prefix}"

        # Patient A should be denied access to reports they do not own
        can_access = self.store.can_user_access_report(patient_b_id, Role.user.value, report_a_id)
        self.assertFalse(can_access)

        # Admin can access any report
        admin_id = str(uuid4())
        can_admin_access = self.store.can_user_access_report(admin_id, Role.admin.value, report_a_id)
        self.assertTrue(can_admin_access)

    def test_09_admin_approves_with_valid_reviewer_in_users_table(self):
        """Test that an approval with a valid reviewer ID correctly stores reviewed_by."""
        # Create a real admin user in users table
        admin_user = self.store.create_user(
            full_name="Admin Reviewer",
            email=self.admin_email,
            password="AdminPassword123!",
            role=Role.admin.value
        )
        self.assertIsNotNone(admin_user)

        # Create doctor applicant
        doctor_2_email = f"doc2_{self.test_id_prefix}@neuroscan.ai"
        doc_user = self.store.create_user(
            full_name="Dr. Validated",
            email=doctor_2_email,
            password="DocPassword123!",
            role=Role.user.value
        )
        app = self.store.create_doctor_application(
            user_id=doc_user.id,
            full_name="Dr. Validated",
            email=doctor_2_email,
            license_number="LIC-12345",
            specialization="Radiology",
            hospital_affiliation="General Hospital"
        )
        self.assertEqual(app["status"], "pending")

        # Approve with real admin user id
        approved = self.store.approve_doctor_application(
            application_id=app["id"],
            reviewer_id=admin_user.id,
            notes="Verified against state medical board."
        )

        self.assertEqual(approved["status"], "approved")
        self.assertEqual(str(approved["reviewed_by"]), str(admin_user.id))

    def test_10_database_initialization_resilience_with_orphaned_references(self):
        """Regression test: verify create_tables() succeeds without crashing even if orphaned references exist."""
        import asyncio
        from app.core.database import create_tables

        # Running create_tables must complete safely without ForeignKeyViolation
        try:
            asyncio.run(create_tables())
        except Exception as e:
            self.fail(f"create_tables() crashed during database initialization: {e}")

        # Verify existing doctor applications remain intact and untouched
        apps = self.store.list_doctor_applications()
        self.assertGreater(len(apps), 0)
        for app in apps:
            self.assertIn(app["status"], ["pending", "approved", "rejected"])
            self.assertTrue(len(app["email"]) > 0)


if __name__ == "__main__":
    unittest.main()
