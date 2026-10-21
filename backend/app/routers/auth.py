import logging
import traceback

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from psycopg2 import IntegrityError

from ..core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
)
from ..models.schemas import (
    DoctorApplicationCreate,
    Role,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserOut,
    RefreshTokenRequest,
    LogoutRequest
)
from ..services.supabase_store import get_store

router = APIRouter(prefix='/auth', tags=['auth'])
security = HTTPBearer(auto_error=False)
logger = logging.getLogger(__name__)


def current_user_dependency(credentials: HTTPAuthorizationCredentials = Depends(security)) -> UserOut:
    """Dependency to get current authenticated user from verified Supabase or legacy token."""
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Authentication required')

    try:
        payload = decode_token(credentials.credentials, token_type='access')
    except HTTPException:
        raise

    sub = payload.get('sub')
    if not sub:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid token: missing subject claim')

    store = get_store()
    # If sub is a UUID, attempt lookup by ID first (Supabase Auth format)
    user = None
    if '-' in sub and len(sub) == 36:
        user = store.get_user_by_id(sub)

    # Fallback to lookup by email or sub as email
    if not user:
        email = payload.get('email') or sub
        user = store.get_user(email)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Authenticated user has no registered profile in public.users',
        )

    # Legacy token revocation check
    if 'ver' in payload:
        token_version = int(payload.get('ver') or 0)
        if token_version != user.access_token_version:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Authentication token has been revoked')

    return UserOut(**user.to_public_dict())


def issue_token_pair(user) -> TokenResponse:
    """Create an access token and a persisted refresh token for a user."""
    store = get_store()
    access_token = create_access_token(
        subject=user.email,
        role=user.role,
        token_version=user.access_token_version,
    )
    refresh_token, token_id, expires_at = create_refresh_token(subject=user.email, role=user.role)
    store.save_refresh_token(
        user_id=user.id,
        token_id=token_id,
        refresh_token=refresh_token,
        expires_at=expires_at,
    )
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserOut(**user.to_public_dict())
    )


@router.post('/register', response_model=TokenResponse)
def register(payload: UserCreate):
    """Register a new user and return tokens."""
    try:
        store = get_store()

        email = payload.email.lower()

        if store.user_exists(email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='Email already registered'
            )

        # Enforce server-side role restriction: Public registration is strictly Role.user (Patient)
        user = store.create_user(
            full_name=payload.full_name,
            email=email,
            password=payload.password,
            role=Role.user.value
        )

        return issue_token_pair(user)
    except HTTPException:
        raise
    except IntegrityError as exc:
        print("REGISTER ERROR:", str(exc))
        traceback.print_exc()
        logger.exception("REGISTER ERROR: database integrity error")
        detail = 'Email already registered' if 'users_email_key' in str(exc) else 'Registration data violates database constraints'
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail,
        ) from exc
    except Exception as exc:
        print("REGISTER ERROR:", str(exc))
        traceback.print_exc()
        logger.exception("REGISTER ERROR: unexpected registration failure")
        raise


@router.post('/apply-doctor')
def apply_doctor(payload: DoctorApplicationCreate):
    """
    Secure Doctor registration endpoint.
    Creates user account with baseline 'User' (Patient) privileges and creates a
    pending application in doctor_applications awaiting trusted administrator approval.
    """
    store = get_store()
    email = payload.email.lower().strip()

    # Check if a pending or approved application already exists
    existing_app = store.get_doctor_application_by_email(email)
    if existing_app and existing_app['status'] == 'pending':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='A doctor application for this email is already pending administrative review.'
        )
    if existing_app and existing_app['status'] == 'approved':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='A verified doctor account already exists for this email. Please sign in.'
        )

    # Find or create base user account strictly with Role.user (never elevated automatically)
    user = store.get_user(email)
    if not user:
        try:
            user = store.create_user(
                full_name=payload.full_name.strip(),
                email=email,
                password=payload.password,
                role=Role.user.value
            )
        except IntegrityError:
            user = store.get_user(email)
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail='Failed to register account credentials.'
                )

    app_record = store.create_doctor_application(
        user_id=user.id,
        full_name=payload.full_name.strip(),
        email=email,
        license_number=payload.license_number.strip(),
        specialization=payload.specialization.strip(),
        hospital_affiliation=payload.hospital_affiliation.strip(),
    )

    return {
        'status': 'pending',
        'message': 'Doctor registration submitted successfully. Your credentials are under administrative review. Access to the Doctor Dashboard will be enabled once approved by an administrator.',
        'application_id': app_record.get('id'),
        'user': {
            'id': user.id,
            'full_name': user.full_name,
            'email': user.email,
            'role': Role.user.value,
        }
    }


@router.post('/login', response_model=TokenResponse)
def login(payload: UserLogin):
    """Login user and return tokens."""
    store = get_store()
    user = store.authenticate(payload.email.lower(), payload.password)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Invalid credentials'
        )

    return issue_token_pair(user)


@router.post('/refresh', response_model=TokenResponse)
def refresh(payload: RefreshTokenRequest):
    """Refresh access token using refresh token."""
    try:
        refresh_payload = decode_token(payload.refresh_token, token_type='refresh')
    except HTTPException:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Invalid or expired refresh token'
        )

    email = refresh_payload.get('sub')
    token_id = refresh_payload.get('jti')

    store = get_store()
    if not token_id or not store.refresh_token_is_active(token_id, payload.refresh_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Invalid or expired refresh token'
        )

    user = store.get_user(email)

    if not user:
        store.revoke_refresh_token(token_id)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='User not found'
        )

    store.revoke_refresh_token(token_id)
    return issue_token_pair(user)


@router.post('/logout')
def logout(payload: LogoutRequest):
    """Logout user by revoking the presented refresh token."""
    if payload.refresh_token:
        try:
            refresh_payload = decode_token(payload.refresh_token, token_type='refresh')
            email = refresh_payload.get('sub')
            token_id = refresh_payload.get('jti')
            store = get_store()
            user = store.get_user(email) if email else None
            if token_id:
                store.revoke_refresh_token(token_id)
            if user:
                store.invalidate_user_access_tokens(user.id)
        except HTTPException:
            pass

    return {'message': 'Successfully logged out'}


@router.get('/me', response_model=UserOut)
def me(user: UserOut = Depends(current_user_dependency)):
    """Get current user information."""
    return user
