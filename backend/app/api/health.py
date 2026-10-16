from datetime import datetime, timezone
import logging

from fastapi import APIRouter, Depends, HTTPException, status

from ..models.schemas import UserOut
from ..routers.auth import current_user_dependency
from ..services.supabase_verification import log_event, upload_test_scan, verify_supabase

router = APIRouter(tags=['health'])
logger = logging.getLogger(__name__)


@router.get('/health')
def health():
    try:
        supabase_health = verify_supabase()
        return {
            'status': 'healthy',
            'database': supabase_health.database,
            'storage': supabase_health.storage,
            'supabase': supabase_health.supabase,
            'timestamp': datetime.now(timezone.utc).isoformat(),
        }
    except Exception as exc:
        log_event(logging.ERROR, 'health_check_failed', error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail='Supabase health check failed',
        ) from exc


@router.post('/test/upload')
def test_upload(user: UserOut = Depends(current_user_dependency)):
    result = upload_test_scan(user.id)
    log_event(logging.INFO, 'test_upload_completed', scan_id=result['scanId'], user_id=user.id)
    return result
