from fastapi import APIRouter, Depends, HTTPException, status

from ..models.schemas import DashboardSummary, DoctorDashboardSummary, Role, UserOut
from ..routers.auth import current_user_dependency
from ..core.rbac import require_roles
from ..services.store import store

router = APIRouter(prefix='/dashboard', tags=['dashboard'])


@router.get('/summary', response_model=DashboardSummary)
def summary(user: UserOut = Depends(current_user_dependency)):
    try:
        return DashboardSummary(**store.summary(user.id))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail='Dashboard metrics could not be loaded from backend prediction records',
        ) from exc


@router.get('/doctor', response_model=DoctorDashboardSummary)
def doctor_dashboard_summary(user: UserOut = Depends(require_roles(Role.doctor, Role.admin))):
    """Aggregate authorized clinical metrics for the authenticated clinician."""
    try:
        return DoctorDashboardSummary(**store.get_doctor_summary(user.id))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f'Doctor dashboard metrics could not be loaded: {exc}',
        ) from exc
