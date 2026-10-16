"""Role-based access control decorators and utilities."""

from functools import wraps
from typing import Callable, List

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from ..core.security import decode_token
from ..models.schemas import Role, UserOut
from ..services.supabase_store import get_store

security = HTTPBearer(auto_error=False)


def require_role(*allowed_roles: Role) -> Callable:
    """Decorator to require specific roles for a route."""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(
            credentials: HTTPAuthorizationCredentials = Depends(security),
            *args,
            **kwargs
        ):
            if not credentials:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail='Authentication required'
                )

            try:
                payload = decode_token(credentials.credentials, token_type='access')
            except HTTPException:
                raise

            user_role = payload.get('role')

            allowed_role_values = [role.value for role in allowed_roles]
            if user_role not in allowed_role_values:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f'This action requires one of the following roles: {", ".join(allowed_role_values)}'
                )

            email = payload.get('sub')
            store = get_store()
            user = store.get_user(email)

            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail='User not found'
                )

            kwargs['current_user'] = UserOut(**user.to_public_dict())
            return await func(*args, **kwargs)

        return wrapper

    return decorator


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> UserOut:
    """Get current authenticated user."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Authentication required'
        )

    try:
        payload = decode_token(credentials.credentials, token_type='access')
    except HTTPException:
        raise

    email = payload.get('sub')
    store = get_store()
    user = store.get_user(email)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='User not found'
        )

    return UserOut(**user.to_public_dict())


def require_roles(*allowed_roles: Role):
    """Dependency for requiring specific roles."""
    def check_role(current_user: UserOut = Depends(get_current_user)) -> UserOut:
        allowed_role_values = [role.value for role in allowed_roles]
        current_role = current_user.role.value if isinstance(current_user.role, Role) else current_user.role
        if current_role not in allowed_role_values:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f'Insufficient permissions. Required roles: {", ".join(allowed_role_values)}'
            )
        return current_user

    return check_role
