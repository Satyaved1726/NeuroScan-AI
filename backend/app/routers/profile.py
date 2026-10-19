from io import BytesIO
from pathlib import Path
from uuid import uuid4
import logging

from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, status
from PIL import Image, UnidentifiedImageError
from supabase import create_client

from ..models.schemas import PatientProfileCreate, PatientProfileOut, PatientProfileUpdate, UserOut
from ..routers.auth import current_user_dependency
from ..core.config import get_settings
from ..services.store import get_store

router = APIRouter(prefix='/profile', tags=['profile'])
logger = logging.getLogger(__name__)

PROFILE_PHOTO_TYPES = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
}
MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024


def _storage_client():
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail='Supabase Storage is not configured',
        )
    return create_client(settings.supabase_url, settings.supabase_key)


def _profile_photo_content_type(file: UploadFile) -> str:
    content_type = file.content_type or ''
    if content_type in PROFILE_PHOTO_TYPES:
        return content_type

    suffix = Path(file.filename or '').suffix.lower()
    if suffix in ('.jpg', '.jpeg'):
        return 'image/jpeg'
    if suffix == '.png':
        return 'image/png'
    if suffix == '.webp':
        return 'image/webp'
    return content_type or 'application/octet-stream'


def _validate_profile_photo(content: bytes, content_type: str) -> None:
    if content_type not in PROFILE_PHOTO_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail='Only JPG, PNG, or WebP profile photos are supported',
        )
    if not 0 < len(content) <= MAX_PROFILE_PHOTO_BYTES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail='Profile photo must be smaller than 5 MB',
        )
    try:
        image = Image.open(BytesIO(content))
        image.verify()
        image = Image.open(BytesIO(content))
        image.load()
        width, height = image.size
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail='Profile photo is corrupt or unreadable',
        ) from exc

    if width < 128 or height < 128:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail='Profile photo must be at least 128 x 128 pixels',
        )


def _delete_profile_photo(path: str | None) -> None:
    if not path:
        return
    settings = get_settings()
    try:
        _storage_client().storage.from_(settings.supabase_storage_bucket).remove([path])
    except Exception:
        logger.warning('Failed to delete profile photo from Supabase Storage', exc_info=True)


DEFAULT_SIGNED_URL_EXPIRY_SECONDS = 86400  # 24 hours


def _signed_storage_url(path: str, expires_in: int = DEFAULT_SIGNED_URL_EXPIRY_SECONDS) -> str:
    settings = get_settings()
    try:
        res = _storage_client().storage.from_(settings.supabase_storage_bucket).create_signed_url(path, expires_in)
    except Exception as exc:
        logger.error("Failed to generate signed URL for profile photo (%s): %s", path, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail='Failed to generate secure signed URL for profile photo',
        ) from exc

    signed_url = None
    if isinstance(res, dict):
        signed_url = res.get('signedURL') or res.get('signedUrl')

    if not isinstance(signed_url, str) or not signed_url:
        logger.error("Supabase Storage returned invalid signed URL payload for profile photo %s: %s", path, res)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail='Supabase did not return a valid signed profile photo URL',
        )
    return signed_url


# Preserve backward-compatible alias
_public_storage_url = _signed_storage_url


@router.get('', response_model=PatientProfileOut | None)
def get_profile(user: UserOut = Depends(current_user_dependency)):
    profile = get_store().get_patient_profile(user.id)
    if not profile:
        return None
    return PatientProfileOut(**profile)


@router.post('', response_model=PatientProfileOut, status_code=status.HTTP_201_CREATED)
def create_profile(payload: PatientProfileCreate, user: UserOut = Depends(current_user_dependency)):
    store = get_store()
    if store.get_patient_profile(user.id):
        profile = store.update_patient_profile(user.id, payload.model_dump(exclude_unset=True))
        if profile:
            return PatientProfileOut(**profile)
    try:
        profile = store.create_patient_profile(user.id, payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return PatientProfileOut(**profile)


@router.put('', response_model=PatientProfileOut)
def update_profile(payload: PatientProfileUpdate, user: UserOut = Depends(current_user_dependency)):
    store = get_store()
    try:
        data = payload.model_dump(exclude_unset=True)
        profile = store.update_patient_profile(user.id, data)
        if not profile:
            if not data.get('full_name'):
                data['full_name'] = user.full_name or 'Patient Profile'
            profile = store.create_patient_profile(user.id, data)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Patient profile not found')
    return PatientProfileOut(**profile)


@router.post('/photo', response_model=PatientProfileOut)
async def upload_profile_photo(file: UploadFile, user: UserOut = Depends(current_user_dependency)):
    from fastapi.concurrency import run_in_threadpool
    store = get_store()

    profile = await run_in_threadpool(store.get_patient_profile, user.id)
    if not profile:
        profile = await run_in_threadpool(store.create_patient_profile, user.id, {'full_name': user.full_name})

    content = await file.read()
    content_type = _profile_photo_content_type(file)
    _validate_profile_photo(content, content_type)

    settings = get_settings()
    extension = PROFILE_PHOTO_TYPES[content_type]
    storage_path = f'profile-photos/{user.id}/{uuid4().hex}{extension}'

    def upload_photo():
        _storage_client().storage.from_(settings.supabase_storage_bucket).upload(
            storage_path,
            content,
            file_options={
                'content-type': content_type,
                'x-upsert': 'false',
            },
        )

    try:
        await run_in_threadpool(upload_photo)
    except Exception as exc:
        logger.error('Failed to upload profile photo to Supabase Storage: %s', exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail='Failed to upload profile photo to Supabase Storage',
        ) from exc

    photo_url = await run_in_threadpool(_public_storage_url, storage_path)
    updated_profile = await run_in_threadpool(
        store.update_patient_profile,
        user.id,
        {
            'photo_url': photo_url,
            'photo_storage_path': storage_path,
        },
    )

    old_path = profile.get('photo_storage_path')
    if old_path:
        await run_in_threadpool(_delete_profile_photo, old_path)

    return PatientProfileOut(**updated_profile)


@router.delete('/photo', response_model=PatientProfileOut)
def delete_profile_photo(user: UserOut = Depends(current_user_dependency)):
    store = get_store()
    profile = store.get_patient_profile(user.id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Patient profile not found')

    _delete_profile_photo(profile.get('photo_storage_path'))
    updated_profile = store.update_patient_profile(
        user.id,
        {
            'photo_url': None,
            'photo_storage_path': None,
        },
    )
    return PatientProfileOut(**updated_profile)


@router.delete('', status_code=status.HTTP_204_NO_CONTENT)
def delete_profile(user: UserOut = Depends(current_user_dependency)):
    deleted = get_store().delete_patient_profile(user.id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Patient profile not found')
    return Response(status_code=status.HTTP_204_NO_CONTENT)
