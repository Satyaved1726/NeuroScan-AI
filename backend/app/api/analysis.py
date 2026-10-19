from __future__ import annotations

from datetime import datetime, timezone
import logging
from time import perf_counter
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from psycopg2.extras import Json, RealDictCursor
from supabase import create_client

from ..ai.inference import MRIInferenceError, get_model_service
from ..core.config import get_settings
from ..core.database import SupabaseDB
from ..models.schemas import AnalysisPredictionResponse, UserOut
from ..routers.auth import current_user_dependency
from ..services.store import get_store

logger = logging.getLogger(__name__)

router = APIRouter(prefix='/analysis', tags=['analysis'])


@router.post('/predict/{scanId}', response_model=AnalysisPredictionResponse)
def predict_scan(
    scanId: str,
    background_tasks: BackgroundTasks,
    user: UserOut = Depends(current_user_dependency),
):
    total_started_at = perf_counter()
    logger.info('analysis_prediction_requested', extra={'scan_id': scanId, 'user_id': user.id})

    stage_started_at = perf_counter()
    scan = _get_scan(scanId, user.id)
    scan_lookup_ms = _elapsed_ms(stage_started_at)

    stage_started_at = perf_counter()
    image_bytes = _download_scan_image(scan)
    image_download_ms = _elapsed_ms(stage_started_at)

    try:
        stage_started_at = perf_counter()
        prediction = get_model_service().predict(image_bytes)
        inference_total_ms = _elapsed_ms(stage_started_at)
    except MRIInferenceError as exc:
        logger.exception('analysis_model_inference_failed', extra={'scan_id': scanId, 'user_id': user.id})
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception('analysis_model_unexpected_error', extra={'scan_id': scanId, 'user_id': user.id})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Model inference failed',
        ) from exc
    finally:
        del image_bytes

    stage_started_at = perf_counter()
    result_id = str(uuid4())
    report_id = f'RPT-{uuid4().hex[:4].upper()}'
    created_at = datetime.now(timezone.utc)
    summary = _build_summary(prediction.prediction, prediction.confidence, prediction.risk_score)
    recommendations = _build_recommendations(prediction.prediction)
    report_generation_ms = _elapsed_ms(stage_started_at)

    stage_started_at = perf_counter()
    patient_profile = _patient_profile_summary(user.id)
    patient_profile_ms = _elapsed_ms(stage_started_at)

    stage_started_at = perf_counter()
    report_id = _save_analysis_result(
        result_id=result_id,
        scan=scan,
        prediction=prediction.prediction,
        confidence=prediction.confidence,
        risk_score=prediction.risk_score,
        risk_category=prediction.risk_category,
        probabilities=prediction.probabilities,
        summary=summary,
        recommendations=recommendations,
        report_id=report_id,
        created_at=created_at,
    )
    database_save_ms = _elapsed_ms(stage_started_at)
    total_ms = _elapsed_ms(total_started_at)
    logger.info(
        'analysis_prediction_completed',
        extra={
            'scan_id': scanId,
            'user_id': user.id,
            'prediction': prediction.prediction,
            'confidence': prediction.confidence,
            'risk_score': prediction.risk_score,
            'scan_lookup_ms': scan_lookup_ms,
            'image_download_ms': image_download_ms,
            'inference_total_ms': inference_total_ms,
            'model_load_ms': prediction.timing_ms.get('model_load_ms', 0.0),
            'model_preprocess_ms': prediction.timing_ms.get('preprocess_ms', 0.0),
            'model_inference_ms': prediction.timing_ms.get('inference_ms', 0.0),
            'report_generation_ms': report_generation_ms,
            'patient_profile_ms': patient_profile_ms,
            'database_save_ms': database_save_ms,
            'total_ms': total_ms,
        },
    )

    # Queue background PDF report generation
    from ..services.report import generate_and_upload_report_task
    analysis_result_dict = {
        "scan_id": scanId,
        "prediction": prediction.prediction,
        "confidence": prediction.confidence,
        "risk_score": prediction.risk_score,
        "risk_category": prediction.risk_category,
        "probabilities": prediction.probabilities,
        "explanation": summary,
        "recommendations": recommendations,
        "original_image_url": _scan_image_url(scan),
        "heatmap_url": None,
    }
    background_tasks.add_task(
        generate_and_upload_report_task,
        user=user,
        report_id=report_id,
        analysis_result_dict=analysis_result_dict,
    )

    return AnalysisPredictionResponse(
        scanId=scanId,
        scan_id=scanId,
        prediction=prediction.prediction,
        confidence=prediction.confidence,
        risk_score=prediction.risk_score,
        risk_category=prediction.risk_category,
        probabilities=prediction.probabilities,
        timestamp=created_at,
        report_id=report_id,
        original_image_url=_scan_image_url(scan),
        summary=summary,
        recommendations=recommendations,
        model_version='dementia_model.keras',
        image_quality='Validated MRI upload',
        patient_profile=patient_profile,
        timing_ms={
            'model_load_ms': prediction.timing_ms.get('model_load_ms', 0.0),
            'preprocess_ms': prediction.timing_ms.get('preprocess_ms', 0.0),
            'inference_ms': prediction.timing_ms.get('inference_ms', 0.0),
            'inference_total_ms': inference_total_ms,
            'report_generation_ms': report_generation_ms,
            'database_save_ms': database_save_ms,
            'total_ms': total_ms,
        },
    )


def _elapsed_ms(started_at: float) -> float:
    return round((perf_counter() - started_at) * 1000, 2)


def _build_summary(prediction: str, confidence: float, risk_score: int) -> str:
    return (
        f'The MRI scan demonstrates imaging patterns associated with {prediction}. '
        f'The model confidence is {confidence:.1f}%. '
        f'The estimated risk score is {risk_score}/100. '
        'Findings suggest the need for clinical correlation with cognitive testing, patient history, and specialist review.'
    )


def _build_recommendations(prediction: str) -> dict[str, list[str]]:
    normalized = prediction.replace(' ', '')
    base = {
        'Medical': ['Review this AI-assisted result with a qualified clinician before making clinical decisions.'],
        'Lifestyle': ['Maintain consistent sleep, daily structure, and vascular risk management.'],
        'Nutrition': ['Discuss a balanced heart-healthy diet with the care team.'],
        'Exercise': ['Use clinician-approved physical activity matched to mobility and safety.'],
        'Mental Health': ['Monitor mood, anxiety, sleep, and caregiver stress.'],
        'Follow-Up': ['Keep this report with prior imaging for longitudinal comparison.'],
    }
    if normalized == 'NonDemented':
        base['Medical'].append('Continue routine cognitive screening based on age and symptoms.')
        base['Follow-Up'].append('Seek review if new memory, language, or functional symptoms appear.')
    elif normalized == 'VeryMildDemented':
        base['Medical'].append('Consider outpatient cognitive evaluation and reversible-cause review.')
        base['Follow-Up'].append('Track symptoms and compare against prior MRI studies when available.')
    elif normalized == 'MildDemented':
        base['Medical'].append('Arrange neurology consultation and structured neuropsychological assessment.')
        base['Lifestyle'].append('Use reminders, medication organization, and caregiver-supported routines.')
    elif normalized == 'ModerateDemented':
        base['Medical'].append('Prioritize neurological consultation and multidisciplinary care planning.')
        base['Follow-Up'].append('Assess safety, daily function, caregiver support, and medication adherence promptly.')
    return base


def _patient_profile_summary(user_id: str) -> dict[str, str | int | None] | None:
    profile = get_store().get_patient_profile(user_id)
    if not profile:
        return None
    return {
        'patient_name': profile.get('full_name'),
        'patient_id': profile.get('patient_id'),
        'age': profile.get('age'),
        'gender': profile.get('gender'),
        'blood_group': profile.get('blood_group'),
    }


def _get_scan(scan_id: str, user_id: str) -> dict:
    db = SupabaseDB.initialize()
    conn = db.get_connection()
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(
            """
            SELECT id, user_id, image_url, storage_bucket, storage_path, status
            FROM scans
            WHERE id = %s AND user_id = %s
            """,
            (scan_id, user_id),
        )
        scan = cursor.fetchone()
    except Exception as exc:
        logger.exception('analysis_scan_lookup_failed', extra={'scan_id': scan_id, 'user_id': user_id})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Failed to retrieve scan metadata',
        ) from exc
    finally:
        cursor.close()
        db.return_connection(conn)

    if not scan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Scan not found')
    return dict(scan)


def _scan_image_url(scan: dict) -> str | None:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_key:
        return scan.get('image_url')

    from ..core.storage_urls import refresh_or_create_signed_url
    client = create_client(settings.supabase_url, settings.supabase_key)
    bucket = scan.get('storage_bucket') or settings.supabase_storage_bucket
    target = scan.get('storage_path') or scan.get('image_url')
    return refresh_or_create_signed_url(client, target, bucket)


def _download_scan_image(scan: dict) -> bytes:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail='Supabase Storage is not configured',
        )

    bucket = scan.get('storage_bucket') or settings.supabase_storage_bucket
    storage_path = scan.get('storage_path')
    if not storage_path:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail='Scan has no storage path')

    try:
        client = create_client(settings.supabase_url, settings.supabase_key)
        content = client.storage.from_(bucket).download(storage_path)
    except Exception as exc:
        logger.exception(
            'analysis_storage_download_failed',
            extra={'scan_id': str(scan.get('id')), 'bucket': bucket, 'storage_path': storage_path},
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail='Failed to download MRI image from Supabase Storage',
        ) from exc

    if not isinstance(content, bytes) or not content:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail='Downloaded MRI image is empty',
        )
    return content


def _save_analysis_result(
    *,
    result_id: str,
    scan: dict,
    prediction: str,
    confidence: float,
    risk_score: int,
    risk_category: str,
    probabilities: dict[str, float],
    summary: str,
    recommendations: dict[str, list[str]],
    report_id: str,
    created_at: datetime,
) -> str:
    db = SupabaseDB.initialize()
    conn = db.get_connection()
    scan_id = str(scan['id'])
    user_id = str(scan['user_id'])
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO analysis_results (
                id, scan_id, user_id, prediction, confidence, risk_score,
                risk_category, probabilities, model_name, model_accuracy, summary, created_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (scan_id) DO UPDATE SET
                prediction = EXCLUDED.prediction,
                confidence = EXCLUDED.confidence,
                risk_score = EXCLUDED.risk_score,
                risk_category = EXCLUDED.risk_category,
                probabilities = EXCLUDED.probabilities,
                model_name = EXCLUDED.model_name,
                model_accuracy = EXCLUDED.model_accuracy,
                summary = EXCLUDED.summary,
                created_at = EXCLUDED.created_at
            """,
            (
                result_id,
                scan_id,
                user_id,
                prediction,
                confidence,
                risk_score,
                risk_category,
                Json(probabilities),
                'dementia_model.keras',
                None,
                summary,
                created_at,
            ),
        )
        cursor.execute(
            """
            INSERT INTO analysis_history (
                id, user_id, scan_id, prediction, confidence, risk_score,
                risk_category, probabilities, explanation, recommendations, report_id, created_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                str(uuid4()),
                user_id,
                scan_id,
                prediction,
                confidence,
                risk_score,
                risk_category,
                Json(probabilities),
                summary,
                Json(recommendations),
                report_id,
                created_at,
            ),
        )
        cursor.execute(
            """
            INSERT INTO reports (user_id, scan_id, report_url, storage_bucket, storage_path, status, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                user_id,
                scan_id,
                f'/api/v1/reports/{report_id}/pdf',
                'reports',
                f'{user_id}/{report_id}.pdf',
                'generated',
                created_at,
            ),
        )
        cursor.execute(
            """
            INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                user_id,
                'analysis_prediction_saved',
                'scan',
                scan_id,
                Json({'report_id': report_id, 'prediction': prediction}),
            ),
        )
        cursor.execute(
            """
            UPDATE scans
            SET status = %s
            WHERE id = %s
            """,
            ('analyzed', scan_id),
        )
        conn.commit()
        return report_id
    except Exception as exc:
        conn.rollback()
        logger.exception('analysis_result_save_failed', extra={'scan_id': scan_id, 'user_id': user_id})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Failed to save analysis result',
        ) from exc
    finally:
        cursor.close()
        db.return_connection(conn)
