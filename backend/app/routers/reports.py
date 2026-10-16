from __future__ import annotations

from datetime import datetime
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from supabase import create_client

from ..core.config import get_settings
from ..models.schemas import AnalysisResult, ReportMeta, UserOut
from ..routers.auth import current_user_dependency
from ..services.report import build_pdf_report, fetch_report_image
from ..services.store import store

logger = logging.getLogger(__name__)

router = APIRouter(prefix='/reports', tags=['reports'])


def _analysis_result_from_report(report) -> AnalysisResult:
    return AnalysisResult(
        scan_id=report.scan_id,
        prediction=report.prediction,
        confidence=report.confidence,
        risk_score=report.risk_score,
        risk_category=report.risk_category,
        scan_quality=[],
        probabilities=report.probabilities,
        explanation=report.explanation,
        summary=report.explanation,
        recommendations=report.recommendations,
        timestamp=report.created_at,
        report_id=report.report_id,
        original_image_url=report.original_image_url,
        heatmap_url=report.heatmap_url,
    )


def _build_user_pdf(user: UserOut, report) -> bytes:
    target_user_id = report.user_id if report.user_id else user.id
    patient_user = store.get_user_by_id(target_user_id) if target_user_id != user.id else user
    if not patient_user:
        patient_user = user
    patient_profile = store.get_patient_profile(target_user_id)
    profile_photo_bytes = fetch_report_image(patient_profile.get('photo_url') if patient_profile else None)
    return build_pdf_report(
        patient_user,
        _analysis_result_from_report(report),
        patient_profile=patient_profile,
        profile_photo_bytes=profile_photo_bytes,
        scan_image_bytes=fetch_report_image(report.original_image_url),
        heatmap_image_bytes=fetch_report_image(report.heatmap_url),
    )


@router.get('', response_model=list[ReportMeta])
def list_reports(
    q: str | None = Query(default=None, description='Search by report id, patient, or prediction'),
    prediction: str | None = Query(default=None),
    report_status: str | None = Query(default=None, alias='status'),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=2000),
    offset: int = Query(default=0, ge=0),
    user: UserOut = Depends(current_user_dependency),
):
    reports = store.list_reports(
        user.id,
        q,
        status=report_status,
        prediction=prediction,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
        offset=offset,
    )
    return [
        ReportMeta(
            id=report['id'],
            report_id=report['report_id'],
            scan_id=report['scan_id'],
            patient_name=report['patient_name'],
            prediction=report['prediction'],
            confidence=report['confidence'],
            risk_score=report['risk_score'],
            created_at=report['created_at'],
            status=report['status'],
            report_url=report['report_url'],
            original_image_url=report.get('original_image_url'),
            heatmap_url=report['heatmap_url'],
        )
        for report in reports
    ]


@router.delete('/{report_row_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_report(report_row_id: str, user: UserOut = Depends(current_user_dependency)):
    deleted = store.delete_report(report_row_id, user.id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Report not found')
    return Response(status_code=status.HTTP_204_NO_CONTENT)


_supabase_client = None

def _get_supabase_client():
    global _supabase_client
    if _supabase_client is None:
        settings = get_settings()
        _supabase_client = create_client(settings.supabase_url, settings.supabase_key)
    return _supabase_client


def _get_pdf_bytes_cached(user: UserOut, report) -> bytes:
    bucket = 'reports'
    storage_user_id = report.user_id or user.id
    storage_path = f'{storage_user_id}/{report.report_id}.pdf'
    try:
        client = _get_supabase_client()
        pdf_bytes = client.storage.from_(bucket).download(storage_path)
        logger.info(f"Serving cached PDF report {report.report_id} from Supabase Storage")
        return pdf_bytes
    except Exception as e:
        logger.info(f"Report {report.report_id} not found in Supabase Storage ({e}). Generating on the fly...")
        pdf_bytes = _build_user_pdf(user, report)
        try:
            client = _get_supabase_client()
            client.storage.from_(bucket).upload(
                storage_path,
                pdf_bytes,
                file_options={'content-type': 'application/pdf', 'x-upsert': 'true'}
            )
        except Exception as upload_err:
            logger.warning(f"Failed to cache compiled PDF: {upload_err}")
        return pdf_bytes


@router.get('/latest')
def latest_report(user: UserOut = Depends(current_user_dependency)):
    report = store.get_latest(user.id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='No report available')

    pdf_bytes = _get_pdf_bytes_cached(user, report)
    return Response(
        content=pdf_bytes,
        media_type='application/pdf',
        headers={'Content-Disposition': 'attachment; filename=neuroscan-report.pdf'},
    )


@router.get('/{report_id}')
def get_report(report_id: str, user: UserOut = Depends(current_user_dependency)):
    report = store.get_report(report_id, user.id, requesting_role=user.role.value)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Report not found')

    # Fetch patient name truthfully
    patient_name = user.full_name
    if report.user_id and report.user_id != user.id:
        patient_user = store.get_user_by_id(report.user_id)
        if patient_user:
            patient_name = patient_user.full_name

    return ReportMeta(
        id=report.id,
        report_id=report.report_id,
        scan_id=report.scan_id,
        patient_name=patient_name,
        prediction=report.prediction,
        confidence=report.confidence,
        risk_score=report.risk_score,
        created_at=report.created_at,
        status='generated',
        report_url=report.report_url,
        original_image_url=report.original_image_url,
        heatmap_url=report.heatmap_url,
    )


@router.get('/{report_id}/pdf')
def download_report_pdf(report_id: str, user: UserOut = Depends(current_user_dependency)):
    report = store.get_report(report_id, user.id, requesting_role=user.role.value)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Report not found')

    pdf_bytes = _get_pdf_bytes_cached(user, report)
    return Response(
        content=pdf_bytes,
        media_type='application/pdf',
        headers={
            'Content-Disposition': f'attachment; filename=neuroscan-report-{report_id}.pdf',
        },
    )
