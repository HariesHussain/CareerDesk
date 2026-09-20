"""
CareerDesk — Enterprise Admin & Governance Verification Suite
=============================================================
Run with: python -m unittest tests/test_admin.py
"""

import sys
import os
import unittest

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from api.index import create_app
from api.routes.admin import get_admin_metrics
from api.services.supabase_client import get_service_client


class EnterpriseAdminTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.client = cls.app.test_client()

    def test_public_announcement_endpoint(self):
        """Public announcement endpoint must return HTTP 200 without auth."""
        res = self.client.get("/api/announcement")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("announcement", data)

    def test_admin_metrics_route_protection(self):
        """Admin metrics route must reject unauthenticated requests with HTTP 401."""
        res = self.client.get("/api/admin/metrics")
        self.assertEqual(res.status_code, 401)
        data = res.get_json()
        self.assertIn("error", data)

    def test_admin_metrics_execution(self):
        """Admin metrics route logic must execute cleanly and return aggregated KPIs."""
        with self.app.test_request_context():
            from flask import g
            g.user_id = "test-admin-id"
            g.current_user = {
                "id": "test-admin-id",
                "email": "shaikharieshussain09@gmail.com",
                "role": "admin",
            }
            resp = get_admin_metrics.__wrapped__()
            self.assertEqual(resp.status_code, 200)
            data = resp.get_json()
            self.assertIn("metrics", data)
            metrics = data["metrics"]
            self.assertIn("total_opportunities", metrics)
            self.assertIn("total_users", metrics)
            self.assertIn("active_users_24h", metrics)


if __name__ == "__main__":
    unittest.main()
