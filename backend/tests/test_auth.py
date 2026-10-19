"""Unit tests for Supabase JWT verification and RBAC authorization using standard unittest."""

import unittest
from datetime import datetime, timedelta, timezone
from jose import jwt
from fastapi import HTTPException
from app.core.config import get_settings
from app.core.security import decode_token, decode_supabase_token


class TestAuth(unittest.TestCase):
    def setUp(self):
        self.settings = get_settings()
        self.original_secret = self.settings.supabase_jwt_secret
        self.test_secret = "test-supabase-secret-key-32-chars-long"
        self.settings.supabase_jwt_secret = self.test_secret

    def tearDown(self):
        self.settings.supabase_jwt_secret = self.original_secret

    def test_decode_valid_supabase_token(self):
        """Test decoding a valid Supabase HS256 JWT with UUID subject."""
        payload = {
            "sub": "b2f6b8c8-724d-4537-83d8-e7c65c6928e1",
            "email": "patient@neuroscan.ai",
            "role": "authenticated",
            "aud": "authenticated",
            "exp": int((datetime.now(timezone.utc) + timedelta(hours=1)).timestamp()),
        }
        token = jwt.encode(payload, self.test_secret, algorithm="HS256")

        decoded = decode_supabase_token(token)
        self.assertEqual(decoded["sub"], "b2f6b8c8-724d-4537-83d8-e7c65c6928e1")
        self.assertEqual(decoded["email"], "patient@neuroscan.ai")

    def test_decode_invalid_signature(self):
        """Test that tokens signed with incorrect secrets are rejected."""
        wrong_secret = "wrong-secret-key-for-test-32-chars"
        payload = {
            "sub": "b2f6b8c8-724d-4537-83d8-e7c65c6928e1",
            "aud": "authenticated",
            "exp": int((datetime.now(timezone.utc) + timedelta(hours=1)).timestamp()),
        }
        token = jwt.encode(payload, wrong_secret, algorithm="HS256")

        with self.assertRaises(HTTPException) as ctx:
            decode_supabase_token(token)
        self.assertEqual(ctx.exception.status_code, 401)

    def test_decode_expired_token(self):
        """Test that expired tokens raise HTTP 401."""
        payload = {
            "sub": "b2f6b8c8-724d-4537-83d8-e7c65c6928e1",
            "aud": "authenticated",
            "exp": int((datetime.now(timezone.utc) - timedelta(hours=1)).timestamp()),
        }
        token = jwt.encode(payload, self.test_secret, algorithm="HS256")

        with self.assertRaises(HTTPException) as ctx:
            decode_supabase_token(token)
        self.assertEqual(ctx.exception.status_code, 401)

    def test_decode_token_general_resolver(self):
        """Test decode_token general utility resolves valid token."""
        payload = {
            "sub": "b2f6b8c8-724d-4537-83d8-e7c65c6928e1",
            "exp": int((datetime.now(timezone.utc) + timedelta(hours=1)).timestamp()),
        }
        token = jwt.encode(payload, self.test_secret, algorithm="HS256")

        decoded = decode_token(token)
        self.assertEqual(decoded["sub"], "b2f6b8c8-724d-4537-83d8-e7c65c6928e1")


if __name__ == '__main__':
    unittest.main()
