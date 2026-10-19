"""Unit tests for private storage signed URL generation, security, and lifecycle management."""

import json
import time
import base64
import unittest
from unittest.mock import MagicMock, patch
from fastapi import HTTPException

from app.services.mri_upload import _signed_storage_url
from app.api.explainability import _generate_heatmap_signed_url
from app.services.report import fetch_report_image
from app.routers.reports import _ensure_signed_storage_url
from app.core.storage_urls import is_signed_url_valid, refresh_or_create_signed_url
from app.api.analysis import _get_scan


class TestStorageCompatibility(unittest.TestCase):
    """Test suite for private storage compatibility and security."""

    @patch('app.services.mri_upload._get_storage_client')
    def test_signed_storage_url_success(self, mock_client_getter):
        mock_client = MagicMock()
        mock_client.storage.from_.return_value.create_signed_url.return_value = {
            'signedURL': 'https://mock.supabase.co/storage/v1/object/sign/mri-images/user1/scan1.png?token=mock_tok'
        }
        mock_client_getter.return_value = mock_client

        url = _signed_storage_url('user1/scan1.png', expires_in=3600)
        self.assertIn('/storage/v1/object/sign/mri-images/user1/scan1.png?token=mock_tok', url)
        mock_client.storage.from_.assert_called_with('mri-images')
        mock_client.storage.from_.return_value.create_signed_url.assert_called_with('user1/scan1.png', 3600)

    @patch('app.services.mri_upload._get_storage_client')
    def test_signed_storage_url_failure_raises_502(self, mock_client_getter):
        mock_client = MagicMock()
        mock_client.storage.from_.return_value.create_signed_url.side_effect = RuntimeError("Storage connection refused")
        mock_client_getter.return_value = mock_client

        with self.assertRaises(HTTPException) as ctx:
            _signed_storage_url('user1/scan1.png')

        self.assertEqual(ctx.exception.status_code, 502)
        self.assertIn("Failed to generate secure signed URL", ctx.exception.detail)

    def test_generate_heatmap_signed_url_success(self):
        mock_client = MagicMock()
        mock_client.storage.from_.return_value.create_signed_url.return_value = {
            'signedURL': 'https://mock.supabase.co/storage/v1/object/sign/heatmaps/user1/scan1/heat.png?token=heat_tok'
        }

        url = _generate_heatmap_signed_url(mock_client, 'user1/scan1/heat.png', expires_in=7200)
        self.assertIn('heat_tok', url)
        mock_client.storage.from_.assert_called_with('heatmaps')
        mock_client.storage.from_.return_value.create_signed_url.assert_called_with('user1/scan1/heat.png', 7200)

    def test_generate_heatmap_signed_url_failure_raises_502(self):
        mock_client = MagicMock()
        mock_client.storage.from_.return_value.create_signed_url.side_effect = Exception("Storage error")

        with self.assertRaises(HTTPException) as ctx:
            _generate_heatmap_signed_url(mock_client, 'user1/scan1/heat.png')

        self.assertEqual(ctx.exception.status_code, 502)

    @patch('app.services.report._get_report_storage_client')
    def test_fetch_report_image_direct_storage_download(self, mock_client_getter):
        mock_client = MagicMock()
        mock_client.storage.from_.return_value.download.return_value = b"\x89PNG\r\n\x1a\n_mock_bytes"
        mock_client_getter.return_value = mock_client

        # Provide a Supabase storage URL
        url = "https://mock.supabase.co/storage/v1/object/public/mri-images/user1/scan1.png"
        content = fetch_report_image(url)

        self.assertEqual(content, b"\x89PNG\r\n\x1a\n_mock_bytes")
        mock_client.storage.from_.assert_called_with('mri-images')
        mock_client.storage.from_.return_value.download.assert_called_with('user1/scan1.png')

    @patch('app.services.report._get_report_storage_client')
    def test_fetch_report_image_disallowed_bucket_rejected(self, mock_client_getter):
        mock_client = MagicMock()
        mock_client_getter.return_value = mock_client

        # Attempt to download from unauthorized bucket
        url = "https://mock.supabase.co/storage/v1/object/public/secret-database-backups/dump.sql"
        content = fetch_report_image(url)
        # Should NOT call storage download on disallowed bucket
        mock_client.storage.from_.assert_not_called()
        self.assertIsNone(content)

    def test_fetch_report_image_ssrf_protection(self):
        # Attempt SSRF to AWS/GCP metadata endpoint
        self.assertIsNone(fetch_report_image('http://169.254.169.254/latest/meta-data/'))
        # Attempt SSRF to localhost
        self.assertIsNone(fetch_report_image('http://127.0.0.1:8000/admin'))
        self.assertIsNone(fetch_report_image('http://localhost:5432/'))
        # Attempt non-HTTP scheme
        self.assertIsNone(fetch_report_image('file:///etc/passwd'))

    def test_is_signed_url_valid_and_expiration_refresh(self):
        # 1. Expired token
        expired_payload = base64.urlsafe_b64encode(json.dumps({'exp': int(time.time() - 3600)}).encode()).decode().rstrip('=')
        expired_url = f'https://mock.supabase.co/storage/v1/object/sign/mri-images/user1/scan.png?token=h.{expired_payload}.s'
        self.assertFalse(is_signed_url_valid(expired_url))

        # 2. Future token
        valid_payload = base64.urlsafe_b64encode(json.dumps({'exp': int(time.time() + 7200)}).encode()).decode().rstrip('=')
        valid_url = f'https://mock.supabase.co/storage/v1/object/sign/mri-images/user1/scan.png?token=h.{valid_payload}.s'
        self.assertTrue(is_signed_url_valid(valid_url))

        # 3. refresh_or_create_signed_url should refresh expired URL
        mock_client = MagicMock()
        mock_client.storage.from_.return_value.create_signed_url.return_value = {
            'signedURL': 'https://mock.supabase.co/storage/v1/object/sign/mri-images/user1/scan.png?token=refreshed_tok'
        }
        refreshed = refresh_or_create_signed_url(mock_client, expired_url, 'mri-images')
        self.assertIn('refreshed_tok', refreshed)

        # 4. refresh_or_create_signed_url should keep valid URL
        kept = refresh_or_create_signed_url(mock_client, valid_url, 'mri-images')
        self.assertEqual(kept, valid_url)

    @patch('app.api.analysis.SupabaseDB.initialize')
    def test_scan_authorization_prevents_idor(self, mock_db_init):
        # When scan belongs to user A, user B cannot look it up
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = None  # No matching scan for (scan_id, user_B)
        mock_conn.cursor.return_value = mock_cursor
        mock_db = MagicMock()
        mock_db.get_connection.return_value = mock_conn
        mock_db_init.return_value = mock_db

        with self.assertRaises(HTTPException) as ctx:
            _get_scan('scan-uuid-123', 'user-b-uuid')

        self.assertEqual(ctx.exception.status_code, 404)
        self.assertEqual(ctx.exception.detail, 'Scan not found')


if __name__ == '__main__':
    unittest.main()
