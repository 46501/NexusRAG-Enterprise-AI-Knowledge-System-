from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.db.models import RoleEnum, User
from app.db.postgres import get_db
from app.schemas.auth import (
    LoginRequest,
    SignupRequest,
    SignupResponse,
    TokenResponse,
    UserResponse,
)
from app.services.auth_service import (
    authenticate_user,
    create_tokens,
    register_user,
    revoke_refresh_token,
    rotate_refresh_token,
)
from app.config import get_settings
from app.state import limiter

router = APIRouter(prefix="/auth", tags=["auth"])
_s = get_settings()


def _get_cookie_opts(request: Request) -> dict:
    is_secure = _s.app_env == "production" and (
        request.url.scheme == "https"
        or request.headers.get("x-forwarded-proto") == "https"
    )
    return {
        "httponly": True,
        "samesite": "lax",
        "secure": is_secure,
    }


@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
@router.post("/signup/", response_model=SignupResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
@limiter.limit("30/minute")
async def signup(request: Request, body: SignupRequest, db: AsyncSession = Depends(get_db)):
    if body.department in (RoleEnum.admin, RoleEnum.demo_admin):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Public registration cannot grant administrative privileges.",
        )
    try:
        user = await register_user(
            db=db,
            email=body.email,
            password=body.password,
            role=body.department,
            full_name=body.full_name,
        )
        await db.commit()
    except ValueError as exc:
        err_msg = str(exc)
        if "already registered" in err_msg.lower():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered.")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err_msg)

    return SignupResponse(
        message="Account created successfully. You can now log in.",
        user=UserResponse(
            id=str(user.id),
            email=user.email,
            role=user.role,
            full_name=user.full_name,
            is_active=user.is_active,
        ),
    )


@router.post("/login", response_model=TokenResponse)
@router.post("/login/", response_model=TokenResponse, include_in_schema=False)
@limiter.limit("60/minute")
async def login(request: Request, body: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    try:
        user = await authenticate_user(db, body.email, body.password)
        access, refresh = await create_tokens(db, user)
        await db.commit()
    except ValueError as exc:
        err_msg = str(exc).lower()
        if "inactive" in err_msg:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is inactive or pending approval.",
            )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    cookie_opts = _get_cookie_opts(request)
    response.set_cookie("access_token", access, max_age=_s.jwt_access_token_expire_minutes * 60, **cookie_opts)
    response.set_cookie("refresh_token", refresh, max_age=_s.jwt_refresh_token_expire_days * 86400, **cookie_opts)
    return TokenResponse(access_token=access)


@router.post("/refresh", response_model=TokenResponse)
@router.post("/refresh/", response_model=TokenResponse, include_in_schema=False)
async def refresh(
    request: Request,
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
):
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh token")
    try:
        access, new_refresh, _ = await rotate_refresh_token(db, refresh_token)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token invalid or expired")

    cookie_opts = _get_cookie_opts(request)
    response.set_cookie("access_token", access, max_age=_s.jwt_access_token_expire_minutes * 60, **cookie_opts)
    response.set_cookie("refresh_token", new_refresh, max_age=_s.jwt_refresh_token_expire_days * 86400, **cookie_opts)
    return TokenResponse(access_token=access)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
@router.post("/logout/", status_code=status.HTTP_204_NO_CONTENT, include_in_schema=False)
async def logout(
    request: Request,
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if refresh_token:
        await revoke_refresh_token(db, refresh_token)
    cookie_opts = _get_cookie_opts(request)
    response.delete_cookie("access_token", httponly=cookie_opts["httponly"], samesite=cookie_opts["samesite"], secure=cookie_opts["secure"])
    response.delete_cookie("refresh_token", httponly=cookie_opts["httponly"], samesite=cookie_opts["samesite"], secure=cookie_opts["secure"])


@router.get("/me", response_model=UserResponse)
@router.get("/me/", response_model=UserResponse, include_in_schema=False)
async def me(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        role=current_user.role,
        full_name=current_user.full_name,
        is_active=current_user.is_active,
    )
