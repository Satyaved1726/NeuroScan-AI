from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from ..core.database import SupabaseDB
from ..models.schemas import DoctorNoteSchema, UserOut
from ..routers.auth import current_user_dependency
from ..core.rbac import require_roles
from ..models.schemas import Role

router = APIRouter(prefix='/notes', tags=['notes'])

@router.get('/{scan_id}', response_model=List[DoctorNoteSchema])
def get_doctor_notes(scan_id: str, user: UserOut = Depends(current_user_dependency)):
    db = SupabaseDB.initialize()
    conn = db.get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT n.id, n.scan_id, n.doctor_id, u.full_name AS doctor_name, n.title, n.note, n.severity, n.created_at
            FROM doctor_notes n
            JOIN users u ON n.doctor_id = u.id
            WHERE n.scan_id = %s
            ORDER BY n.created_at DESC
            """,
            (scan_id,)
        )
        rows = cursor.fetchall()
        notes = []
        for r in rows:
            notes.append(
                DoctorNoteSchema(
                    id=str(r[0]),
                    scan_id=str(r[1]),
                    doctor_id=str(r[2]),
                    doctor_name=r[3],
                    title=r[4],
                    note=r[5],
                    severity=r[6],
                    created_at=r[7].isoformat() if r[7] else None
                )
            )
        return notes
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )
    finally:
        cursor.close()
        db.return_connection(conn)

@router.post('', response_model=DoctorNoteSchema)
def add_doctor_note(payload: DoctorNoteSchema, user: UserOut = Depends(require_roles(Role.doctor, Role.admin))):
    db = SupabaseDB.initialize()
    conn = db.get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            INSERT INTO doctor_notes (scan_id, doctor_id, title, note, severity)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, scan_id, doctor_id, title, note, severity, created_at
            """,
            (payload.scan_id, user.id, payload.title, payload.note, payload.severity)
        )
        r = cursor.fetchone()

        import json
        try:
            cursor.execute(
                """
                INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
                VALUES (%s, 'doctor_note_added', 'note', %s, %s)
                """,
                (
                    user.id,
                    str(r[0]),
                    json.dumps({
                        'scan_id': payload.scan_id,
                        'severity': payload.severity,
                        'title': payload.title
                    })
                )
            )
        except Exception as audit_err:
            print(f"Failed to write note audit log: {audit_err}")

        conn.commit()
        return DoctorNoteSchema(
            id=str(r[0]),
            scan_id=str(r[1]),
            doctor_id=str(r[2]),
            doctor_name=user.full_name,
            title=r[3],
            note=r[4],
            severity=r[5],
            created_at=r[6].isoformat() if r[6] else None
        )
    except Exception as e:
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )
    finally:
        cursor.close()
        db.return_connection(conn)
