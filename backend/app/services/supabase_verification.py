from __future__ import annotations

import base64
from dataclasses import dataclass
from datetime import datetime, timezone
from io import BytesIO
import json
import logging
from typing import Any
from urllib.parse import urlparse
from uuid import uuid4

from fastapi import HTTPException, status
from PIL import Image
from psycopg2.extras import Json
import supabase

from ..core.config import get_settings
from ..core.database import SupabaseDB

logger = logging.getLogger(__name__)

REQUIRED_BUCKETS = ('mri-images', 'heatmaps', 'reports')
TEST_IMAGE_SIZE = 256


@dataclass
class SupabaseHealth:
    database: bool
    storage: bool
    supabase: bool
    buckets: dict[str, bool]


def log_event(level: int, event: str, **fields: Any) -> None:
    logger.log(
        level,
        json.dumps(
            {
                'event': event,
                **fields,
            },
            default=str,
            sort_keys=True,
        ),
    )


def _settings_or_raise():
    settings = get_settings()
    missing = [
        name
        for name, value in {
            'SUPABASE_URL': settings.supabase_url,
            'SUPABASE_KEY': settings.supabase_key,
            'SUPABASE_DB_URL': settings.supabase_db_url,
        }.items()
        if not value
    ]

    if missing:
        raise RuntimeError(f'Missing Supabase configuration: {", ".join(missing)}')

    return settings


def get_storage_client():
    settings = _settings_or_raise()
    return supabase.create_client(settings.supabase_url, settings.supabase_key)


def _preview(value: str | None, length: int = 12) -> str | None:
    if not value:
        return None
    return value[:length]


def _project_ref_from_url(url: str | None) -> str | None:
    if not url:
        return None
    hostname = urlparse(url).hostname
    if not hostname:
        return None
    return hostname.split('.')[0]


def _supabase_key_claims(key: str | None) -> dict[str, Any]:
    if not key:
        return {}
    parts = key.split('.')
    if len(parts) < 2:
        return {}
    try:
        payload = parts[1] + ('=' * (-len(parts[1]) % 4))
        decoded = base64.urlsafe_b64decode(payload.encode('utf-8'))
        claims = json.loads(decoded.decode('utf-8'))
    except Exception:
        return {}
    return claims if isinstance(claims, dict) else {}


def _log_supabase_environment(settings: Any) -> None:
    claims = _supabase_key_claims(settings.supabase_key)
    url_project_ref = _project_ref_from_url(settings.supabase_url)
    key_project_ref = claims.get('ref')
    key_role = claims.get('role')

    log_event(
        logging.DEBUG,
        'supabase_environment_debug',
        supabase_url_prefix=_preview(settings.supabase_url, 32),
        supabase_url_project_ref=url_project_ref,
        supabase_key_loaded=bool(settings.supabase_key),
        supabase_key_prefix=_preview(settings.supabase_key, 8),
        supabase_key_role=key_role,
        supabase_key_project_ref=key_project_ref,
        project_refs_match=(
            url_project_ref == key_project_ref
            if url_project_ref and key_project_ref
            else None
        ),
        using_anon_key=key_role == 'anon',
        using_service_role_key=key_role == 'service_role',
    )
    print(
        'SUPABASE ENV DEBUG:',
        {
            'supabase_url_prefix': _preview(settings.supabase_url, 32),
            'supabase_url_project_ref': url_project_ref,
            'supabase_key_loaded': bool(settings.supabase_key),
            'supabase_key_prefix': _preview(settings.supabase_key, 8),
            'supabase_key_role': key_role,
            'supabase_key_project_ref': key_project_ref,
            'project_refs_match': (
                url_project_ref == key_project_ref
                if url_project_ref and key_project_ref
                else None
            ),
            'using_anon_key': key_role == 'anon',
            'using_service_role_key': key_role == 'service_role',
        },
    )


def verify_database_connection() -> bool:
    print("[STARTUP-DIAG] -> verify_database_connection: initializing pool", flush=True)
    db = SupabaseDB.initialize()
    print("[STARTUP-DIAG] -> verify_database_connection: getting connection", flush=True)
    conn = db.get_connection()
    try:
        print("[STARTUP-DIAG] -> verify_database_connection: executing SELECT 1", flush=True)
        with conn.cursor() as cursor:
            cursor.execute('SELECT 1')
            cursor.fetchone()
        print("[STARTUP-DIAG] -> verify_database_connection: SELECT 1 succeeded", flush=True)
        log_event(logging.INFO, 'supabase_database_verified')
        return True
    except Exception as exc:
        print(f"[STARTUP-DIAG] -> verify_database_connection error: {exc}", flush=True)
        log_event(logging.ERROR, 'supabase_database_verification_failed', error=str(exc))
        raise
    finally:
        db.return_connection(conn)


def _bucket_name(bucket: Any) -> str | None:
    if isinstance(bucket, dict):
        return bucket.get('name') or bucket.get('id')
    if hasattr(bucket, 'model_dump'):
        data = bucket.model_dump()
        if isinstance(data, dict):
            return data.get('name') or data.get('id')
    if hasattr(bucket, 'dict'):
        data = bucket.dict()
        if isinstance(data, dict):
            return data.get('name') or data.get('id')
    return getattr(bucket, 'name', None) or getattr(bucket, 'id', None)


def _bucket_items(response: Any) -> list[Any]:
    if response is None:
        return []

    if isinstance(response, list):
        return response

    if isinstance(response, tuple):
        return list(response)

    if isinstance(response, dict):
        for key in ('data', 'buckets', 'result'):
            value = response.get(key)
            if value is not None:
                return _bucket_items(value)
        return []

    for attr in ('data', 'buckets', 'result'):
        value = getattr(response, attr, None)
        if value is not None:
            return _bucket_items(value)

    json_method = getattr(response, 'json', None)
    if callable(json_method):
        try:
            return _bucket_items(json_method())
        except Exception:
            return []

    if not isinstance(response, (str, bytes)):
        try:
            return list(response)
        except TypeError:
            return []

    return []


def list_storage_bucket_names() -> set[str]:
    print("[STARTUP-DIAG] -> list_storage_bucket_names: checking settings", flush=True)
    settings = _settings_or_raise()
    _log_supabase_environment(settings)
    print("[STARTUP-DIAG] -> list_storage_bucket_names: creating storage client", flush=True)
    client = get_storage_client()
    try:
        print("[STARTUP-DIAG] -> list_storage_bucket_names: calling client.storage.list_buckets()", flush=True)
        buckets = client.storage.list_buckets()
        print(f"[STARTUP-DIAG] -> list_storage_bucket_names: received response ({type(buckets).__name__})", flush=True)
        bucket_items = _bucket_items(buckets)
        names = {
            name
            for bucket in bucket_items
            if (name := _bucket_name(bucket))
        }
        log_event(
            logging.DEBUG,
            'supabase_storage_raw_bucket_response',
            raw_response=repr(buckets),
            response_type=type(buckets).__name__,
        )
        log_event(
            logging.DEBUG,
            'supabase_storage_extracted_bucket_names',
            bucket_names=sorted(names),
            bucket_item_types=sorted({type(bucket).__name__ for bucket in bucket_items}),
        )
        print('RAW BUCKET RESPONSE:', buckets)
        print('BUCKET RESPONSE TYPE:', type(buckets).__name__)
        print('EXTRACTED BUCKETS:', sorted(names))
        log_event(logging.INFO, 'supabase_storage_verified', buckets=sorted(names))
        return names
    except Exception as exc:
        claims = _supabase_key_claims(settings.supabase_key)
        print(
            'SUPABASE STORAGE BUCKET LISTING FAILED:',
            {
                'error': str(exc),
                'error_type': type(exc).__name__,
                'supabase_url_prefix': _preview(settings.supabase_url, 32),
                'supabase_url_project_ref': _project_ref_from_url(settings.supabase_url),
                'supabase_key_loaded': bool(settings.supabase_key),
                'supabase_key_role': claims.get('role'),
                'using_anon_key': claims.get('role') == 'anon',
                'message': (
                    'Bucket listing generally requires a service_role key; '
                    'the anon key may be unable to list buckets even when they exist.'
                ),
            },
        )
        log_event(
            logging.ERROR,
            'supabase_storage_bucket_listing_failed',
            error=str(exc),
            error_type=type(exc).__name__,
            supabase_url_prefix=_preview(settings.supabase_url, 32),
            supabase_url_project_ref=_project_ref_from_url(settings.supabase_url),
            supabase_key_loaded=bool(settings.supabase_key),
            supabase_key_role=claims.get('role'),
            using_anon_key=claims.get('role') == 'anon',
            message=(
                'Supabase Storage bucket listing failed. '
                'Bucket listing generally requires a service_role key; '
                'the anon key may be unable to list buckets even when they exist.'
            ),
        )
        raise


def verify_required_buckets() -> dict[str, bool]:
    existing_buckets = list_storage_bucket_names()
    bucket_status = {bucket: bucket in existing_buckets for bucket in REQUIRED_BUCKETS}
    missing = [bucket for bucket, exists in bucket_status.items() if not exists]
    log_event(
        logging.DEBUG,
        'supabase_required_bucket_debug',
        required_buckets=list(REQUIRED_BUCKETS),
        extracted_buckets=sorted(existing_buckets),
        bucket_status=bucket_status,
        missing_buckets=missing,
    )
    print('REQUIRED BUCKETS:', list(REQUIRED_BUCKETS))
    print('MISSING BUCKETS CALCULATION:', missing)

    if missing:
        log_event(
            logging.ERROR,
            'supabase_bucket_verification_failed',
            required_buckets=list(REQUIRED_BUCKETS),
            extracted_buckets=sorted(existing_buckets),
            missing_buckets=missing,
        )
        raise RuntimeError(f'Missing Supabase Storage buckets: {", ".join(missing)}')

    log_event(logging.INFO, 'supabase_buckets_verified', buckets=list(REQUIRED_BUCKETS))
    return bucket_status


def verify_supabase() -> SupabaseHealth:
    _settings_or_raise()
    database_ok = verify_database_connection()
    bucket_status = verify_required_buckets()
    storage_ok = all(bucket_status.values())

    return SupabaseHealth(
        database=database_ok,
        storage=storage_ok,
        supabase=database_ok and storage_ok,
        buckets=bucket_status,
    )


def validate_supabase_startup() -> None:
    import time
    print("[STARTUP-DIAG] -> validate_supabase_startup: entered", flush=True)
    max_attempts = 5
    for attempt in range(max_attempts):
        try:
            print(f"[STARTUP-DIAG] -> validate_supabase_startup: attempt {attempt + 1}/{max_attempts}", flush=True)
            health = verify_supabase()
            log_event(
                logging.INFO,
                'supabase_startup_validation_passed',
                database=health.database,
                storage=health.storage,
                buckets=health.buckets,
            )
            print("[STARTUP-DIAG] -> validate_supabase_startup: validation passed successfully", flush=True)
            return
        except Exception as exc:
            print(f"[STARTUP-DIAG] -> validate_supabase_startup: attempt {attempt + 1} failed: {exc}", flush=True)
            if attempt == max_attempts - 1:
                log_event(logging.CRITICAL, 'supabase_startup_validation_failed', error=str(exc))
                raise
            logger.warning(f"Supabase startup validation attempt {attempt + 1} failed: {exc}. Retrying in 2 seconds...")
            time.sleep(2)


def _verification_png() -> bytes:
    image = Image.new('RGB', (TEST_IMAGE_SIZE, TEST_IMAGE_SIZE), color=(24, 52, 92))
    buffer = BytesIO()
    image.save(buffer, format='PNG')
    return buffer.getvalue()


def _public_url(client: Any, bucket: str, path: str) -> str:
    public_url = client.storage.from_(bucket).get_public_url(path)
    if isinstance(public_url, str):
        return public_url
    if isinstance(public_url, dict):
        return public_url.get('publicURL') or public_url.get('publicUrl') or public_url.get('signedURL') or ''
    return getattr(public_url, 'public_url', None) or getattr(public_url, 'publicURL', None) or str(public_url)


def upload_test_scan(user_id: str) -> dict[str, str]:
    settings = _settings_or_raise()
    if settings.supabase_storage_bucket != 'mri-images':
        raise RuntimeError('SUPABASE_STORAGE_BUCKET must be mri-images for verification uploads')

    verify_required_buckets()

    scan_id = str(uuid4())
    filename = f'{scan_id}.png'
    storage_path = f'verification/{user_id}/{filename}'
    content = _verification_png()
    client = get_storage_client()

    try:
        client.storage.from_('mri-images').upload(
            storage_path,
            content,
            file_options={
                'content-type': 'image/png',
                'x-upsert': 'false',
            },
        )
        uploaded_url = _public_url(client, 'mri-images', storage_path)
        log_event(
            logging.INFO,
            'supabase_test_image_uploaded',
            bucket='mri-images',
            storage_path=storage_path,
            scan_id=scan_id,
        )
    except Exception as exc:
        log_event(logging.ERROR, 'supabase_test_upload_failed', error=str(exc), scan_id=scan_id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail='Failed to upload verification image to Supabase Storage',
        ) from exc

    db = SupabaseDB.initialize()
    conn = db.get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO scans (
                    id, user_id, original_filename, storage_bucket, storage_path,
                    mime_type, size_bytes, width, height, validation, status
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    scan_id,
                    user_id,
                    'supabase-verification.png',
                    'mri-images',
                    storage_path,
                    'image/png',
                    len(content),
                    TEST_IMAGE_SIZE,
                    TEST_IMAGE_SIZE,
                    Json(
                        {
                            'passed': True,
                            'checks': [
                                {
                                    'id': 'supabase_verification',
                                    'label': 'Supabase verification upload',
                                    'status': 'passed',
                                    'message': 'Verification image uploaded and stored using real Supabase services',
                                    'severity': 'info',
                                }
                            ],
                            'original_filename': 'supabase-verification.png',
                        }
                    ),
                    'verification',
                ),
            )
        conn.commit()
        log_event(logging.INFO, 'supabase_test_scan_inserted', scan_id=scan_id, user_id=user_id)
    except Exception as exc:
        conn.rollback()
        log_event(logging.ERROR, 'supabase_test_scan_insert_failed', error=str(exc), scan_id=scan_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Failed to insert verification scan record',
        ) from exc
    finally:
        db.return_connection(conn)

    return {
        'scanId': scan_id,
        'scan_id': scan_id,
        'uploadedUrl': uploaded_url,
        'uploaded_url': uploaded_url,
        'storagePath': storage_path,
        'storage_path': storage_path,
        'timestamp': datetime.now(timezone.utc).isoformat(),
    }
