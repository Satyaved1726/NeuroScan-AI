from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from uuid import uuid4
import logging

from fastapi import HTTPException, UploadFile, status
from PIL import Image, UnidentifiedImageError
from psycopg2.extras import Json
import supabase

from ..core.config import get_settings
from ..core.database import SupabaseDB

logger = logging.getLogger(__name__)

ALLOWED_IMAGE_TYPES = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
}

ALLOWED_IMAGE_EXTENSIONS = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
}


@dataclass
class MRIUploadResult:
    scan_id: str
    storage_path: str
    image_url: str
    width: int
    height: int
    size_bytes: int
    mime_type: str
    validation: dict


def _validation_check(check_id: str, label: str, passed: bool, message: str) -> dict[str, str]:
    return {
        'id': check_id,
        'label': label,
        'status': 'passed' if passed else 'failed',
        'message': message,
        'severity': 'info' if passed else 'error',
    }


def _normalize_content_type(filename: str, content_type: str | None) -> str:
    if content_type in ALLOWED_IMAGE_TYPES:
        return content_type

    return ALLOWED_IMAGE_EXTENSIONS.get(
        Path(filename).suffix.lower(),
        content_type or 'application/octet-stream',
    )


def validate_mri_image(filename: str, content_type: str | None, content: bytes) -> tuple[int, int, dict]:
    settings = get_settings()
    max_size_bytes = settings.max_mri_upload_mb * 1024 * 1024
    checks: list[dict[str, str]] = []
    normalized_content_type = _normalize_content_type(filename, content_type)

    is_allowed_type = normalized_content_type in ALLOWED_IMAGE_TYPES
    checks.append(
        _validation_check(
            'file_type',
            'File type',
            is_allowed_type,
            'Supported image type' if is_allowed_type else 'Only JPG and PNG MRI images are supported',
        )
    )

    is_allowed_size = 0 < len(content) <= max_size_bytes
    checks.append(
        _validation_check(
            'file_size',
            'File size',
            is_allowed_size,
            f'{len(content) / (1024 * 1024):.2f} MB of {settings.max_mri_upload_mb} MB allowed',
        )
    )

    width = 0
    height = 0
    is_corrupt = False
    try:
        image = Image.open(BytesIO(content))
        image.verify()
        image = Image.open(BytesIO(content))
        image.load()
        width, height = image.size
    except (UnidentifiedImageError, OSError, ValueError):
        is_corrupt = True

    checks.append(
        _validation_check(
            'corruption',
            'Corruption check',
            not is_corrupt,
            'Image can be decoded' if not is_corrupt else 'Image is corrupt or unreadable',
        )
    )

    resolution_ok = not is_corrupt and width >= settings.min_mri_resolution and height >= settings.min_mri_resolution
    checks.append(
        _validation_check(
            'resolution',
            'Resolution',
            resolution_ok,
            f'{width} x {height}px; minimum {settings.min_mri_resolution} x {settings.min_mri_resolution}px',
        )
    )

    passed = all(check['status'] == 'passed' for check in checks)
    validation = {
        'passed': passed,
        'checks': checks,
        'original_filename': Path(filename).name,
    }
    return width, height, validation


_storage_client_instance = None

def _get_storage_client():
    global _storage_client_instance
    if _storage_client_instance is not None:
        return _storage_client_instance
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail='Supabase Storage is not configured',
        )
    _storage_client_instance = supabase.create_client(settings.supabase_url, settings.supabase_key)
    return _storage_client_instance


def _upload_to_storage(path: str, content: bytes, content_type: str) -> None:
    settings = get_settings()
    client = _get_storage_client()
    try:
        client.storage.from_(settings.supabase_storage_bucket).upload(
            path,
            content,
            file_options={
                'content-type': content_type,
                'x-upsert': 'false',
            },
        )
    except Exception as exc:
        logger.error("Failed to upload MRI image to Supabase Storage: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail='Failed to upload MRI image to Supabase Storage',
        ) from exc


DEFAULT_SIGNED_URL_EXPIRY_SECONDS = 86400  # 24 hours


def _signed_storage_url(path: str, expires_in: int = DEFAULT_SIGNED_URL_EXPIRY_SECONDS) -> str:
    settings = get_settings()
    client = _get_storage_client()
    try:
        res = client.storage.from_(settings.supabase_storage_bucket).create_signed_url(path, expires_in)
    except Exception as exc:
        logger.error("Failed to generate signed URL for MRI image (%s): %s", path, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail='Failed to generate secure signed URL for MRI image',
        ) from exc

    signed_url = None
    if isinstance(res, dict):
        signed_url = res.get('signedURL') or res.get('signedUrl')

    if not isinstance(signed_url, str) or not signed_url:
        logger.error("Supabase Storage returned invalid signed URL payload for %s: %s", path, res)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail='Supabase did not return a valid signed MRI image URL',
        )
    return signed_url


# Preserve backward-compatible alias
_public_storage_url = _signed_storage_url


def _insert_scan_metadata(result: MRIUploadResult, user_id: str, original_filename: str) -> None:
    settings = get_settings()
    db = SupabaseDB.initialize()
    conn = db.get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO scans (
                id, user_id, original_filename, image_url, storage_bucket, storage_path,
                mime_type, size_bytes, width, height, validation, status
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                result.scan_id,
                user_id,
                original_filename,
                result.image_url,
                settings.supabase_storage_bucket,
                result.storage_path,
                result.mime_type,
                result.size_bytes,
                result.width,
                result.height,
                Json(result.validation),
                'uploaded',
            ),
        )
        conn.commit()
    except Exception as exc:
        conn.rollback()
        logger.error("Failed to store MRI scan metadata: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Failed to store scan metadata',
        ) from exc
    finally:
        cursor.close()
        db.return_connection(conn)


async def upload_mri_scan(file: UploadFile, user_id: str) -> MRIUploadResult:
    from fastapi.concurrency import run_in_threadpool

    content = await file.read()
    filename = Path(file.filename or 'mri-image').name
    content_type = _normalize_content_type(filename, file.content_type)
    width, height, validation = validate_mri_image(filename, content_type, content)

    if not validation['passed']:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                'message': 'MRI image validation failed',
                'validation': validation,
            },
        )

    scan_id = str(uuid4())
    extension = ALLOWED_IMAGE_TYPES[content_type]
    storage_path = f'{user_id}/{scan_id}{extension}'

    await run_in_threadpool(_upload_to_storage, storage_path, content, content_type)
    image_url = await run_in_threadpool(_signed_storage_url, storage_path)

    result = MRIUploadResult(
        scan_id=scan_id,
        storage_path=storage_path,
        image_url=image_url,
        width=width,
        height=height,
        size_bytes=len(content),
        mime_type=content_type,
        validation=validation,
    )
    await run_in_threadpool(_insert_scan_metadata, result, user_id=user_id, original_filename=filename)
    return result
