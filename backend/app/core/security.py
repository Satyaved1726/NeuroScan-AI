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


def decode_token(token: str, token_type: str = 'access') -> dict:
    """Decode and validate a JWT token."""
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])

        # Validate token type
        if payload.get('type') != token_type:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f'Invalid token type. Expected {token_type}'
            )

        return payload
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Invalid or expired authentication token'
        ) from exc


def hash_token(token: str) -> str:
    """Create a deterministic SHA-256 hash for persisted token lookup."""
    return sha256(token.encode('utf-8')).hexdigest()


def role_allowed(user_role: str, allowed_roles: Iterable[str]) -> bool:
    """Check if user role is allowed."""
    return user_role in allowed_roles
