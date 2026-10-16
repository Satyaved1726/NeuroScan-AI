from __future__ import annotations

from datetime import datetime
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..core.rbac import require_roles
from ..models.schemas import (
    ClinicalQueueItem,
    ClinicalReviewRequest,
    ClinicalReviewResponse,
    DoctorPatientAssignmentCreate,
    DoctorPatientAssignmentOut,
    PatientWorklistItem,
    Role,
    UserOut,
)
from ..routers.auth import current_user_dependency
from ..services.store import store

logger = logging.getLogger(__name__)

router = APIRouter(prefix='/clinical', tags=['clinical'])


@router.get('/queue', response_model=list[ClinicalQueueItem])
def get_clinical_queue(
    status_filter: str | None = Query(default=None, alias='status'),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    q: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: UserOut = Depends(require_roles(Role.doctor, Role.admin)),
):
    """Retrieve scans awaiting clinician review or filter by review status."""
    try:
        doctor_id = user.id if user.role == Role.doctor else None
        items = store.list_clinical_queue(
            doctor_id=doctor_id,
            status_filter=status_filter,
            date_from=date_from,
            date_to=date_to,
            search=q,
            limit=limit,
            offset=offset,
        )
        return [ClinicalQueueItem(**item) for item in items]
    except Exception as exc:
        logger.error(f"Error fetching clinical queue: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve clinical review queue",
        ) from exc


@router.get('/patients', response_model=list[PatientWorklistItem])
def get_patient_worklist(
    q: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: UserOut = Depends(require_roles(Role.doctor, Role.admin)),
):
    """List patients actively assigned to the authenticated clinician."""
    try:
        items = store.list_patient_worklist(
            doctor_id=user.id,
            search=q,
            limit=limit,
            offset=offset,
        )
        return [PatientWorklistItem(**item) for item in items]
    except Exception as exc:
        logger.error(f"Error fetching patient worklist: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve patient worklist",
        ) from exc


@router.post('/scans/{scan_id}/review', response_model=ClinicalReviewResponse)
def submit_clinical_review(
    scan_id: str,
    payload: ClinicalReviewRequest,
    user: UserOut = Depends(require_roles(Role.doctor, Role.admin)),
):
    """Submit clinical review for a scan with timestamp, reviewer identity, and notes."""
    # Verify permission to review scan
    if not store.can_user_access_scan(user.id, user.role.value, scan_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to review this scan",
        )

    valid_statuses = ('reviewed', 'requires_retest', 'awaiting_review')
    if payload.review_status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid review status. Must be one of: {', '.join(valid_statuses)}",
        )

    try:
        review_result = store.record_clinical_review(
            scan_id=scan_id,
            doctor_id=user.id,
            review_status=payload.review_status,
            review_notes=payload.notes,
        )
        return ClinicalReviewResponse(**review_result)
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(val_err),
        ) from val_err
    except Exception as exc:
        logger.error(f"Failed to submit clinical review: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to record clinical review",
        ) from exc


@router.post('/assignments', response_model=DoctorPatientAssignmentOut)
def assign_clinician(
    payload: DoctorPatientAssignmentCreate,
    user: UserOut = Depends(require_roles(Role.doctor, Role.admin)),
):
    """Assign a patient to a clinician."""
    try:
        result = store.assign_patient_to_doctor(
            doctor_id=payload.doctor_id,
            patient_id=payload.patient_id,
            assigned_by=user.id,
        )
        return DoctorPatientAssignmentOut(**result)
    except Exception as exc:
        logger.error(f"Failed to assign clinician: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create clinician assignment",
        ) from exc


@router.get('/assignments/patient/{patient_id}', response_model=DoctorPatientAssignmentOut | None)
def get_patient_assignment(
    patient_id: str,
    user: UserOut = Depends(current_user_dependency),
):
    """Fetch assigned clinician for a patient. Enforces patient or clinician identity check."""
    if user.role == Role.user and user.id != patient_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own clinician assignment",
        )

    assignment = store.get_assigned_doctor(patient_id)
    if not assignment:
        return None
    return DoctorPatientAssignmentOut(**assignment)
