from fastapi import APIRouter, Depends

from ..core.database import SupabaseDB
from ..core.rbac import require_roles
from ..models.schemas import Role
from ..models.schemas import UserOut
from ..routers.auth import current_user_dependency
from ..services.store import store

router = APIRouter(prefix='/users', tags=['users'])


@router.get('/profile', response_model=UserOut)
def profile(user: UserOut = Depends(current_user_dependency)):
    return user


@router.get('/admin/overview')
def admin_overview(user: UserOut = Depends(require_roles(Role.admin))):
    summary = store.summary()
    db = SupabaseDB.initialize()
    conn = db.get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('SELECT COUNT(*) FROM users')
        total_users = int(cursor.fetchone()[0] or 0)
        cursor.execute('SELECT COUNT(*) FROM reports WHERE status = %s', ('generated',))
        total_reports = int(cursor.fetchone()[0] or 0)
    finally:
        cursor.close()
        db.return_connection(conn)

    return {
        'users': total_users,
        'reports': total_reports,
        'model_performance': round(summary['average_confidence'], 2),
        'dataset_statistics': {
            'total_scans': summary['total_scans'],
            'total_patients': summary['total_patients'],
        },
        'active_sessions': summary['reports_generated'],
    }
