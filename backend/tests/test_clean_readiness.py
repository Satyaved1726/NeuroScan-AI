"""Automated verification script to validate clean database and security readiness."""

import unittest
from app.services.supabase_store import get_store
from app.core.security import decode_supabase_token
from app.core.config import get_settings


class TestCleanStartReadiness(unittest.TestCase):
    def setUp(self):
        self.store = get_store()
        self.settings = get_settings()

    def test_database_connection_alive(self):
        """Verify direct database connection pool is operational."""
        conn = self.store.db.get_connection()
        self.assertIsNotNone(conn)
        cursor = conn.cursor()
        cursor.execute("SELECT 1;")
        res = cursor.fetchone()
        cursor.close()
        self.store.db.return_connection(conn)
        self.assertEqual(res[0], 1)

    def test_authorization_checks_strict(self):
        """Verify unassigned doctors receive False from authorization methods."""
        fake_doctor_id = "00000000-0000-0000-0000-000000000001"
        fake_scan_id = "00000000-0000-0000-0000-000000000002"
        # Doctor role without assignment should return False
        can_access = self.store.can_user_access_scan(fake_doctor_id, "Doctor", fake_scan_id)
        self.assertFalse(can_access)


if __name__ == "__main__":
    unittest.main()
