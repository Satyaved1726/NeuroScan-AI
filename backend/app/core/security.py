from datetime import datetime, timedelta, timezone
from hashlib import sha256
from typing import Iterable
from uuid import uuid4

from fastapi import HTTPException, status
from jose import JWTError, jwt
from passlib.context import CryptContext

from .config import get_settings

pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(
    subject: str,
    role: str,
    expires_delta: timedelta | None = None,
    token_version: int = 0,
) -> str:
    """Create a JWT access token."""
    settings = get_settings()
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.access_token_expire_minutes)

    issued_at = datetime.now(timezone.utc)
    expire = issued_at + expires_delta
    payload = {
        'sub': subject,
        'role': role,
        'jti': str(uuid4()),
        'iat': int(issued_at.timestamp()),
        'ver': token_version,
        'exp': expire,
        'type': 'access'
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(subject: str, role: str) -> tuple[str, str, datetime]:
    """Create a JWT refresh token."""
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    token_id = str(uuid4())
    payload = {
        'sub': subject,
        'role': role,
        'jti': token_id,
        'exp': expire,
        'type': 'refresh'
    }
    token = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return token, token_id, expire


def decode_supabase_token(token: str) -> dict:
    """Decode and validate a Supabase-issued JWT token with signature verification."""
    settings = get_settings()
    secret = settings.supabase_jwt_secret or settings.jwt_secret_key

    try:
        # Supabase JWTs use HS256 signed with the project's JWT Secret
        # They contain: sub (UUID), role ('authenticated'), aud ('authenticated'), exp, email
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            options={
                "verify_aud": False,  # Supabase sets aud: 'authenticated'
                "verify_signature": True,
            },
        )
        return payload
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
        ) from exc


def decode_token(token: str, token_type: str = 'access') -> dict:
    """Decode and validate a JWT token (supporting both Supabase and legacy tokens)."""
    settings = get_settings()

    # First attempt decoding as a Supabase JWT if supabase_jwt_secret is available or token matches Supabase structure
    secret_candidates = []
    if settings.supabase_jwt_secret:
        secret_candidates.append(settings.supabase_jwt_secret)
    if settings.jwt_secret_key and settings.jwt_secret_key not in secret_candidates:
        secret_candidates.append(settings.jwt_secret_key)

    last_error = None
    for secret in secret_candidates:
        try:
            payload = jwt.decode(
                token,
                secret,
                algorithms=["HS256"],
                options={"verify_signature": True, "verify_aud": False},
            )
            # If token is a legacy custom token with an explicit 'type' field, check it
            if 'type' in payload and payload.get('type') != token_type:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"Invalid token type. Expected {token_type}",
                )
            return payload
        except JWTError as exc:
            last_error = exc

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication token",
    ) from last_error


def hash_token(token: str) -> str:
    """Create a deterministic SHA-256 hash for persisted token lookup."""
    return sha256(token.encode('utf-8')).hexdigest()


def role_allowed(user_role: str, allowed_roles: Iterable[str]) -> bool:
    """Check if user role is allowed."""
    return user_role in allowed_roles
