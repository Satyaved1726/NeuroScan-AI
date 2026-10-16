from fastapi import APIRouter, Depends, HTTPException, status
from ..core.database import SupabaseDB
from ..models.schemas import UserSettingsSchema, UserOut
from ..routers.auth import current_user_dependency

router = APIRouter(prefix='/settings', tags=['settings'])

@router.get('', response_model=UserSettingsSchema)
def get_user_settings(user: UserOut = Depends(current_user_dependency)):
    db = SupabaseDB.initialize()
    conn = db.get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT theme, language, assistant_language, voice_enabled, speech_rate,
                   notifications, email_notifications, push_notifications, high_contrast, font_size
            FROM user_settings WHERE user_id = %s
            """,
            (user.id,)
        )
        row = cursor.fetchone()
        if not row:
            # Create default settings
            cursor.execute(
                """
                INSERT INTO user_settings (user_id, theme, language, assistant_language, voice_enabled, speech_rate,
                                           notifications, email_notifications, push_notifications, high_contrast, font_size)
                VALUES (%s, 'light', 'en', 'en', TRUE, 1.0, TRUE, TRUE, TRUE, FALSE, 'medium')
                RETURNING theme, language, assistant_language, voice_enabled, speech_rate,
                          notifications, email_notifications, push_notifications, high_contrast, font_size
                """,
                (user.id,)
            )
            row = cursor.fetchone()
            conn.commit()

        return UserSettingsSchema(
            theme=row[0],
            language=row[1],
            assistant_language=row[2],
            voice_enabled=row[3],
            speech_rate=row[4],
            notifications=row[5],
            email_notifications=row[6],
            push_notifications=row[7],
            high_contrast=row[8],
            font_size=row[9]
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

@router.put('', response_model=UserSettingsSchema)
def update_user_settings(payload: UserSettingsSchema, user: UserOut = Depends(current_user_dependency)):
    db = SupabaseDB.initialize()
    conn = db.get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            INSERT INTO user_settings (user_id, theme, language, assistant_language, voice_enabled, speech_rate,
                                       notifications, email_notifications, push_notifications, high_contrast, font_size, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                theme = EXCLUDED.theme,
                language = EXCLUDED.language,
                assistant_language = EXCLUDED.assistant_language,
                voice_enabled = EXCLUDED.voice_enabled,
                speech_rate = EXCLUDED.speech_rate,
                notifications = EXCLUDED.notifications,
                email_notifications = EXCLUDED.email_notifications,
                push_notifications = EXCLUDED.push_notifications,
                high_contrast = EXCLUDED.high_contrast,
                font_size = EXCLUDED.font_size,
                updated_at = NOW()
            RETURNING theme, language, assistant_language, voice_enabled, speech_rate,
                      notifications, email_notifications, push_notifications, high_contrast, font_size
            """,
            (user.id, payload.theme, payload.language, payload.assistant_language, payload.voice_enabled, payload.speech_rate,
             payload.notifications, payload.email_notifications, payload.push_notifications, payload.high_contrast, payload.font_size)
        )
        row = cursor.fetchone()

        import json
        try:
            cursor.execute(
                """
                INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
                VALUES (%s, 'user_settings_updated', 'settings', %s, %s)
                """,
                (
                    user.id,
                    user.id,
                    json.dumps({
                        'theme': payload.theme,
                        'language': payload.language,
                        'high_contrast': payload.high_contrast
                    })
                )
            )
        except Exception as audit_err:
            print(f"Failed to write settings audit log: {audit_err}")

        conn.commit()
        return UserSettingsSchema(
            theme=row[0],
            language=row[1],
            assistant_language=row[2],
            voice_enabled=row[3],
            speech_rate=row[4],
            notifications=row[5],
            email_notifications=row[6],
            push_notifications=row[7],
            high_contrast=row[8],
            font_size=row[9]
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
