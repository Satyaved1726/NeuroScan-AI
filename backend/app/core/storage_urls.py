"""Storage URL security and lifecycle management module for NeuroScan AI."""

from __future__ import annotations

import base64
import json
import logging
import re
import time
from urllib.parse import parse_qs, unquote, urlparse

from ..core.config import get_settings

logger = logging.getLogger(__name__)

DEFAULT_SIGNED_URL_EXPIRY_SECONDS = 86400  # 24 hours
ALLOWED_REPORT_IMAGE_BUCKETS = frozenset({'mri-images', 'heatmaps', 'reports'})


def is_signed_url_valid(url: str, min_ttl_seconds: int = 300) -> bool:
    """Check if a signed URL is valid and not expired."""
    if not url or '/storage/v1/object/sign/' not in url or 'token=' not in url:
        return False
    try:
        parsed = urlparse(url)
        qs = parse_qs(parsed.query)
        token = qs.get('token', [None])[0]
        if not token or '.' not in token:
            return False
        payload_b64 = token.split('.')[1]
        payload_b64 += '=' * (-len(payload_b64) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64).decode())
        exp = payload.get('exp', 0)
        return exp > (time.time() + min_ttl_seconds)
    except Exception:
        return False


def refresh_or_create_signed_url(
    client,
    url_or_path: str | None,
    default_bucket: str,
    expires_in: int = DEFAULT_SIGNED_URL_EXPIRY_SECONDS,
) -> str | None:
    """Ensure a valid, non-expired signed URL for a Storage object.

    If given a signed URL that is still valid (>5 mins remaining), returns it directly.
    If given an expired signed URL, legacy public URL, or raw storage path, extracts
    the bucket and storage path and generates a fresh signed URL using the client.
    """
    if not url_or_path:
        return None

    # If it is already a signed URL and still has >5 min TTL, keep it
    if is_signed_url_valid(url_or_path):
        return url_or_path

    storage_path = url_or_path
    target_bucket = default_bucket

    # Try extracting bucket and path from Supabase URL pattern
    m = re.search(r'/storage/v1/object/(?:public|sign|authenticated)/([^/?]+)/([^?]+)', url_or_path)
    if m:
        target_bucket = m.group(1)
        storage_path = unquote(m.group(2))
    elif url_or_path.startswith('http://') or url_or_path.startswith('https://'):
        # External non-Supabase URL
        return url_or_path

    try:
        res = client.storage.from_(target_bucket).create_signed_url(storage_path, expires_in)
        signed_url = res.get('signedURL') or res.get('signedUrl') if isinstance(res, dict) else None
        if signed_url:
            return signed_url
    except Exception as exc:
        logger.warning("Failed to refresh/create signed URL for %s/%s: %s", target_bucket, storage_path, exc)

    return url_or_path
