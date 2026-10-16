from __future__ import annotations

from datetime import datetime, timezone
import logging
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from psycopg2.extras import RealDictCursor
from supabase import create_client

from ..ai.gradcam import GradCAMError, get_gradcam_service
from ..core.config import get_settings
from ..core.database import SupabaseDB
from ..models.schemas import HeatmapResponse, UserOut
from ..routers.auth import current_user_dependency
from .analysis import _download_scan_image, _get_scan

logger = logging.getLogger(__name__)

router = APIRouter(prefix='/analysis', tags=['explainability'])

HEATMAP_BUCKET = 'heatmaps'


@router.post('/heatmap/{scanId}', response_model=HeatmapResponse)
def generate_heatmap(
    scanId: str,
    background_tasks: BackgroundTasks,
    user: UserOut = Depends(current_user_dependency),
):
    logger.info('heatmap_generation_requested', extra={'scan_id': scanId, 'user_id': user.id})
    scan = _get_scan(scanId, user.id)
    analysis = _get_analysis_result(scanId, user.id)
    prediction = str(analysis['prediction'])

    # 1. Caching: Return already generated heatmap if available
    existing_heatmap = analysis.get('heatmap_url')
    if existing_heatmap:
        logger.info('heatmap_cache_hit', extra={'scan_id': scanId, 'user_id': user.id})
        return HeatmapResponse(
            scanId=scanId,
            prediction=prediction,
            heatmapUrl=existing_heatmap,
            status='generated',
        )

    # 2. Download scan image
    image_bytes = _download_scan_image(scan)

    # 3. Generate Grad-CAM targeting the predicted class
    try:
        gradcam_result = get_gradcam_service().generate(image_bytes, target_class=prediction)
    except GradCAMError as exc:
        logger.exception('heatmap_gradcam_failed', extra={'scan_id': scanId, 'user_id': user.id})
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception('heatmap_unexpected_generation_failed', extra={'scan_id': scanId, 'user_id': user.id})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Heatmap generation failed',
        ) from exc
    finally:
        del image_bytes

    storage_path, heatmap_url = _upload_heatmap(
        scan_id=scanId,
        user_id=user.id,
        content=gradcam_result.heatmap_png,
    )
    _save_heatmap_url(
        scan_id=scanId,
        user_id=user.id,
        heatmap_url=heatmap_url,
        heatmap_storage_path=storage_path,
    )

    try:
        from ..services.store import store
        report_meta = store.get_analysis_by_scan_id(scanId, user.id)
        if report_meta and report_meta.report_id:
            analysis_result_dict = {
                "scan_id": scanId,
                "prediction": prediction,
                "confidence": report_meta.confidence,
                "risk_score": report_meta.risk_score,
                "risk_category": report_meta.risk_category,
                "probabilities": report_meta.probabilities,
                "explanation": report_meta.explanation,
                "recommendations": report_meta.recommendations,
                "original_image_url": report_meta.original_image_url,
                "heatmap_url": heatmap_url,
            }
            from ..services.report import generate_and_upload_report_task
            background_tasks.add_task(
                generate_and_upload_report_task,
                user=user,
                report_id=report_meta.report_id,
                analysis_result_dict=analysis_result_dict,
            )
    except Exception as e:
        logger.warning(f"Failed to queue async PDF update after heatmap generation: {e}")

    logger.info(
        'heatmap_generation_completed',
        extra={
            'scan_id': scanId,
            'user_id': user.id,
            'prediction': prediction,
            'heatmap_bucket': HEATMAP_BUCKET,
            'heatmap_storage_path': storage_path,
            'target_layer': gradcam_result.target_layer,
        },
    )
    return HeatmapResponse(
        scanId=scanId,
        prediction=prediction,
        heatmapUrl=heatmap_url,
        status='generated',
    )


def _get_analysis_result(scan_id: str, user_id: str) -> dict:
    db = SupabaseDB.initialize()
    conn = db.get_connection()
    cursor = None
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(
            """
            SELECT id, scan_id, user_id, prediction, heatmap_url
            FROM analysis_results
            WHERE scan_id = %s AND user_id = %s
            """,
            (scan_id, user_id),
        )
        analysis = cursor.fetchone()
    except Exception as exc:
        logger.exception('heatmap_analysis_lookup_failed', extra={'scan_id': scan_id, 'user_id': user_id})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Failed to retrieve analysis result',
        ) from exc
    finally:
        if cursor is not None:
            cursor.close()
        db.return_connection(conn)

    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail='Prediction must be generated before requesting a heatmap',
        )
    return dict(analysis)


def _upload_heatmap(*, scan_id: str, user_id: str, content: bytes) -> tuple[str, str]:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail='Supabase Storage is not configured',
        )

    storage_path = f'{user_id}/{scan_id}/{uuid4().hex}.png'
    client = create_client(settings.supabase_url, settings.supabase_key)
    try:
        client.storage.from_(HEATMAP_BUCKET).upload(
            storage_path,
            content,
            file_options={
                'content-type': 'image/png',
                'x-upsert': 'false',
            },
        )
        heatmap_url = client.storage.from_(HEATMAP_BUCKET).get_public_url(storage_path)
    except Exception as exc:
        logger.exception(
            'heatmap_storage_upload_failed',
            extra={'scan_id': scan_id, 'user_id': user_id, 'bucket': HEATMAP_BUCKET, 'storage_path': storage_path},
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail='Failed to upload heatmap to Supabase Storage',
        ) from exc

    if not isinstance(heatmap_url, str) or not heatmap_url:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail='Supabase did not return a heatmap URL',
        )
    return storage_path, heatmap_url


def _save_heatmap_url(*, scan_id: str, user_id: str, heatmap_url: str, heatmap_storage_path: str) -> None:
    db = SupabaseDB.initialize()
    conn = db.get_connection()
    generated_at = datetime.now(timezone.utc)
    cursor = None
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            UPDATE analysis_results
            SET heatmap_url = %s,
                heatmap_storage_bucket = %s,
                heatmap_storage_path = %s,
                heatmap_generated_at = %s
            WHERE scan_id = %s AND user_id = %s
            """,
            (heatmap_url, HEATMAP_BUCKET, heatmap_storage_path, generated_at, scan_id, user_id),
        )
        if cursor.rowcount != 1:
            raise RuntimeError('Analysis result was not updated')
        conn.commit()
    except Exception as exc:
        conn.rollback()
        logger.exception('heatmap_url_save_failed', extra={'scan_id': scan_id, 'user_id': user_id})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Failed to save heatmap URL',
        ) from exc
    finally:
        if cursor is not None:
            cursor.close()
        db.return_connection(conn)
