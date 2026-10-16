"""Supabase PostgreSQL store implementation for users and analysis."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4
import logging
import secrets

from psycopg2.extras import Json, RealDictCursor
from psycopg2 import errors

from ..core.config import get_settings
from ..core.database import SupabaseDB
from ..core.security import hash_password, hash_token, verify_password

logger = logging.getLogger(__name__)

PATIENT_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'


def _scan_image_url(row: dict[str, Any]) -> str | None:
    image_url = row.get('original_image_url')
    if isinstance(image_url, str) and image_url:
        return image_url

    settings = get_settings()
    bucket = row.get('original_storage_bucket') or settings.supabase_storage_bucket
    storage_path = row.get('original_storage_path')
    if not settings.supabase_url or not bucket or not storage_path:
        return None
    return f"{settings.supabase_url.rstrip('/')}/storage/v1/object/public/{bucket}/{storage_path}"


@dataclass
class StoredUser:
    """User object from database."""
    id: str
    full_name: str
    email: str
    password_hash: str
    role: str
    join_date: datetime
    total_scans: int = 0
    is_active: bool = True
    access_token_version: int = 0
    access_tokens_invalid_before: datetime | None = None

    def to_public_dict(self) -> dict[str, Any]:
        """Convert to public-safe dictionary."""
        return {
            'id': self.id,
            'full_name': self.full_name,
            'email': self.email,
            'role': self.role,
            'join_date': self.join_date,
            'total_scans': self.total_scans,
        }


@dataclass
class StoredAnalysis:
    """Analysis result from database."""
    scan_id: str
    user_id: str
    prediction: str
    confidence: float
    risk_score: int
    risk_category: str
    probabilities: dict[str, float]
    explanation: str
    recommendations: dict[str, list[str]]
    report_id: str
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    report_url: str | None = None
    original_image_url: str | None = None
    heatmap_url: str | None = None
    patient_name: str | None = None
    status: str | None = None
    report_storage_bucket: str | None = None
    report_storage_path: str | None = None
    heatmap_storage_bucket: str | None = None
    heatmap_storage_path: str | None = None
    id: str = ''


class SupabaseStore:
    """Supabase PostgreSQL store for users and analysis."""

    def __init__(self):
        self.db = SupabaseDB()

    def create_user(
        self,
        full_name: str,
        email: str,
        password: str,
        role: str
    ) -> StoredUser:
        """Create a new user."""
        conn = self.db.get_connection()
        cursor = None
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)

            user_id = str(uuid4())
            password_hash = hash_password(password)

            normalized_email = email.lower()

            cursor.execute("""
                INSERT INTO users (id, name, full_name, email, password_hash, role, join_date, is_active)
                VALUES (%s, %s, %s, %s, %s, %s, %s, TRUE)
                RETURNING id, COALESCE(full_name, name) AS full_name, email, password_hash, role, join_date, total_scans, is_active, access_token_version, access_tokens_invalid_before
            """, (user_id, full_name, full_name, normalized_email, password_hash, role, datetime.now(timezone.utc)))

            result = cursor.fetchone()
            conn.commit()

            if not result:
                raise Exception("Failed to create user")

            return StoredUser(
                id=result['id'],
                full_name=result['full_name'],
                email=result['email'],
                password_hash=result['password_hash'],
                role=result['role'],
                join_date=result['join_date'],
                total_scans=result['total_scans'],
                is_active=result['is_active'],
                access_token_version=int(result.get('access_token_version') or 0),
                access_tokens_invalid_before=result.get('access_tokens_invalid_before'),
            )
        except Exception as e:
            conn.rollback()
            logger.error(f"Failed to create user: {e}")
            raise
        finally:
            if cursor is not None:
                cursor.close()
            self.db.return_connection(conn)

    def get_user(self, email: str) -> Optional[StoredUser]:
        """Get user by email."""
        conn = self.db.get_connection()
        cursor = None
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)

            cursor.execute("""
                SELECT id, COALESCE(full_name, name) AS full_name, email, password_hash, role, join_date, total_scans, is_active, access_token_version, access_tokens_invalid_before
                FROM users WHERE email = %s AND is_active = TRUE
            """, (email.lower(),))

            result = cursor.fetchone()

            if not result:
                return None

            return StoredUser(
                id=result['id'],
                full_name=result['full_name'],
                email=result['email'],
                password_hash=result['password_hash'],
                role=result['role'],
                join_date=result['join_date'],
                total_scans=result['total_scans'],
                is_active=result['is_active'],
                access_token_version=int(result.get('access_token_version') or 0),
                access_tokens_invalid_before=result.get('access_tokens_invalid_before'),
            )
        except Exception as e:
            logger.error(f"Failed to get user: {e}")
            raise
        finally:
            if cursor is not None:
                cursor.close()
            self.db.return_connection(conn)

    def get_user_by_id(self, user_id: str) -> Optional[StoredUser]:
        """Get user by ID."""
        conn = self.db.get_connection()
        cursor = None
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)

            cursor.execute("""
                SELECT id, COALESCE(full_name, name) AS full_name, email, password_hash, role, join_date, total_scans, is_active, access_token_version, access_tokens_invalid_before
                FROM users WHERE id = %s AND is_active = TRUE
            """, (user_id,))

            result = cursor.fetchone()

            if not result:
                return None

            return StoredUser(
                id=result['id'],
                full_name=result['full_name'],
                email=result['email'],
                password_hash=result['password_hash'],
                role=result['role'],
                join_date=result['join_date'],
                total_scans=result['total_scans'],
                is_active=result['is_active'],
                access_token_version=int(result.get('access_token_version') or 0),
                access_tokens_invalid_before=result.get('access_tokens_invalid_before'),
            )
        except Exception as e:
            logger.error(f"Failed to get user by ID: {e}")
            raise
        finally:
            if cursor is not None:
                cursor.close()
            self.db.return_connection(conn)

    def authenticate(self, email: str, password: str) -> Optional[StoredUser]:
        """Authenticate user with email and password."""
        user = self.get_user(email)
        if not user:
            return None

        if verify_password(password, user.password_hash):
            return user

        return None

    def user_exists(self, email: str) -> bool:
        """Check if user exists."""
        conn = self.db.get_connection()
        cursor = None
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT 1 FROM users WHERE email = %s LIMIT 1", (email.lower(),))
            return cursor.fetchone() is not None
        except Exception as e:
            logger.error(f"Failed to check user existence: {e}")
            raise
        finally:
            if cursor is not None:
                cursor.close()
            self.db.return_connection(conn)

    def save_refresh_token(
        self,
        user_id: str,
        token_id: str,
        refresh_token: str,
        expires_at: datetime,
    ) -> None:
        """Persist a refresh token hash for later validation and revocation."""
        conn = self.db.get_connection()
        cursor = None
        try:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO refresh_tokens (user_id, token_id, token_hash, expires_at)
                VALUES (%s, %s, %s, %s)
            """, (user_id, token_id, hash_token(refresh_token), expires_at))
            conn.commit()
        except Exception as e:
            conn.rollback()
            logger.error(f"Failed to save refresh token: {e}")
            raise
        finally:
            if cursor is not None:
                cursor.close()
            self.db.return_connection(conn)

    def refresh_token_is_active(self, token_id: str, refresh_token: str) -> bool:
        """Return true when a refresh token exists, matches, is unrevoked, and has not expired."""
        conn = self.db.get_connection()
        cursor = None
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT expires_at, revoked
                FROM refresh_tokens
                WHERE token_id = %s AND token_hash = %s
            """, (token_id, hash_token(refresh_token)))
            result = cursor.fetchone()
            if not result or result['revoked']:
                return False

            expires_at = result['expires_at']
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            return expires_at > datetime.now(timezone.utc)
        except Exception as e:
            logger.error(f"Failed to validate refresh token: {e}")
            raise
        finally:
            if cursor is not None:
                cursor.close()
            self.db.return_connection(conn)

    def revoke_refresh_token(self, token_id: str) -> None:
        """Revoke a single refresh token session."""
        conn = self.db.get_connection()
        cursor = None
        try:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE refresh_tokens
                SET revoked = TRUE
                WHERE token_id = %s
            """, (token_id,))
            conn.commit()
        except Exception as e:
            conn.rollback()
            logger.error(f"Failed to revoke refresh token: {e}")
            raise
        finally:
            if cursor is not None:
                cursor.close()
            self.db.return_connection(conn)

    def revoke_user_refresh_tokens(self, user_id: str) -> None:
        """Revoke every refresh token for a user."""
        conn = self.db.get_connection()
        cursor = None
        try:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE refresh_tokens
                SET revoked = TRUE
                WHERE user_id = %s AND revoked = FALSE
            """, (user_id,))
            conn.commit()
        except Exception as e:
            conn.rollback()
            logger.error(f"Failed to revoke user refresh tokens: {e}")
            raise
        finally:
            if cursor is not None:
                cursor.close()
            self.db.return_connection(conn)

    def invalidate_user_access_tokens(self, user_id: str, invalid_before: datetime | None = None) -> None:
        """Invalidate access tokens issued before a point in time."""
        conn = self.db.get_connection()
        cursor = None
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE users
                SET access_token_version = COALESCE(access_token_version, 0) + 1,
                    access_tokens_invalid_before = %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
                """,
                (invalid_before or datetime.now(timezone.utc), user_id),
            )
            conn.commit()
        except Exception as e:
            conn.rollback()
            logger.error(f"Failed to invalidate access tokens: {e}")
            raise
        finally:
            if cursor is not None:
                cursor.close()
            self.db.return_connection(conn)

    def summary(self, user_id: str | None = None) -> dict[str, Any]:
        """Build dashboard metrics directly from Supabase tables."""
        conn = self.db.get_connection()
        cursor = None
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            scan_filter = 'WHERE user_id = %s' if user_id else ''
            scan_params: tuple[Any, ...] = (user_id,) if user_id else ()
            analysis_filter = 'WHERE user_id = %s' if user_id else ''
            analysis_params: tuple[Any, ...] = (user_id,) if user_id else ()

            cursor.execute(
                f"""
                SELECT
                    COUNT(*)::int AS total_scans,
                    COUNT(DISTINCT user_id)::int AS total_patients
                FROM scans
                {scan_filter}
                """,
                scan_params,
            )
            scan_row = cursor.fetchone() or {}

            profile_row = {}
            if user_id:
                cursor.execute(
                    """
                    SELECT full_name, age, gender, blood_group
                    FROM patient_profiles
                    WHERE user_id = %s
                    """,
                    (user_id,),
                )
                profile_row = cursor.fetchone() or {}

            cursor.execute(
                f"""
                SELECT
                    COUNT(*) FILTER (WHERE prediction NOT IN ('Non Demented', 'NonDemented'))::int AS dementia_cases,
                    COUNT(*) FILTER (WHERE prediction IN ('Non Demented', 'NonDemented'))::int AS healthy_cases,
                    COALESCE(ROUND(AVG(confidence)::numeric, 2), 0)::float AS average_confidence
                FROM analysis_history
                {analysis_filter}
                """,
                analysis_params,
            )
            analysis_row = cursor.fetchone() or {}

            cursor.execute(
                f"""
                SELECT COUNT(*)::int AS reports_generated
                FROM reports
                {analysis_filter}
                """,
                analysis_params,
            )
            report_row = cursor.fetchone() or {}

            cursor.execute(
                f"""
                SELECT
                    TO_CHAR(date_trunc('month', created_at), 'Mon') AS name,
                    COUNT(*)::int AS scans,
                    COALESCE(ROUND(AVG(confidence)::numeric, 2), 0)::float AS accuracy,
                    COALESCE(ROUND(AVG(confidence)::numeric, 2), 0)::float AS average_confidence,
                    COALESCE(ROUND(AVG(risk_score)::numeric, 2), 0)::float AS average_risk,
                    COUNT(*) FILTER (WHERE risk_category IN ('High', 'Critical'))::int AS high_risk
                FROM analysis_history
                {analysis_filter}
                GROUP BY date_trunc('month', created_at)
                ORDER BY date_trunc('month', created_at)
                LIMIT 6
                """,
                analysis_params,
            )
            monthly_trend = [
                {
                    'name': row['name'],
                    'scans': int(row['scans']),
                    'accuracy': float(row['accuracy']),
                    'average_confidence': float(row['average_confidence']),
                    'average_risk': float(row['average_risk']),
                    'high_risk': int(row['high_risk']),
                }
                for row in cursor.fetchall()
            ]

            cursor.execute(
                f"""
                SELECT
                    CASE
                        WHEN prediction IN ('Non Demented', 'NonDemented') THEN 'Healthy'
                        ELSE risk_category
                    END AS name,
                    COUNT(*)::int AS value
                FROM analysis_history
                {analysis_filter}
                GROUP BY 1
                ORDER BY value DESC, name ASC
                """,
                analysis_params,
            )
            risk_distribution = [{'name': row['name'], 'value': int(row['value'])} for row in cursor.fetchall()]

            cursor.execute(
                f"""
                SELECT
                    id,
                    scan_id,
                    created_at,
                    patient_name,
                    prediction,
                    confidence,
                    risk_score,
                    risk_category,
                    report_id,
                    heatmap_url,
                    report_storage_bucket,
                    report_storage_path
                FROM (
                    SELECT
                        ah.id,
                        ah.scan_id,
                        ah.created_at,
                        COALESCE(pp.full_name, u.full_name, u.email, 'Unknown User') AS patient_name,
                        ah.prediction,
                        ah.confidence,
                        ah.risk_score,
                        ah.risk_category,
                        ah.report_id,
                        ar.heatmap_url,
                        r.storage_bucket AS report_storage_bucket,
                        r.storage_path AS report_storage_path,
                        ROW_NUMBER() OVER (
                            PARTITION BY ah.id
                            ORDER BY r.created_at DESC NULLS LAST, r.id DESC NULLS LAST
                        ) AS row_number
                    FROM analysis_history ah
                    JOIN users u ON u.id = ah.user_id
                    LEFT JOIN patient_profiles pp ON pp.user_id = ah.user_id
                    LEFT JOIN analysis_results ar
                        ON ar.scan_id = ah.scan_id AND ar.user_id = ah.user_id
                    LEFT JOIN reports r
                        ON r.scan_id = ah.scan_id
                        AND r.user_id = ah.user_id
                        AND (
                            strpos(r.report_url, ah.report_id) > 0
                            OR strpos(r.storage_path, ah.report_id) > 0
                        )
                    {analysis_filter.replace('user_id', 'ah.user_id')}
                ) ranked_scans
                WHERE row_number = 1
                ORDER BY created_at DESC
                LIMIT 5
                """,
                analysis_params,
            )
            recent_scans = []
            for row in cursor.fetchall():
                report_id = row['report_id']
                recent_scans.append(
                    {
                        'id': str(row['id']),
                        'scan_id': str(row['scan_id']),
                        'date': row['created_at'],
                        'patient_name': row['patient_name'],
                        'prediction': row['prediction'],
                        'confidence': float(row['confidence']),
                        'risk_score': int(row['risk_score']),
                        'risk_category': row['risk_category'],
                        'report_id': report_id,
                        'report_url': f'/api/v1/reports/{report_id}/pdf',
                        'heatmap_url': row['heatmap_url'],
                        'report_storage_bucket': row.get('report_storage_bucket'),
                        'report_storage_path': row.get('report_storage_path'),
                    }
                )

            return {
                'total_scans': int(scan_row.get('total_scans') or 0),
                'total_patients': int(scan_row.get('total_patients') or 0),
                'dementia_cases': int(analysis_row.get('dementia_cases') or 0),
                'healthy_cases': int(analysis_row.get('healthy_cases') or 0),
                'average_confidence': float(analysis_row.get('average_confidence') or 0),
                'reports_generated': int(report_row.get('reports_generated') or 0),
                'patient_name': profile_row.get('full_name'),
                'patient_age': profile_row.get('age'),
                'patient_gender': profile_row.get('gender'),
                'patient_blood_group': profile_row.get('blood_group'),
                'monthly_trend': monthly_trend,
                'risk_distribution': risk_distribution,
                'recent_scans': recent_scans,
            }
        except Exception as e:
            logger.error(f"Failed to build dashboard summary: {e}")
            raise
        finally:
            if cursor is not None:
                cursor.close()
            self.db.return_connection(conn)

    @staticmethod
    def _profile_from_row(row: dict[str, Any] | None) -> dict[str, Any] | None:
        if not row:
            return None
        return {
            'id': str(row['id']),
            'user_id': str(row['user_id']),
            'patient_id': row['patient_id'],
            'full_name': row['full_name'],
            'gender': row.get('gender'),
            'dob': row.get('dob'),
            'age': row.get('age'),
            'phone': row.get('phone'),
            'email': row.get('email'),
            'blood_group': row.get('blood_group'),
            'height': row.get('height'),
            'weight': row.get('weight'),
            'allergies': row.get('allergies'),
            'medications': row.get('medications'),
            'medical_history': row.get('medical_history'),
            'family_history': row.get('family_history'),
            'emergency_contact_name': row.get('emergency_contact_name'),
            'emergency_contact_phone': row.get('emergency_contact_phone'),
            'photo_url': row.get('photo_url'),
            'photo_storage_path': row.get('photo_storage_path'),
            'created_at': row['created_at'],
            'updated_at': row['updated_at'],
        }

    def get_patient_profile(self, user_id: str) -> dict[str, Any] | None:
        import uuid
        try:
            uuid.UUID(str(user_id))
        except ValueError:
            return None

        conn = self.db.get_connection()
        cursor = None
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(
                """
                SELECT *
                FROM patient_profiles
                WHERE user_id = %s
                """,
                (user_id,),
            )
            return self._profile_from_row(cursor.fetchone())
        finally:
            if cursor is not None:
                cursor.close()
            self.db.return_connection(conn)

    @staticmethod
    def _generate_patient_id() -> str:
        suffix = ''.join(secrets.choice(PATIENT_ID_ALPHABET) for _ in range(6))
        short_hex = secrets.token_hex(2).upper()
        formats = (
            f'NSA-{suffix}',
            f'NSA-{datetime.now(timezone.utc).year}-{short_hex}',
            f'PAT-{suffix}',
        )
        return secrets.choice(formats)

    def create_patient_profile(self, user_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        conn = self.db.get_connection()
        cursor = None
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            for _ in range(8):
                patient_id = self._generate_patient_id()
                try:
                    cursor.execute(
                        """
                        INSERT INTO patient_profiles (
                            user_id, patient_id, full_name, gender, dob, age, phone, email,
                            blood_group, height, weight, allergies, medications, medical_history,
                            family_history, emergency_contact_name, emergency_contact_phone,
                            photo_url, photo_storage_path, created_at, updated_at
                        )
                        VALUES (
                            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                            %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                        )
                        RETURNING *
                        """,
                        (
                            user_id,
                            patient_id,
                            payload.get('full_name'),
                            payload.get('gender'),
                            payload.get('dob'),
                            payload.get('age'),
                            payload.get('phone'),
                            payload.get('email'),
                            payload.get('blood_group'),
                            payload.get('height'),
                            payload.get('weight'),
                            payload.get('allergies'),
                            payload.get('medications'),
                            payload.get('medical_history'),
                            payload.get('family_history'),
                            payload.get('emergency_contact_name'),
                            payload.get('emergency_contact_phone'),
                            payload.get('photo_url'),
                            payload.get('photo_storage_path'),
                        ),
                    )
                    row = cursor.fetchone()
                    conn.commit()
                    return self._profile_from_row(row) or {}
                except errors.UniqueViolation as exc:
                    conn.rollback()
                    if exc.diag.constraint_name == 'idx_patient_profiles_patient_id_unique':
                        continue
                    raise
            raise ValueError('Unable to generate a unique patient ID')
        except errors.UniqueViolation as exc:
            conn.rollback()
            raise ValueError('A profile already exists for this user') from exc
        except Exception:
            conn.rollback()
            raise
        finally:
            if cursor is not None:
                cursor.close()
            self.db.return_connection(conn)

    def update_patient_profile(self, user_id: str, payload: dict[str, Any]) -> dict[str, Any] | None:
        fields = dict(payload)
        if not fields:
            return self.get_patient_profile(user_id)

        conn = self.db.get_connection()
        cursor = None
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            allowed = [
                'full_name',
                'gender',
                'dob',
                'age',
                'phone',
                'email',
                'blood_group',
                'height',
                'weight',
                'allergies',
                'medications',
                'medical_history',
                'family_history',
                'emergency_contact_name',
                'emergency_contact_phone',
                'photo_url',
                'photo_storage_path',
            ]
            updates = [f'{field} = %s' for field in allowed if field in fields]
            if not updates:
                cursor.execute(
                    """
                    SELECT *
                    FROM patient_profiles
                    WHERE user_id = %s
                    """,
                    (user_id,),
                )
                return self._profile_from_row(cursor.fetchone())
            params = [fields[field] for field in allowed if field in fields]
            params.append(user_id)
            cursor.execute(
                f"""
                UPDATE patient_profiles
                SET {', '.join(updates)}, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = %s
                RETURNING *
                """,
                tuple(params),
            )
            row = cursor.fetchone()
            conn.commit()
            return self._profile_from_row(row)
        except errors.UniqueViolation as exc:
            conn.rollback()
            raise ValueError('Patient ID is already in use') from exc
        except Exception:
            conn.rollback()
            raise
        finally:
            if cursor is not None:
                cursor.close()
            self.db.return_connection(conn)

    def delete_patient_profile(self, user_id: str) -> bool:
        conn = self.db.get_connection()
        cursor = None
        try:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM patient_profiles WHERE user_id = %s', (user_id,))
            deleted = cursor.rowcount > 0
            conn.commit()
            return deleted
        except Exception:
            conn.rollback()
            raise
        finally:
            if cursor is not None:
                cursor.close()
            self.db.return_connection(conn)

    def list_reports(
        self,
        user_id: str | None = None,
        search: str | None = None,
        status: str | None = None,
        prediction: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        """Return searchable report metadata from Supabase."""
        conn = self.db.get_connection()
        cursor = None
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            clauses: list[str] = []
            params: list[Any] = []
            if user_id:
                clauses.append('r.user_id = %s')
                params.append(user_id)
            if search:
                clauses.append(
                    '(r.scan_id::text ILIKE %s OR ah.report_id ILIKE %s OR ah.prediction ILIKE %s OR COALESCE(pp.full_name, u.full_name, u.email, \'Unknown User\') ILIKE %s OR r.status ILIKE %s)'
                )
                wildcard = f'%{search}%'
                params.extend([wildcard, wildcard, wildcard, wildcard, wildcard])
            if status:
                clauses.append('r.status = %s')
                params.append(status)
            if prediction:
                clauses.append('ah.prediction = %s')
                params.append(prediction)
            if date_from:
                clauses.append('r.created_at >= %s')
                params.append(date_from)
            if date_to:
                clauses.append('r.created_at <= %s')
                params.append(date_to)

            where_clause = f"WHERE {' AND '.join(clauses)}" if clauses else ''
            cursor.execute(
                f"""
                SELECT *
                FROM (
                    SELECT
                        r.id,
                        ah.report_id,
                        r.scan_id,
                        COALESCE(pp.full_name, u.full_name, u.email, 'Unknown User') AS patient_name,
                        ah.prediction,
                        ah.confidence,
                        ah.risk_score,
                        r.created_at,
                        r.status,
                        ar.heatmap_url,
                        s.image_url AS original_image_url,
                        s.storage_bucket AS original_storage_bucket,
                        s.storage_path AS original_storage_path,
                        ROW_NUMBER() OVER (
                            PARTITION BY ah.report_id
                            ORDER BY r.created_at DESC, ah.created_at DESC, r.id DESC
                        ) AS row_number
                    FROM reports r
                    JOIN analysis_history ah
                        ON ah.scan_id = r.scan_id
                        AND ah.user_id = r.user_id
                        AND (
                            strpos(r.report_url, ah.report_id) > 0
                            OR strpos(r.storage_path, ah.report_id) > 0
                        )
                    JOIN users u ON u.id = r.user_id
                    LEFT JOIN patient_profiles pp ON pp.user_id = r.user_id
                    LEFT JOIN analysis_results ar
                        ON ar.scan_id = r.scan_id AND ar.user_id = r.user_id
                    LEFT JOIN scans s
                        ON s.id = r.scan_id AND s.user_id = r.user_id
                    {where_clause}
                ) ranked_reports
                WHERE row_number = 1
                ORDER BY created_at DESC
                LIMIT %s OFFSET %s
                """,
                tuple(params + [max(1, min(limit, 100)), max(0, offset)]),
            )
            return [
                {
                    'report_id': row['report_id'],
                    'id': str(row['id']),
                    'scan_id': str(row['scan_id']),
                    'patient_name': row['patient_name'],
                    'prediction': row['prediction'],
                    'confidence': float(row['confidence']),
                    'risk_score': int(row['risk_score']),
                    'created_at': row['created_at'],
                    'status': row['status'] or 'generated',
                    'report_url': f'/api/v1/reports/{row["report_id"]}/pdf',
                    'original_image_url': _scan_image_url(row),
                    'heatmap_url': row['heatmap_url'],
                }
                for row in cursor.fetchall()
            ]
        except Exception as e:
            logger.error(f"Failed to list reports: {e}")
            raise
        finally:
            if cursor is not None:
                cursor.close()
            self.db.return_connection(conn)

    def delete_report(self, report_row_id: str, user_id: str) -> bool:
        """Delete one generated report row for the current user."""
        conn = self.db.get_connection()
        cursor = None
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(
                """
                SELECT r.id, r.scan_id, r.report_url, r.storage_path, ah.report_id
                FROM reports r
                LEFT JOIN analysis_history ah
                    ON ah.scan_id = r.scan_id
                    AND ah.user_id = r.user_id
                    AND (
                        strpos(r.report_url, ah.report_id) > 0
                        OR strpos(r.storage_path, ah.report_id) > 0
                    )
                WHERE r.id = %s AND r.user_id = %s
                ORDER BY ah.created_at DESC
                LIMIT 1
                """,
                (report_row_id, user_id),
            )
            row = cursor.fetchone()
            if not row:
                conn.rollback()
                return False

            report_id = row.get('report_id')
            if report_id:
                report_pattern = f'%{report_id}%'
                cursor.execute(
                    """
                    DELETE FROM reports
                    WHERE user_id = %s
                      AND scan_id = %s
                      AND (id = %s OR report_url ILIKE %s OR storage_path ILIKE %s)
                    """,
                    (user_id, row['scan_id'], report_row_id, report_pattern, report_pattern),
                )
            else:
                cursor.execute(
                    """
                    DELETE FROM reports
                    WHERE id = %s AND user_id = %s
                    """,
                    (report_row_id, user_id),
                )
            deleted = cursor.rowcount > 0
            if deleted:
                self._insert_audit_log(
                    cursor,
                    user_id=user_id,
                    action='report_deleted',
                    resource_type='report',
                    resource_id=report_row_id,
                    metadata={
                        'scan_id': str(row['scan_id']),
                        'report_url': row.get('report_url'),
                        'storage_path': row.get('storage_path'),
                    },
                )
            conn.commit()
            return deleted
        except Exception as e:
            conn.rollback()
            logger.error(f"Failed to delete report: {e}")
            raise
        finally:
            if cursor is not None:
                cursor.close()
            self.db.return_connection(conn)

    def get_report(
        self,
        report_id: str,
        user_id: str | None = None,
        requesting_role: str | None = None,
    ) -> StoredAnalysis | None:
        """Fetch a single report by report identifier with role-aware authorization."""
        conn = self.db.get_connection()
        cursor = None
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            clauses = ['ah.report_id = %s']
            params: list[Any] = [report_id]
            if user_id:
                if requesting_role in ('Admin',):
                    pass
                elif requesting_role in ('Doctor',):
                    clauses.append(
                        """(
                            dpa.doctor_id = %s
                            OR s.reviewed_by = %s
                            OR dpa.doctor_id IS NULL
                        )"""
                    )
                    params.extend([user_id, user_id])
                else:
                    clauses.append('ah.user_id = %s')
                    params.append(user_id)
            cursor.execute(
                f"""
                SELECT
                    ah.id,
                    ah.scan_id,
                    ah.user_id,
                    ah.prediction,
                    ah.confidence,
                    ah.risk_score,
                    ah.risk_category,
                    ah.probabilities,
                    ah.explanation,
                    ah.recommendations,
                    ah.report_id,
                    ah.created_at,
                    ar.heatmap_url,
                    s.image_url AS original_image_url,
                    s.storage_bucket AS original_storage_bucket,
                    s.storage_path AS original_storage_path
                FROM analysis_history ah
                LEFT JOIN analysis_results ar
                    ON ar.scan_id = ah.scan_id AND ar.user_id = ah.user_id
                LEFT JOIN scans s
                    ON s.id = ah.scan_id AND s.user_id = ah.user_id
                LEFT JOIN doctor_patient_assignments dpa
                    ON dpa.patient_id = ah.user_id AND dpa.status = 'Active'
                WHERE {' AND '.join(clauses)}
                ORDER BY ah.created_at DESC
                LIMIT 1
                """,
                tuple(params),
            )
            row = cursor.fetchone()
            if not row:
                return None
            return StoredAnalysis(
                id=str(row['id']),
                scan_id=str(row['scan_id']),
                user_id=str(row['user_id']),
                prediction=row['prediction'],
                confidence=float(row['confidence']),
                risk_score=int(row['risk_score']),
                risk_category=row['risk_category'],
                probabilities=row['probabilities'] if isinstance(row['probabilities'], dict) else {},
                explanation=row['explanation'] or '',
                recommendations=row['recommendations'] if isinstance(row['recommendations'], dict) else {},
                report_id=row['report_id'],
                created_at=row['created_at'],
                report_url=f'/api/v1/reports/{row["report_id"]}/pdf',
                original_image_url=_scan_image_url(row),
                heatmap_url=row['heatmap_url'],
            )
        except Exception as e:
            logger.error(f"Failed to get report: {e}")
            raise
        finally:
            if cursor is not None:
                cursor.close()
            self.db.return_connection(conn)

    def get_analysis_by_scan_id(
        self,
        scan_id: str,
        user_id: str | None = None,
        requesting_role: str | None = None,
    ) -> StoredAnalysis | None:
        """Fetch a single analysis by scan identifier with role-aware authorization."""
        conn = self.db.get_connection()
        cursor = None
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            clauses = ['ah.scan_id = %s']
            params: list[Any] = [scan_id]
            if user_id:
                if requesting_role in ('Admin',):
                    pass
                elif requesting_role in ('Doctor',):
                    clauses.append(
                        """(
                            dpa.doctor_id = %s
                            OR s.reviewed_by = %s
                            OR dpa.doctor_id IS NULL
                        )"""
                    )
                    params.extend([user_id, user_id])
                else:
                    clauses.append('ah.user_id = %s')
                    params.append(user_id)
            cursor.execute(
                f"""
                SELECT
                    ah.id,
                    ah.scan_id,
                    ah.user_id,
                    ah.prediction,
                    ah.confidence,
                    ah.risk_score,
                    ah.risk_category,
                    ah.probabilities,
                    ah.explanation,
                    ah.recommendations,
                    ah.report_id,
                    ah.created_at,
                    ar.heatmap_url,
                    s.image_url AS original_image_url,
                    s.storage_bucket AS original_storage_bucket,
                    s.storage_path AS original_storage_path
                FROM analysis_history ah
                LEFT JOIN analysis_results ar
                    ON ar.scan_id = ah.scan_id AND ar.user_id = ah.user_id
                LEFT JOIN scans s
                    ON s.id = ah.scan_id AND s.user_id = ah.user_id
                LEFT JOIN doctor_patient_assignments dpa
                    ON dpa.patient_id = ah.user_id AND dpa.status = 'Active'
                WHERE {' AND '.join(clauses)}
                ORDER BY ah.created_at DESC
                LIMIT 1
                """,
                tuple(params),
            )
            row = cursor.fetchone()
            if not row:
                return None
            return StoredAnalysis(
                id=str(row['id']),
                scan_id=str(row['scan_id']),
                user_id=str(row['user_id']),
                prediction=row['prediction'],
                confidence=float(row['confidence']),
                risk_score=int(row['risk_score']),
                risk_category=row['risk_category'],
                probabilities=row['probabilities'] if isinstance(row['probabilities'], dict) else {},
                explanation=row['explanation'] or '',
                recommendations=row['recommendations'] if isinstance(row['recommendations'], dict) else {},
                report_id=row['report_id'],
                created_at=row['created_at'],
                report_url=f'/api/v1/reports/{row["report_id"]}/pdf',
                original_image_url=_scan_image_url(row),
                heatmap_url=row['heatmap_url'],
            )
        except Exception as e:
            logger.error(f"Failed to get analysis by scan id: {e}")
            raise
        finally:
            if cursor is not None:
                cursor.close()
            self.db.return_connection(conn)

    def add_analysis(self, analysis: StoredAnalysis) -> None:
        """Add analysis result to history."""
        conn = self.db.get_connection()
        cursor = None
        try:
            cursor = conn.cursor()
            analysis_id = analysis.id or str(uuid4())
            report_id = analysis.report_id or f'RPT-{uuid4().hex[:4].upper()}'
            created_at = analysis.created_at or datetime.now(timezone.utc)

            cursor.execute("""
                INSERT INTO analysis_history
                (id, user_id, scan_id, prediction, confidence, risk_score, risk_category,
                 probabilities, explanation, recommendations, report_id, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                analysis_id,
                analysis.user_id,
                analysis.scan_id,
                analysis.prediction,
                analysis.confidence,
                analysis.risk_score,
                analysis.risk_category,
                Json(analysis.probabilities),
                analysis.explanation,
                Json(analysis.recommendations),
                report_id,
                created_at,
            ))

            cursor.execute(
                """
                INSERT INTO reports (user_id, scan_id, report_url, storage_bucket, storage_path, status)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (
                    analysis.user_id,
                    analysis.scan_id,
                    f'/api/v1/reports/{report_id}/pdf',
                    'reports',
                    f'{analysis.user_id}/{report_id}.pdf',
                    'generated',
                ),
            )

            cursor.execute("""
                UPDATE users SET total_scans = total_scans + 1 WHERE id = %s
            """, (analysis.user_id,))

            self._insert_audit_log(
                cursor,
                user_id=analysis.user_id,
                action='analysis_saved',
                resource_type='scan',
                resource_id=analysis.scan_id,
                metadata={'report_id': report_id, 'prediction': analysis.prediction},
            )

            conn.commit()
        except Exception as e:
            conn.rollback()
            logger.error(f"Failed to add analysis: {e}")
            raise
        finally:
            if cursor is not None:
                cursor.close()
            self.db.return_connection(conn)

    def create_chat_session(
        self,
        user_id: str,
        title: str,
        scan_id: str | None = None,
        patient_id: str | None = None,
        language: str = 'English',
    ) -> dict[str, Any]:
        """Create a new chat conversation session."""
        conn = self.db.get_connection()
        cursor = None
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(
                """
                INSERT INTO chat_sessions (user_id, title, scan_id, patient_id, is_archived, is_favorite, language)
                VALUES (%s, %s, %s, %s, FALSE, FALSE, %s)
                RETURNING id::text AS id, title, scan_id::text AS scan_id, patient_id, is_archived, is_favorite, language, created_at, updated_at
                """,
                (user_id, title, scan_id, patient_id, language),
            )
            row = dict(cursor.fetchone())
            conn.commit()
            return row
        except Exception as e:
            conn.rollback()
            logger.error(f"Failed to create chat session: {e}")
            raise
        finally:
            if cursor is not None:
                cursor.close()
            self.db.return_connection(conn)

    def list_chat_sessions(self, user_id: str) -> list[dict[str, Any]]:
        """List active chat sessions for a user."""
        conn = self.db.get_connection()
        cursor = None
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(
                """
                SELECT id::text AS id, title, scan_id::text AS scan_id, patient_id, is_archived, is_favorite, language, created_at, updated_at
                FROM chat_sessions
                WHERE user_id = %s AND is_archived = FALSE
                ORDER BY is_favorite DESC, updated_at DESC, created_at DESC
                """,
                (user_id,),
            )
            return [dict(row) for row in cursor.fetchall()]
        except Exception as e:
            logger.error(f"Failed to list chat sessions: {e}")
            raise
        finally:
            if cursor is not None:
                cursor.close()
            self.db.return_connection(conn)

    def update_chat_session(
        self,
        session_id: str,
        user_id: str,
        title: str | None = None,
        is_archived: bool | None = None,
        is_favorite: bool | None = None,
        language: str | None = None,
    ) -> dict[str, Any] | None:
        """Update properties of an existing chat session."""
        conn = self.db.get_connection()
        cursor = None
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            updates = []
            params = []
            if title is not None:
                updates.append("title = %s")
                params.append(title)
            if is_archived is not None:
                updates.append("is_archived = %s")
                params.append(is_archived)
            if is_favorite is not None:
                updates.append("is_favorite = %s")
                params.append(is_favorite)
            if language is not None:
                updates.append("language = %s")
                params.append(language)

            if not updates:
                return None

            updates.append("updated_at = NOW()")
            query = f"""
                UPDATE chat_sessions
                SET {', '.join(updates)}
                WHERE id = %s AND user_id = %s
                RETURNING id::text AS id, title, scan_id::text AS scan_id, patient_id, is_archived, is_favorite, language, created_at, updated_at
            """
            params.extend([session_id, user_id])
            cursor.execute(query, tuple(params))
            row = cursor.fetchone()
            conn.commit()
            return dict(row) if row else None
        except Exception as e:
            conn.rollback()
            logger.error(f"Failed to update chat session: {e}")
            raise
        finally:
            if cursor is not None:
                cursor.close()
            self.db.return_connection(conn)

    def delete_chat_session(self, session_id: str, user_id: str) -> bool:
        """Delete an existing chat session."""
        conn = self.db.get_connection()
        cursor = None
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                DELETE FROM chat_sessions
                WHERE id = %s AND user_id = %s
                """,
                (session_id, user_id),
            )
            deleted = cursor.rowcount > 0
            conn.commit()
            return deleted
        except Exception as e:
            conn.rollback()
            logger.error(f"Failed to delete chat session: {e}")
            raise
        finally:
            if cursor is not None:
                cursor.close()
            self.db.return_connection(conn)

    def list_chat_history(
        self,
        user_id: str,
        *,
        scan_id: str | None = None,
        patient_id: str | None = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """Load persisted assistant exchanges for the active MRI study."""
        conn = self.db.get_connection()
        cursor = None
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            clauses = ['user_id = %s']
            params: list[Any] = [user_id]

            if scan_id:
                clauses.append('scan_id = %s')
                params.append(scan_id)
            else:
                clauses.append('scan_id IS NULL')

            if patient_id:
                clauses.append('(patient_id = %s OR patient_id IS NULL)')
                params.append(patient_id)

            params.append(limit)
            cursor.execute(
                f"""
                SELECT
                    id::text AS id,
                    session_id::text AS session_id,
                    scan_id::text AS scan_id,
                    patient_id,
                    COALESCE(question, message) AS question,
                    COALESCE(answer, response) AS answer,
                    language,
                    response_time,
                    model,
                    tokens_used,
                    feedback,
                    created_at
                FROM chat_history
                WHERE {' AND '.join(clauses)}
                ORDER BY created_at ASC
                LIMIT %s
                """,
                params,
            )
            return [dict(row) for row in cursor.fetchall()]
        finally:
            if cursor is not None:
                cursor.close()
            self.db.return_connection(conn)

    def list_chat_history_by_session(
        self, user_id: str, session_id: str, limit: int | None = None
    ) -> list[dict[str, Any]]:
        """List messages inside a specific chat session."""
        conn = self.db.get_connection()
        cursor = None
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            order_direction = "DESC" if limit is not None else "ASC"
            query = f"""
                SELECT
                    id::text AS id,
                    session_id::text AS session_id,
                    scan_id::text AS scan_id,
                    patient_id,
                    COALESCE(question, message) AS question,
                    COALESCE(answer, response) AS answer,
                    language,
                    response_time,
                    model,
                    tokens_used,
                    feedback,
                    created_at
                FROM chat_history
                WHERE user_id = %s AND session_id = %s
                ORDER BY created_at {order_direction}
            """
            params = [user_id, session_id]
            if limit is not None:
                query += " LIMIT %s"
                params.append(limit)

            cursor.execute(query, tuple(params))
            results = [dict(row) for row in cursor.fetchall()]
            if limit is not None:
                results.reverse()
            return results
        except Exception as e:
            logger.error(f"Failed to list chat session history: {e}")
            raise
        finally:
            if cursor is not None:
                cursor.close()
            self.db.return_connection(conn)

    def clear_chat_history(
        self,
        user_id: str,
        *,
        scan_id: str | None = None,
        patient_id: str | None = None,
    ) -> int:
        """Clear assistant exchanges for the active MRI study."""
        conn = self.db.get_connection()
        cursor = None
        try:
            cursor = conn.cursor()
            clauses = ['user_id = %s']
            params: list[Any] = [user_id]

            if scan_id:
                clauses.append('scan_id = %s')
                params.append(scan_id)
            else:
                clauses.append('scan_id IS NULL')

            if patient_id:
                clauses.append('(patient_id = %s OR patient_id IS NULL)')
                params.append(patient_id)

            cursor.execute(
                f"DELETE FROM chat_history WHERE {' AND '.join(clauses)}",
                params,
            )
            deleted = cursor.rowcount
            self._insert_audit_log(
                cursor,
                user_id=user_id,
                action='assistant_chat_cleared',
                resource_type='chat_history',
                resource_id=scan_id,
                metadata={'patient_id': patient_id, 'deleted': deleted},
            )
            conn.commit()
            return deleted
        except Exception as e:
            conn.rollback()
            logger.error(f"Failed to clear chat history: {e}")
            raise
        finally:
            if cursor is not None:
                cursor.close()
            self.db.return_connection(conn)

    def update_chat_message_feedback(self, message_id: str, user_id: str, feedback: bool | None) -> bool:
        """Update 👍/👎 rating on a chat message."""
        conn = self.db.get_connection()
        cursor = None
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE chat_history
                SET feedback = %s
                WHERE id = %s AND user_id = %s
                """,
                (feedback, message_id, user_id),
            )
            updated = cursor.rowcount > 0
            conn.commit()
            return updated
        except Exception as e:
            conn.rollback()
            logger.error(f"Failed to update chat feedback: {e}")
            raise
        finally:
            if cursor is not None:
                cursor.close()
            self.db.return_connection(conn)

    def save_chat_history(
        self,
        user_id: str,
        message: str,
        response: str,
        *,
        scan_id: str | None = None,
        patient_id: str | None = None,
        session_id: str | None = None,
        language: str = 'English',
        response_time: float | None = None,
        model: str | None = None,
        tokens_used: int | None = None,
    ) -> dict[str, Any]:
        """Persist a clinical assistant exchange."""
        conn = self.db.get_connection()
        cursor = None
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(
                """
                INSERT INTO chat_history (
                    user_id, scan_id, patient_id, question, answer, message, response,
                    session_id, language, response_time, model, tokens_used
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING
                    id::text AS id,
                    session_id::text AS session_id,
                    scan_id::text AS scan_id,
                    patient_id,
                    question,
                    answer,
                    language,
                    response_time,
                    model,
                    tokens_used,
                    feedback,
                    created_at
                """,
                (
                    user_id, scan_id, patient_id, message, response, message, response,
                    session_id, language, response_time, model, tokens_used
                ),
            )
            saved = dict(cursor.fetchone())
            self._insert_audit_log(
                cursor,
                user_id=user_id,
                action='assistant_chat',
                resource_type='chat_history',
                resource_id=saved['id'],
                metadata={'scan_id': scan_id, 'patient_id': patient_id, 'session_id': session_id},
            )

            # Update updated_at timestamp on parent session
            if session_id:
                cursor.execute(
                    "UPDATE chat_sessions SET updated_at = NOW() WHERE id = %s",
                    (session_id,),
                )

            conn.commit()
            return saved
        except Exception as e:
            conn.rollback()
            logger.error(f"Failed to save chat history: {e}")
            raise
        finally:
            if cursor is not None:
                cursor.close()
            self.db.return_connection(conn)

    @staticmethod
    def _insert_audit_log(
        cursor,
        *,
        user_id: str | None,
        action: str,
        resource_type: str | None,
        resource_id: str | None,
        metadata: dict[str, Any] | None,
    ) -> None:
        cursor.execute(
            """
            INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (user_id, action, resource_type, resource_id, Json(metadata) if metadata is not None else None),
        )

    def list_history(
        self,
        user_id: str,
        *,
        search: str | None = None,
        prediction: str | None = None,
        risk: str | None = None,
        status: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        sort_by: str = 'date',
        sort_dir: str = 'desc',
        limit: int | None = None,
        offset: int = 0,
    ) -> list[StoredAnalysis]:
        """Get filtered analysis history for user."""
        import uuid
        try:
            uuid.UUID(str(user_id))
        except ValueError:
            return []

        conn = self.db.get_connection()
        cursor = None
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            clauses = ['ah.user_id = %s']
            params: list[Any] = [user_id]

            if search:
                wildcard = f'%{search}%'
                clauses.append(
                    '(ah.scan_id::text ILIKE %s OR ah.report_id ILIKE %s OR ah.prediction ILIKE %s OR ah.risk_category ILIKE %s OR COALESCE(pp.full_name, u.full_name, u.email, \'Unknown User\') ILIKE %s OR r.status ILIKE %s)'
                )
                params.extend([wildcard, wildcard, wildcard, wildcard, wildcard, wildcard])
            if prediction:
                clauses.append('ah.prediction = %s')
                params.append(prediction)
            if risk:
                clauses.append('ah.risk_category = %s')
                params.append(risk)
            if status:
                clauses.append('r.status = %s')
                params.append(status)
            if date_from:
                clauses.append('ah.created_at >= %s')
                params.append(date_from)
            if date_to:
                clauses.append('ah.created_at <= %s')
                params.append(date_to)

            sort_columns = {
                'date': 'ah.created_at',
                'prediction': 'ah.prediction',
                'confidence': 'ah.confidence',
                'risk': 'ah.risk_category',
                'report': 'ah.report_id',
                'patient': "COALESCE(pp.full_name, u.full_name, u.email, 'Unknown User')",
                'status': 'r.status',
            }
            order_column = sort_columns.get(sort_by, 'ah.created_at')
            order_direction = 'ASC' if sort_dir.lower() == 'asc' else 'DESC'
            pagination = ''
            if limit is not None:
                pagination = 'LIMIT %s OFFSET %s'
                params.extend([max(1, min(limit, 100)), max(0, offset)])

            cursor.execute(f"""
                SELECT
                    id,
                    scan_id,
                    user_id,
                    prediction,
                    confidence,
                    risk_score,
                    risk_category,
                    probabilities,
                    explanation,
                    recommendations,
                    report_id,
                    created_at,
                    patient_name,
                    heatmap_url,
                    heatmap_storage_bucket,
                    heatmap_storage_path,
                    status,
                    original_image_url,
                    original_storage_bucket,
                    original_storage_path,
                    report_url,
                    report_storage_bucket,
                    report_storage_path
                FROM (
                    SELECT
                        ah.id,
                        ah.scan_id,
                        ah.user_id,
                        ah.prediction,
                        ah.confidence,
                        ah.risk_score,
                        ah.risk_category,
                        ah.probabilities,
                        ah.explanation,
                        ah.recommendations,
                        ah.report_id,
                        ah.created_at,
                         COALESCE(pp.full_name, u.full_name, u.email, 'Unknown User') AS patient_name,
                        ar.heatmap_url,
                        ar.heatmap_storage_bucket,
                        ar.heatmap_storage_path,
                        r.status,
                        s.image_url AS original_image_url,
                        s.storage_bucket AS original_storage_bucket,
                        s.storage_path AS original_storage_path,
                        r.report_url AS report_url,
                        r.storage_bucket AS report_storage_bucket,
                        r.storage_path AS report_storage_path,
                        ROW_NUMBER() OVER (
                            PARTITION BY ah.id
                            ORDER BY r.created_at DESC NULLS LAST, r.id DESC NULLS LAST
                        ) AS row_number,
                        {order_column} AS order_value
                    FROM analysis_history ah
                    LEFT JOIN analysis_results ar
                        ON ar.scan_id = ah.scan_id AND ar.user_id = ah.user_id
                    LEFT JOIN reports r
                        ON r.scan_id = ah.scan_id
                        AND r.user_id = ah.user_id
                        AND (
                            strpos(r.report_url, ah.report_id) > 0
                            OR strpos(r.storage_path, ah.report_id) > 0
                        )
                    LEFT JOIN scans s
                        ON s.id = ah.scan_id AND s.user_id = ah.user_id
                    JOIN users u ON u.id = ah.user_id
                    LEFT JOIN patient_profiles pp ON pp.user_id = ah.user_id
                    WHERE {' AND '.join(clauses)}
                ) ranked_history
                WHERE row_number = 1
                ORDER BY order_value {order_direction}, created_at DESC
                {pagination}
            """, tuple(params))

            results = cursor.fetchall()

            analyses = []
            for row in results:
                analyses.append(StoredAnalysis(
                    id=str(row['id']),
                    scan_id=str(row['scan_id']),
                    user_id=str(row['user_id']),
                    prediction=row['prediction'],
                    confidence=float(row['confidence']),
                    risk_score=int(row['risk_score']),
                    risk_category=row['risk_category'],
                    probabilities=row['probabilities'] if isinstance(row['probabilities'], dict) else {},
                    explanation=row['explanation'] or '',
                    recommendations=row['recommendations'] if isinstance(row['recommendations'], dict) else {},
                    report_id=row['report_id'],
                    created_at=row['created_at'],
                    report_url=row.get('report_url') or f'/api/v1/reports/{row["report_id"]}/pdf',
                    original_image_url=_scan_image_url(row),
                    heatmap_url=row['heatmap_url'],
                    patient_name=row.get('patient_name'),
                    status=row.get('status') or 'generated',
                    report_storage_bucket=row.get('report_storage_bucket'),
                    report_storage_path=row.get('report_storage_path'),
                    heatmap_storage_bucket=row.get('heatmap_storage_bucket'),
                    heatmap_storage_path=row.get('heatmap_storage_path'),
                ))

            return analyses
        except Exception as e:
            logger.error(f"Failed to get analysis history: {e}")
            raise
        finally:
            if cursor is not None:
                cursor.close()
            self.db.return_connection(conn)

    def count_history(
        self,
        user_id: str,
        *,
        search: str | None = None,
        prediction: str | None = None,
        risk: str | None = None,
        status: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> int:
        """Count filtered analysis history rows for pagination."""
        conn = self.db.get_connection()
        cursor = None
        try:
            cursor = conn.cursor()
            clauses = ['ah.user_id = %s']
            params: list[Any] = [user_id]
            if search:
                wildcard = f'%{search}%'
                clauses.append(
                    '(ah.scan_id::text ILIKE %s OR ah.report_id ILIKE %s OR ah.prediction ILIKE %s OR ah.risk_category ILIKE %s OR COALESCE(pp.full_name, u.full_name, u.email, \'Unknown User\') ILIKE %s OR r.status ILIKE %s)'
                )
                params.extend([wildcard, wildcard, wildcard, wildcard, wildcard, wildcard])
            if prediction:
                clauses.append('ah.prediction = %s')
                params.append(prediction)
            if risk:
                clauses.append('ah.risk_category = %s')
                params.append(risk)
            if status:
                clauses.append('r.status = %s')
                params.append(status)
            if date_from:
                clauses.append('ah.created_at >= %s')
                params.append(date_from)
            if date_to:
                clauses.append('ah.created_at <= %s')
                params.append(date_to)

            cursor.execute(
                f"""
                SELECT COUNT(DISTINCT ah.id)::int
                FROM analysis_history ah
                LEFT JOIN reports r
                    ON r.scan_id = ah.scan_id
                    AND r.user_id = ah.user_id
                    AND (
                        strpos(r.report_url, ah.report_id) > 0
                        OR strpos(r.storage_path, ah.report_id) > 0
                    )
                JOIN users u ON u.id = ah.user_id
                LEFT JOIN patient_profiles pp ON pp.user_id = ah.user_id
                WHERE {' AND '.join(clauses)}
                """,
                tuple(params),
            )
            row = cursor.fetchone()
            return int(row[0] if row else 0)
        except Exception as e:
            logger.error(f"Failed to count analysis history: {e}")
            raise
        finally:
            if cursor is not None:
                cursor.close()
            self.db.return_connection(conn)

    def delete_history_item(self, history_id: str, user_id: str) -> bool:
        """Delete one analysis history row for the current user."""
        conn = self.db.get_connection()
        cursor = None
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(
                """
                SELECT id, scan_id, report_id
                FROM analysis_history
                WHERE id = %s AND user_id = %s
                """,
                (history_id, user_id),
            )
            row = cursor.fetchone()
            if not row:
                conn.rollback()
                return False

            cursor.execute(
                """
                DELETE FROM analysis_history
                WHERE id = %s AND user_id = %s
                """,
                (history_id, user_id),
            )
            deleted = cursor.rowcount > 0
            report_id = row.get('report_id')
            if deleted and report_id:
                report_pattern = f'%{report_id}%'
                cursor.execute(
                    """
                    DELETE FROM reports
                    WHERE user_id = %s
                      AND scan_id = %s
                      AND (report_url ILIKE %s OR storage_path ILIKE %s)
                    """,
                    (user_id, row['scan_id'], report_pattern, report_pattern),
                )
            if deleted:
                self._insert_audit_log(
                    cursor,
                    user_id=user_id,
                    action='analysis_history_deleted',
                    resource_type='analysis_history',
                    resource_id=history_id,
                    metadata={'scan_id': str(row['scan_id']), 'report_id': report_id},
                )
            conn.commit()
            return deleted
        except Exception as e:
            conn.rollback()
            logger.error(f"Failed to delete analysis history item: {e}")
            raise
        finally:
            if cursor is not None:
                cursor.close()
            self.db.return_connection(conn)

    def get_latest(self, user_id: str) -> Optional[StoredAnalysis]:
        """Get latest analysis for user."""
        history = self.list_history(user_id)
        return history[0] if history else None

    def get_latest_global(self) -> Optional[StoredAnalysis]:
        """Get the most recent analysis across all users."""
        conn = self.db.get_connection()
        cursor = None
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(
                """
                SELECT
                    ah.id,
                    ah.scan_id,
                    ah.user_id,
                    ah.prediction,
                    ah.confidence,
                    ah.risk_score,
                    ah.risk_category,
                    ah.probabilities,
                    ah.explanation,
                    ah.recommendations,
                    ah.report_id,
                    ah.created_at,
                    ar.heatmap_url,
                    s.image_url AS original_image_url,
                    s.storage_bucket AS original_storage_bucket,
                    s.storage_path AS original_storage_path
                FROM analysis_history ah
                LEFT JOIN analysis_results ar
                    ON ar.scan_id = ah.scan_id AND ar.user_id = ah.user_id
                LEFT JOIN scans s
                    ON s.id = ah.scan_id AND s.user_id = ah.user_id
                ORDER BY ah.created_at DESC
                LIMIT 1
                """
            )
            row = cursor.fetchone()
            if not row:
                return None
            return StoredAnalysis(
                id=str(row['id']),
                scan_id=str(row['scan_id']),
                user_id=str(row['user_id']),
                prediction=row['prediction'],
                confidence=float(row['confidence']),
                risk_score=int(row['risk_score']),
                risk_category=row['risk_category'],
                probabilities=row['probabilities'] if isinstance(row['probabilities'], dict) else {},
                explanation=row['explanation'] or '',
                recommendations=row['recommendations'] if isinstance(row['recommendations'], dict) else {},
                report_id=row['report_id'],
                created_at=row['created_at'],
                report_url=f'/api/v1/reports/{row["report_id"]}/pdf',
                original_image_url=_scan_image_url(row),
                heatmap_url=row['heatmap_url'],
            )
        finally:
            if cursor is not None:
                cursor.close()
            self.db.return_connection(conn)

    def assign_patient_to_doctor(
        self,
        doctor_id: str,
        patient_id: str,
        assigned_by: str | None = None,
    ) -> dict[str, Any]:
        """Assign or update patient assignment to a clinician."""
        conn = self.db.get_connection()
        cursor = None
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(
                """
                UPDATE doctor_patient_assignments
                SET status = 'Inactive', updated_at = CURRENT_TIMESTAMP
                WHERE patient_id = %s AND status = 'Active'
                """,
                (patient_id,),
            )
            assignment_id = str(uuid4())
            cursor.execute(
                """
                INSERT INTO doctor_patient_assignments (id, doctor_id, patient_id, assigned_by, status, created_at, updated_at)
                VALUES (%s, %s, %s, %s, 'Active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING id, doctor_id, patient_id, assigned_by, status, created_at
                """,
                (assignment_id, doctor_id, patient_id, assigned_by),
            )
            row = cursor.fetchone()
            conn.commit()

            cursor.execute("SELECT full_name FROM users WHERE id = %s", (doctor_id,))
            doc_row = cursor.fetchone()
            cursor.execute(
                "SELECT COALESCE(full_name, name) AS name FROM users WHERE id = %s",
                (patient_id,),
            )
            pat_row = cursor.fetchone()

            return {
                'id': str(row['id']),
                'doctor_id': str(row['doctor_id']),
                'doctor_name': doc_row['full_name'] if doc_row else 'Clinician',
                'patient_id': str(row['patient_id']),
                'patient_name': pat_row['name'] if pat_row else 'Patient',
                'assigned_by': str(row['assigned_by']) if row['assigned_by'] else None,
                'status': row['status'],
                'created_at': row['created_at'],
            }
        except Exception as e:
            conn.rollback()
            logger.error(f"Failed to assign patient to doctor: {e}")
            raise
        finally:
            if cursor is not None:
                cursor.close()
            self.db.return_connection(conn)

    def get_assigned_doctor(self, patient_id: str) -> dict[str, Any] | None:
        """Fetch currently active clinician assignment for a patient."""
        conn = self.db.get_connection()
        cursor = None
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(
                """
                SELECT dpa.id, dpa.doctor_id, dpa.patient_id, u.full_name AS doctor_name, u.email AS doctor_email, dpa.status, dpa.created_at
                FROM doctor_patient_assignments dpa
                JOIN users u ON u.id = dpa.doctor_id
                WHERE dpa.patient_id = %s AND dpa.status = 'Active'
                ORDER BY dpa.created_at DESC
                LIMIT 1
                """,
                (patient_id,),
            )
            row = cursor.fetchone()
            if not row:
                return None
            return {
                'id': str(row['id']),
                'doctor_id': str(row['doctor_id']),
                'patient_id': str(row['patient_id']),
                'doctor_name': row['doctor_name'],
                'doctor_email': row['doctor_email'],
                'status': row['status'],
                'created_at': row['created_at'],
            }
        except Exception as e:
            logger.error(f"Failed to get assigned doctor: {e}")
            raise
        finally:
            if cursor is not None:
                cursor.close()
            self.db.return_connection(conn)

    def is_patient_assigned_to_doctor(self, patient_id: str, doctor_id: str) -> bool:
        """Verify if patient is actively assigned to given doctor."""
        conn = self.db.get_connection()
        cursor = None
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT 1 FROM doctor_patient_assignments
                WHERE patient_id = %s AND doctor_id = %s AND status = 'Active'
                LIMIT 1
                """,
                (patient_id, doctor_id),
            )
            return cursor.fetchone() is not None
        except Exception as e:
            logger.error(f"Failed to check assignment: {e}")
            return False
        finally:
            if cursor is not None:
                cursor.close()
            self.db.return_connection(conn)

    def get_doctor_summary(self, doctor_id: str) -> dict[str, Any]:
        """Aggregate truthful metrics for an authorized clinician."""
        conn = self.db.get_connection()
        cursor = None
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(
                """
                SELECT COUNT(DISTINCT patient_id)::int AS assigned_patients
                FROM doctor_patient_assignments
                WHERE doctor_id = %s AND status = 'Active'
                """,
                (doctor_id,),
            )
            pat_row = cursor.fetchone() or {}
            assigned_patients = int(pat_row.get('assigned_patients') or 0)

            cursor.execute(
                """
                SELECT
                    COUNT(DISTINCT s.id) FILTER (WHERE COALESCE(s.review_status, 'awaiting_review') IN ('awaiting_review', 'uploaded', 'processing'))::int AS scans_awaiting_review,
                    COUNT(DISTINCT s.id) FILTER (WHERE s.review_status = 'reviewed' OR s.reviewed_by = %s)::int AS reviewed_scans,
                    COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'failed' OR s.review_status = 'requires_retest')::int AS failed_scans
                FROM scans s
                LEFT JOIN doctor_patient_assignments dpa
                    ON dpa.patient_id = s.user_id AND dpa.status = 'Active'
                WHERE dpa.doctor_id = %s OR s.reviewed_by = %s OR dpa.doctor_id IS NULL
                """,
                (doctor_id, doctor_id, doctor_id),
            )
            scan_counts = cursor.fetchone() or {}

            cursor.execute(
                """
                SELECT COUNT(DISTINCT r.id)::int AS reports_ready
                FROM reports r
                LEFT JOIN doctor_patient_assignments dpa
                    ON dpa.patient_id = r.user_id AND dpa.status = 'Active'
                WHERE (dpa.doctor_id = %s OR dpa.doctor_id IS NULL)
                  AND r.status = 'generated'
                  AND COALESCE(r.review_status, 'awaiting_review') = 'awaiting_review'
                """,
                (doctor_id,),
            )
            rep_counts = cursor.fetchone() or {}

            cursor.execute(
                """
                SELECT COUNT(DISTINCT ah.id)::int AS urgent_cases
                FROM analysis_history ah
                LEFT JOIN doctor_patient_assignments dpa
                    ON dpa.patient_id = ah.user_id AND dpa.status = 'Active'
                WHERE (dpa.doctor_id = %s OR dpa.doctor_id IS NULL)
                  AND ah.risk_category IN ('High', 'Critical')
                """,
                (doctor_id,),
            )
            urg_counts = cursor.fetchone() or {}

            queue_items = self.list_clinical_queue(doctor_id=doctor_id, limit=10)
            worklist_items = self.list_patient_worklist(doctor_id=doctor_id, limit=10)

            return {
                'assigned_patients': assigned_patients,
                'scans_awaiting_review': int(scan_counts.get('scans_awaiting_review') or 0),
                'reports_ready': int(rep_counts.get('reports_ready') or 0),
                'reviewed_scans': int(scan_counts.get('reviewed_scans') or 0),
                'failed_scans': int(scan_counts.get('failed_scans') or 0),
                'urgent_cases': int(urg_counts.get('urgent_cases') or 0),
                'review_queue': queue_items,
                'recent_patients': worklist_items,
            }
        except Exception as e:
            logger.error(f"Failed to build doctor summary: {e}")
            raise
        finally:
            if cursor is not None:
                cursor.close()
            self.db.return_connection(conn)

    def list_clinical_queue(
        self,
        doctor_id: str | None = None,
        status_filter: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        search: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        """List review queue items with filter support."""
        conn = self.db.get_connection()
        cursor = None
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            clauses = []
            params: list[Any] = []

            if doctor_id:
                clauses.append("(dpa.doctor_id = %s OR s.reviewed_by = %s OR dpa.doctor_id IS NULL)")
                params.extend([doctor_id, doctor_id])

            if status_filter:
                norm_status = status_filter.lower().strip()
                if norm_status in ('awaiting_review', 'awaiting review'):
                    clauses.append("COALESCE(s.review_status, 'awaiting_review') = 'awaiting_review'")
                elif norm_status in ('reviewed',):
                    clauses.append("COALESCE(s.review_status, 'awaiting_review') = 'reviewed'")
                elif norm_status in ('prediction_ready', 'prediction ready'):
                    clauses.append("ah.prediction IS NOT NULL")
                elif norm_status in ('report_ready', 'report ready'):
                    clauses.append("r.status = 'generated'")
                elif norm_status in ('failed', 'requires_retest'):
                    clauses.append("(s.status = 'failed' OR s.review_status = 'requires_retest')")

            if date_from:
                clauses.append("s.created_at >= %s")
                params.append(date_from)
            if date_to:
                clauses.append("s.created_at <= %s")
                params.append(date_to)

            if search:
                clauses.append("(s.id::text ILIKE %s OR u.full_name ILIKE %s OR pp.patient_id ILIKE %s OR ah.prediction ILIKE %s)")
                p = f'%{search}%'
                params.extend([p, p, p, p])

            where_str = f"WHERE {' AND '.join(clauses)}" if clauses else ""

            params.extend([limit, offset])

            cursor.execute(
                f"""
                SELECT
                    s.id AS scan_id,
                    s.user_id AS patient_id,
                    COALESCE(pp.full_name, u.full_name, u.email, 'Unknown Patient') AS patient_name,
                    COALESCE(pp.patient_id, 'PT-' || SUBSTRING(s.user_id::text, 1, 8)) AS patient_identifier,
                    s.created_at AS scan_date,
                    ah.prediction,
                    ah.confidence,
                    ah.risk_category,
                    r.id AS report_row_id,
                    ah.report_id,
                    COALESCE(r.status, 'pending') AS report_status,
                    COALESCE(s.review_status, 'awaiting_review') AS review_status,
                    doc_user.full_name AS assigned_doctor,
                    rev_user.full_name AS reviewer_name,
                    s.reviewed_at,
                    s.review_notes,
                    s.image_url AS original_image_url,
                    s.storage_bucket AS original_storage_bucket,
                    s.storage_path AS original_storage_path,
                    ar.heatmap_url
                FROM scans s
                JOIN users u ON u.id = s.user_id
                LEFT JOIN patient_profiles pp ON pp.user_id = s.user_id
                LEFT JOIN doctor_patient_assignments dpa ON dpa.patient_id = s.user_id AND dpa.status = 'Active'
                LEFT JOIN users doc_user ON doc_user.id = dpa.doctor_id
                LEFT JOIN users rev_user ON rev_user.id = s.reviewed_by
                LEFT JOIN analysis_history ah ON ah.scan_id = s.id
                LEFT JOIN analysis_results ar ON ar.scan_id = s.id
                LEFT JOIN reports r ON r.scan_id = s.id
                {where_str}
                ORDER BY s.created_at DESC
                LIMIT %s OFFSET %s
                """,
                tuple(params),
            )
            rows = cursor.fetchall()
            items = []
            for r in rows:
                items.append({
                    'id': str(r['scan_id']),
                    'scan_id': str(r['scan_id']),
                    'patient_id': str(r['patient_id']),
                    'patient_name': r['patient_name'],
                    'patient_identifier': r['patient_identifier'],
                    'date': r['scan_date'],
                    'prediction': r['prediction'],
                    'confidence': float(r['confidence']) if r['confidence'] is not None else None,
                    'risk_category': r['risk_category'],
                    'report_id': str(r['report_id']) if r['report_id'] else None,
                    'report_status': r['report_status'],
                    'review_status': r['review_status'],
                    'assigned_doctor': r['assigned_doctor'],
                    'reviewer_name': r['reviewer_name'],
                    'reviewed_at': r['reviewed_at'],
                    'review_notes': r['review_notes'],
                    'original_image_url': _scan_image_url(r),
                    'heatmap_url': r['heatmap_url'],
                })
            return items
        except Exception as e:
            logger.error(f"Failed to list clinical queue: {e}")
            raise
        finally:
            if cursor is not None:
                cursor.close()
            self.db.return_connection(conn)

    def list_patient_worklist(
        self,
        doctor_id: str,
        search: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        """List patients actively assigned to the clinician."""
        conn = self.db.get_connection()
        cursor = None
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            clauses = ["dpa.doctor_id = %s", "dpa.status = 'Active'"]
            params: list[Any] = [doctor_id]

            if search:
                clauses.append("(u.full_name ILIKE %s OR pp.patient_id ILIKE %s OR u.email ILIKE %s)")
                p = f'%{search}%'
                params.extend([p, p, p])

            where_str = f"WHERE {' AND '.join(clauses)}"
            params.extend([limit, offset])

            cursor.execute(
                f"""
                SELECT
                    u.id AS user_id,
                    COALESCE(pp.patient_id, 'PT-' || SUBSTRING(u.id::text, 1, 8)) AS patient_id,
                    COALESCE(pp.full_name, u.full_name, u.email) AS full_name,
                    pp.age,
                    pp.gender,
                    pp.blood_group,
                    u.total_scans,
                    dpa.status AS assignment_status,
                    latest_scan.created_at AS latest_scan_date,
                    latest_scan.prediction AS latest_prediction,
                    latest_scan.risk_category AS latest_risk,
                    COALESCE(latest_scan.review_status, 'No Scans') AS review_status
                FROM doctor_patient_assignments dpa
                JOIN users u ON u.id = dpa.patient_id
                LEFT JOIN patient_profiles pp ON pp.user_id = u.id
                LEFT JOIN LATERAL (
                    SELECT s.created_at, ah.prediction, ah.risk_category, s.review_status
                    FROM scans s
                    LEFT JOIN analysis_history ah ON ah.scan_id = s.id
                    WHERE s.user_id = u.id
                    ORDER BY s.created_at DESC
                    LIMIT 1
                ) latest_scan ON TRUE
                {where_str}
                ORDER BY dpa.created_at DESC
                LIMIT %s OFFSET %s
                """,
                tuple(params),
            )
            rows = cursor.fetchall()
            items = []
            for r in rows:
                items.append({
                    'patient_id': str(r['patient_id']),
                    'user_id': str(r['user_id']),
                    'full_name': r['full_name'],
                    'age': r['age'],
                    'gender': r['gender'],
                    'blood_group': r['blood_group'],
                    'total_scans': int(r['total_scans'] or 0),
                    'latest_scan_date': r['latest_scan_date'],
                    'latest_prediction': r['latest_prediction'],
                    'latest_risk': r['latest_risk'],
                    'review_status': r['review_status'] or 'No Scans',
                    'assignment_status': r['assignment_status'],
                })
            return items
        except Exception as e:
            logger.error(f"Failed to list patient worklist: {e}")
            raise
        finally:
            if cursor is not None:
                cursor.close()
            self.db.return_connection(conn)

    def record_clinical_review(
        self,
        scan_id: str,
        doctor_id: str,
        review_status: str,
        review_notes: str | None = None,
    ) -> dict[str, Any]:
        """Record clinician review decision, timestamp, notes and reviewer identity."""
        conn = self.db.get_connection()
        cursor = None
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            now = datetime.now(timezone.utc)
            cursor.execute(
                """
                UPDATE scans
                SET review_status = %s,
                    reviewed_by = %s,
                    reviewed_at = %s,
                    review_notes = %s
                WHERE id = %s
                RETURNING id, user_id, review_status, reviewed_by, reviewed_at, review_notes
                """,
                (review_status, doctor_id, now, review_notes, scan_id),
            )
            scan_row = cursor.fetchone()
            if not scan_row:
                raise ValueError(f"Scan {scan_id} not found")

            cursor.execute(
                """
                UPDATE reports
                SET review_status = %s,
                    reviewed_by = %s,
                    reviewed_at = %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE scan_id = %s
                """,
                (review_status, doctor_id, now, scan_id),
            )

            if review_notes and review_notes.strip():
                note_id = str(uuid4())
                cursor.execute(
                    """
                    INSERT INTO doctor_notes (id, scan_id, doctor_id, title, note, severity, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (note_id, scan_id, doctor_id, 'Clinical Review Note', review_notes.strip(), 'Normal', now, now),
                )

            import json
            try:
                cursor.execute(
                    """
                    INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, metadata, created_at)
                    VALUES (%s, %s, 'clinical_review_recorded', 'scan', %s, %s, %s)
                    """,
                    (
                        str(uuid4()),
                        doctor_id,
                        scan_id,
                        json.dumps({'review_status': review_status, 'notes_included': bool(review_notes)}),
                        now,
                    ),
                )
            except Exception as audit_err:
                logger.warning(f"Audit log writing skipped: {audit_err}")

            conn.commit()

            cursor.execute("SELECT full_name FROM users WHERE id = %s", (doctor_id,))
            doc_user = cursor.fetchone()

            return {
                'scan_id': str(scan_row['id']),
                'review_status': scan_row['review_status'],
                'reviewed_by': str(scan_row['reviewed_by']),
                'reviewer_name': doc_user['full_name'] if doc_user else 'Clinician',
                'reviewed_at': scan_row['reviewed_at'],
                'notes': scan_row['review_notes'],
            }
        except Exception as e:
            conn.rollback()
            logger.error(f"Failed to record clinical review: {e}")
            raise
        finally:
            if cursor is not None:
                cursor.close()
            self.db.return_connection(conn)

    def can_user_access_scan(self, user_id: str, role: str, scan_id: str) -> bool:
        """Enforce backend authorization check on a scan record."""
        if role in ('Admin',):
            return True
        conn = self.db.get_connection()
        cursor = None
        try:
            cursor = conn.cursor()
            if role in ('User',):
                cursor.execute("SELECT 1 FROM scans WHERE id = %s AND user_id = %s", (scan_id, user_id))
                return cursor.fetchone() is not None
            elif role in ('Doctor',):
                cursor.execute(
                    """
                    SELECT 1 FROM scans s
                    LEFT JOIN doctor_patient_assignments dpa
                        ON dpa.patient_id = s.user_id AND dpa.status = 'Active'
                    WHERE s.id = %s
                      AND (dpa.doctor_id = %s OR s.reviewed_by = %s OR dpa.doctor_id IS NULL)
                    LIMIT 1
                    """,
                    (scan_id, user_id, user_id),
                )
                return cursor.fetchone() is not None
            return False
        except Exception as e:
            logger.error(f"Failed scan authorization check: {e}")
            return False
        finally:
            if cursor is not None:
                cursor.close()
            self.db.return_connection(conn)

    def can_user_access_report(self, user_id: str, role: str, report_id: str) -> bool:
        """Enforce backend authorization check on a report record."""
        if role in ('Admin',):
            return True
        conn = self.db.get_connection()
        cursor = None
        try:
            cursor = conn.cursor()
            if role in ('User',):
                cursor.execute(
                    """
                    SELECT 1 FROM analysis_history ah
                    WHERE ah.report_id = %s AND ah.user_id = %s
                    LIMIT 1
                    """,
                    (report_id, user_id),
                )
                return cursor.fetchone() is not None
            elif role in ('Doctor',):
                cursor.execute(
                    """
                    SELECT 1 FROM analysis_history ah
                    JOIN scans s ON s.id = ah.scan_id
                    LEFT JOIN doctor_patient_assignments dpa
                        ON dpa.patient_id = ah.user_id AND dpa.status = 'Active'
                    WHERE ah.report_id = %s
                      AND (dpa.doctor_id = %s OR s.reviewed_by = %s OR dpa.doctor_id IS NULL)
                    LIMIT 1
                    """,
                    (report_id, user_id, user_id),
                )
                return cursor.fetchone() is not None
            return False
        except Exception as e:
            logger.error(f"Failed report authorization check: {e}")
            return False
        finally:
            if cursor is not None:
                cursor.close()
            self.db.return_connection(conn)


# Global store instance
_store: Optional[SupabaseStore] = None


def get_store() -> SupabaseStore:
    """Get or initialize the store."""
    global _store
    if _store is None:
        _store = SupabaseStore()
    return _store


# For backward compatibility
store = None  # Will be initialized at startup


def initialize_store():
    """Initialize the store at application startup."""
    global store
    store = get_store()
    return store
