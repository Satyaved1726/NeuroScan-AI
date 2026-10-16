from fastapi import APIRouter, Depends, File, UploadFile

from ..models.schemas import ScanUploadResponse, UserOut
from ..routers.auth import current_user_dependency
from ..services.mri_upload import upload_mri_scan

router = APIRouter(prefix='/mri', tags=['mri'])


@router.post('/upload', response_model=ScanUploadResponse)
async def upload_scan(
    scan_file: UploadFile = File(...),
    user: UserOut = Depends(current_user_dependency),
):
    result = await upload_mri_scan(scan_file, user.id)
    return ScanUploadResponse(
        scanId=result.scan_id,
        scan_id=result.scan_id,
        storage_path=result.storage_path,
        original_image_url=result.image_url,
        width=result.width,
        height=result.height,
        size_bytes=result.size_bytes,
        mime_type=result.mime_type,
        validation=result.validation,
    )
