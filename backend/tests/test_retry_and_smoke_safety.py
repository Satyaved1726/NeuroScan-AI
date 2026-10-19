"""Unit tests for clinical storage retry safety and smoke test cleanup error tracking.
All tests use mocks only. Zero live network or database calls.
"""

import unittest
from unittest.mock import MagicMock
from scripts.purge_clinical_storage import (
    purge_clinical_storage,
    ALLOWED_CLINICAL_BUCKETS,
    FORBIDDEN_BUCKETS,
)
from scripts.verify_post_clean_smoke import run_post_migration_smoke_test


class TestPurgeClinicalStorageSafety(unittest.TestCase):
    """Test safety guards and failure tracking in purge_clinical_storage.py."""

    def test_allowlist_rejects_models_bucket(self):
        """Verify any attempt to target 'models' bucket is immediately rejected."""
        mock_client = MagicMock()
        # Attempt targeting models directly
        status = purge_clinical_storage(client=mock_client, target_buckets=["models"])
        self.assertEqual(status, 1)
        mock_client.storage.from_.assert_not_called()

        # Attempt targeting models mixed with clinical buckets
        status2 = purge_clinical_storage(
            client=mock_client, target_buckets=["mri-images", "models", "heatmaps"]
        )
        self.assertEqual(status2, 1)

    def test_allowlist_rejects_unapproved_buckets(self):
        """Verify unapproved buckets outside ALLOWED_CLINICAL_BUCKETS are rejected."""
        mock_client = MagicMock()
        status = purge_clinical_storage(client=mock_client, target_buckets=["user_backups"])
        self.assertEqual(status, 1)

    def test_purge_storage_success_mocked(self):
        """Verify success path when all files are purged and buckets verify empty."""
        mock_client = MagicMock()
        mock_models = MagicMock()
        mock_models.list.return_value = [{"name": "dementia_model.keras", "metadata": {"size": 37394953}}]
        
        mock_clinical = MagicMock()
        # First call: list returns 1 file. Second call (verification): list returns empty.
        mock_clinical.list.side_effect = [
            [{"name": "scan1.png", "metadata": {"size": 1024}}],  # files in bucket
            [],  # bucket empty verification
        ]
        mock_clinical.remove.return_value = [{"name": "scan1.png"}]

        def from_side_effect(b):
            return mock_models if b == "models" else mock_clinical

        mock_client.storage.from_.side_effect = from_side_effect

        status = purge_clinical_storage(client=mock_client, target_buckets=["mri-images"])
        self.assertEqual(status, 0)
        mock_clinical.remove.assert_called_with(["scan1.png"])

    def test_purge_storage_fails_on_removal_error(self):
        """Verify nonzero exit code when a remove call throws an error."""
        mock_client = MagicMock()
        mock_models = MagicMock()
        mock_models.list.return_value = [{"name": "dementia_model.keras", "metadata": {"size": 37394953}}]

        mock_clinical = MagicMock()
        mock_clinical.list.side_effect = [
            [{"name": "scan1.png", "metadata": {"size": 1024}}],
            [],
        ]
        mock_clinical.remove.side_effect = Exception("Storage API Timeout")

        def from_side_effect(b):
            return mock_models if b == "models" else mock_clinical

        mock_client.storage.from_.side_effect = from_side_effect

        status = purge_clinical_storage(client=mock_client, target_buckets=["mri-images"])
        self.assertEqual(status, 1)

    def test_purge_storage_fails_if_files_remain(self):
        """Verify nonzero exit code when verification finds remaining files."""
        mock_client = MagicMock()
        mock_models = MagicMock()
        mock_models.list.return_value = [{"name": "dementia_model.keras", "metadata": {"size": 37394953}}]

        mock_clinical = MagicMock()
        # Both initial list and post-purge verification return non-empty
        mock_clinical.list.return_value = [{"name": "orphaned.png", "metadata": {"size": 1024}}]
        mock_clinical.remove.return_value = [{"name": "orphaned.png"}]

        def from_side_effect(b):
            return mock_models if b == "models" else mock_clinical

        mock_client.storage.from_.side_effect = from_side_effect

        status = purge_clinical_storage(client=mock_client, target_buckets=["mri-images"])
        self.assertEqual(status, 1)


class TestSmokeTestCleanupFailureTracking(unittest.TestCase):
    """Test cleanup error tracking and exception propagation in verify_post_clean_smoke.py."""

    def _build_mock_admin(self, user_id="test-uid-123"):
        mock_admin = MagicMock()
        mock_user = MagicMock()
        mock_user.id = user_id
        mock_admin.auth.admin.create_user.return_value = MagicMock(user=mock_user)

        # Mock table queries
        mock_users_tbl = MagicMock()
        mock_users_tbl.select.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{"role": "User", "full_name": "Smoke Test Patient", "is_active": True}]
        )
        mock_patient_tbl = MagicMock()
        mock_patient_tbl.select.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{"patient_id": "NSA-123456", "full_name": "Smoke Test Patient"}]
        )

        def table_side_effect(name):
            if name == "users":
                return mock_users_tbl
            elif name == "patient_profiles":
                return mock_patient_tbl
            return MagicMock()

        mock_admin.table.side_effect = table_side_effect

        # Mock storage
        mock_storage = MagicMock()
        mock_storage.create_signed_url.return_value = {"signedUrl": "https://signed.example.com/file"}
        mock_admin.storage.from_.return_value = mock_storage

        return mock_admin, mock_users_tbl, mock_storage

    def test_cleanup_failure_raises_runtime_error(self):
        """Verify that when test passes but cleanup fails, a RuntimeError is raised (nonzero exit)."""
        mock_admin, mock_users_tbl, mock_storage = self._build_mock_admin()

        # Simulate cleanup failure: public.users delete fails
        mock_users_tbl.delete.side_effect = Exception("Database constraint lock")

        mock_anon_factory = MagicMock()
        mock_anon = MagicMock()
        mock_anon.table.return_value.update.return_value.eq.return_value.execute.side_effect = Exception("Blocked by trigger")
        mock_anon_factory.return_value = mock_anon

        with self.assertRaises(RuntimeError) as ctx:
            run_post_migration_smoke_test(
                admin_client=mock_admin, anon_client_factory=mock_anon_factory
            )

        self.assertIn("Smoke test cleanup failed", str(ctx.exception))

    def test_original_smoke_error_preserved_when_cleanup_succeeds(self):
        """Verify that when smoke test fails, the original error is preserved and raised."""
        mock_admin = MagicMock()
        mock_admin.auth.admin.create_user.side_effect = RuntimeError("Auth service unavailable")

        # Cleanup verification returns empty data
        mock_admin.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

        with self.assertRaises(RuntimeError) as ctx:
            run_post_migration_smoke_test(admin_client=mock_admin)

        self.assertEqual(str(ctx.exception), "Auth service unavailable")

    def test_both_smoke_and_cleanup_fail_chains_exceptions(self):
        """Verify that when both test and cleanup fail, original exception is chained."""
        mock_admin, mock_users_tbl, mock_storage = self._build_mock_admin()

        # Step 5 fails during upload
        mock_storage.upload.side_effect = RuntimeError("Original assertion failure during upload")

        # Cleanup also fails on delete_user
        mock_admin.auth.admin.delete_user.side_effect = Exception("Auth delete error")

        mock_anon_factory = MagicMock()
        mock_anon = MagicMock()
        mock_anon.table.return_value.update.return_value.eq.return_value.execute.side_effect = Exception("Blocked by trigger")
        mock_anon_factory.return_value = mock_anon

        with self.assertRaises(RuntimeError) as ctx:
            run_post_migration_smoke_test(
                admin_client=mock_admin, anon_client_factory=mock_anon_factory
            )

        self.assertIn("Smoke test failed", str(ctx.exception))
        self.assertIn("cleanup failed", str(ctx.exception))
        self.assertIsNotNone(ctx.exception.__cause__)
        self.assertEqual(str(ctx.exception.__cause__), "Original assertion failure during upload")


if __name__ == "__main__":
    unittest.main()
