"""
CareerDesk — Auth Resilience & SSO Verification Suite
=====================================================
Run with: python -m unittest tests/test_auth.py
"""

import sys
import os
import time
import base64
import json
import unittest

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from api.index import create_app


def create_mock_jwt(sub="user-test-uuid-1234", email="student@example.com", exp_offset=3600):
    """Generate a base64-encoded mock JWT with standard Supabase claims."""
    header = base64.urlsafe_b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()).decode().rstrip("=")
    payload_data = {
        "sub": sub,
        "email": email,
        "iss": "https://placeholder-project.supabase.co/auth/v1",
        "exp": int(time.time()) + exp_offset,
        "user_metadata": {
            "full_name": "Test Student",
            "avatar_url": "https://lh3.googleusercontent.com/a/test-avatar"
        }
    }
    payload = base64.urlsafe_b64encode(json.dumps(payload_data).encode()).decode().rstrip("=")
    signature = base64.urlsafe_b64encode(b"mock_signature_data_32_bytes_long!").decode().rstrip("=")
    return f"{header}.{payload}.{signature}"


class AuthResilienceTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.client = cls.app.test_client()

    def test_missing_token_returns_401(self):
        """Unauthenticated requests to /api/auth/me must return HTTP 401."""
        res = self.client.get("/api/auth/me")
        self.assertEqual(res.status_code, 401)
        data = res.get_json()
        self.assertIn("error", data)

    def test_expired_mock_token_rejected(self):
        """Expired JWT tokens must be rejected with HTTP 401."""
        expired_token = create_mock_jwt(exp_offset=-100)
        res = self.client.get("/api/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
        self.assertEqual(res.status_code, 401)

    def test_valid_supabase_jwt_fallback_passes(self):
        """Valid Supabase token is accepted and returns the user profile even if service role key is absent."""
        token = create_mock_jwt(sub="test-user-valid-999", email="student@university.edu", exp_offset=3600)
        res = self.client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("user", data)
        user = data["user"]
        self.assertEqual(user["id"], "test-user-valid-999")
        self.assertEqual(user["email"], "student@university.edu")
        self.assertEqual(user["full_name"], "Test Student")
        self.assertEqual(user["avatar_url"], "https://lh3.googleusercontent.com/a/test-avatar")


if __name__ == "__main__":
    unittest.main()
