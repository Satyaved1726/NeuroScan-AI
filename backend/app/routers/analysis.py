from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, Response, UploadFile, status

from ..api.analysis import predict_scan
from ..models.schemas import AnalysisPredictionResponse, AnalysisResult, ScanHistoryItem, ScanHistoryPage, UserOut
from ..routers.auth import current_user_dependency
from ..services.mri_upload import upload_mri_scan
from ..services.store import store

router = APIRouter(prefix='/analysis', tags=['analysis'])


@router.post('/upload', response_model=AnalysisPredictionResponse)
async def upload_scan(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    user: UserOut = Depends(current_user_dependency),
):
    upload = await upload_mri_scan(file, user.id)
    return predict_scan(upload.scan_id, background_tasks, user)


@router.get('/history', response_model=ScanHistoryPage)
def history(
    q: str | None = Query(default=None, description='Search by scan, report, prediction, or risk'),
    prediction: str | None = Query(default=None),
    risk: str | None = Query(default=None),
    report_status: str | None = Query(default=None, alias='status'),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    sort_by: str = Query(default='date', pattern='^(date|prediction|confidence|risk|report)$'),
    sort_dir: str = Query(default='desc', pattern='^(asc|desc)$'),
    limit: int = Query(default=20, ge=1, le=2000),
    offset: int = Query(default=0, ge=0),
    user: UserOut = Depends(current_user_dependency),
):
    records = store.list_history(
        user.id,
        search=q,
        prediction=prediction,
        risk=risk,
        status=report_status,
        date_from=date_from,
        date_to=date_to,
        sort_by=sort_by,
        sort_dir=sort_dir,
        limit=limit,
        offset=offset,
    )
    total = store.count_history(
        user.id,
        search=q,
        prediction=prediction,
        risk=risk,
        status=report_status,
        date_from=date_from,
        date_to=date_to,
    )
    items = [
        ScanHistoryItem(
            id=record.id,
            scan_id=record.scan_id,
            thumbnail_url=record.original_image_url,
            patient_name=record.patient_name,
            date=record.created_at,
            prediction=record.prediction,
            confidence=record.confidence,
            risk=record.risk_category,
            status=record.status,
            report_id=record.report_id,
            report_url=record.report_url,
            heatmap_url=record.heatmap_url,
        )
        for record in records
    ]
    return ScanHistoryPage(items=items, total=total, limit=limit, offset=offset)


@router.delete('/history/{history_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_history_item(history_id: str, user: UserOut = Depends(current_user_dependency)):
    deleted = store.delete_history_item(history_id, user.id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='History item not found')
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get('/latest', response_model=AnalysisResult | None)
def latest(user: UserOut = Depends(current_user_dependency)):
    record = store.get_latest(user.id)
    if not record:
        return None
    return AnalysisResult(
        scan_id=record.scan_id,
        prediction=record.prediction,
        confidence=record.confidence,
        risk_score=record.risk_score,
        risk_category=record.risk_category,
        scan_quality=[],
        probabilities=record.probabilities,
        explanation=record.explanation,
        summary=record.explanation,
        recommendations=record.recommendations,
        timestamp=record.created_at,
        report_id=record.report_id,
        original_image_url=record.original_image_url,
        heatmap_url=record.heatmap_url,
        model_version='dementia_model.keras',
        patient_profile=_patient_profile_summary(user.id),
    )


@router.get('/result/{scanId}', response_model=AnalysisResult)
def result(scanId: str, user: UserOut = Depends(current_user_dependency)):
    if not store.can_user_access_scan(user.id, user.role.value, scanId):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this scan result",
        )
    record = store.get_analysis_by_scan_id(scanId, user.id, requesting_role=user.role.value)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan analysis record not found",
        )


    return AnalysisResult(
        scan_id=record.scan_id,
        prediction=record.prediction,
        confidence=record.confidence,
        risk_score=record.risk_score,
        risk_category=record.risk_category,
        scan_quality=[],
        probabilities=record.probabilities,
        explanation=record.explanation,
        summary=record.explanation,
        recommendations=record.recommendations,
        timestamp=record.created_at,
        report_id=record.report_id,
        original_image_url=record.original_image_url,
        heatmap_url=record.heatmap_url,
        model_version='dementia_model.keras',
        patient_profile=_patient_profile_summary(record.user_id),
    )



def _patient_profile_summary(user_id: str) -> dict[str, str | int | None] | None:
    profile = store.get_patient_profile(user_id)
    if not profile:
        return None
    return {
        'patient_name': profile.get('full_name'),
        'patient_id': profile.get('patient_id'),
        'age': profile.get('age'),
        'gender': profile.get('gender'),
        'blood_group': profile.get('blood_group'),
    }
