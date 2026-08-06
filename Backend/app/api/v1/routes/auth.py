from typing import Optional
import logging

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from authlib.integrations.starlette_client import OAuth
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.future import select

from app.core.config import settings
from app.core.security import create_jwt, hash_password, verify_password
from app.db.sessions import AsyncSessionLocal
from app.modals.user import User
import urllib.parse


logger = logging.getLogger(__name__)

router = APIRouter()


oauth = OAuth()
CONF = {
    'client_id': settings.GOOGLE_CLIENT_ID,
    'client_secret': settings.GOOGLE_CLIENT_SECRET,
    'authorize_url': 'https://accounts.google.com/o/oauth2/v2/auth',
    'access_token_url': 'https://oauth2.googleapis.com/token',
    'userinfo_endpoint': 'https://openidconnect.googleapis.com/v1/userinfo'
}


oauth.register('google', client_id=CONF['client_id'], client_secret=CONF['client_secret'],
               server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
               client_kwargs={'scope': 'openid email profile'})


class EmailRegisterPayload(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    name: Optional[str] = None


class EmailLoginPayload(BaseModel):
    email: EmailStr
    password: str


def _normalize_email(value: str) -> str:
    return value.strip().lower()


def _user_to_response(user: User, token: str) -> dict:
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "avatar": user.avatar,
        },
    }


@router.post('/register', status_code=status.HTTP_201_CREATED)
async def register_user(payload: EmailRegisterPayload):
    email = _normalize_email(payload.email)
    password_bytes = payload.password.encode()
    logger.debug(
        "Register request for email=%s password_bytes_len=%d trimmed_preview=%s",
        email,
        len(password_bytes),
        payload.password[:8] + ("…" if len(payload.password) > 8 else ""),
    )

    if len(password_bytes) > 72:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password exceeds maximum length")

    async with AsyncSessionLocal() as session:
        res = await session.execute(select(User).where(User.email == email))
        existing = res.scalar_one_or_none()

        if existing and existing.password_hash:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="An account with this email already exists.")

        password_hash = hash_password(payload.password)

        if existing:
            existing.password_hash = password_hash
            if payload.name:
                existing.name = payload.name
            session.add(existing)
            await session.commit()
            await session.refresh(existing)
            user = existing
        else:
            user = User(email=email, name=payload.name, password_hash=password_hash)
            session.add(user)
            await session.commit()
            await session.refresh(user)

    jwt_token = create_jwt({"sub": str(user.id), "email": user.email})
    return _user_to_response(user, jwt_token)


@router.post('/login-email')
async def login_email(payload: EmailLoginPayload):
    email = _normalize_email(payload.email)
    password_bytes = payload.password.encode()
    logger.debug(
        "Attempting login for email=%s password_bytes_len=%d trimmed_preview=%s",
        email,
        len(password_bytes),
        payload.password[:8] + ("…" if len(payload.password) > 8 else ""),
    )

    if len(password_bytes) > 72:
        logger.warning("Rejecting login for email=%s due to password longer than bcrypt limit", email)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password exceeds maximum length")

    async with AsyncSessionLocal() as session:
        res = await session.execute(select(User).where(User.email == email))
        user = res.scalar_one_or_none()

        if not user or not verify_password(payload.password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    jwt_token = create_jwt({"sub": str(user.id), "email": user.email})
    return _user_to_response(user, jwt_token)


@router.get('/login')
async def login(request: Request):
    redirect_uri = str(request.url_for('auth_callback'))
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get('/callback')
async def auth_callback(request: Request):
    try:
        token = await oauth.google.authorize_access_token(request)
    except Exception as e:
        raise HTTPException(400, f"Failed to authorize: {str(e)}")
    
    # Get user info from the userinfo endpoint
    userinfo = token.get('userinfo')
    if not userinfo:
        # If userinfo is not in token, fetch it separately
        try:
            resp = await oauth.google.get('https://openidconnect.googleapis.com/v1/userinfo', token=token)
            userinfo = resp.json()
        except Exception as e:
            raise HTTPException(400, f"Failed to get user info: {str(e)}")
    
    if not userinfo:
        raise HTTPException(400, "no user info")
    
    email = userinfo.get('email')
    if not email:
        raise HTTPException(400, "no email in user info")
    
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(User).where(User.email == email))
        user = res.scalar_one_or_none()
        if not user:
            user = User(email=email, name=userinfo.get('name'), avatar=userinfo.get('picture'))
            session.add(user)
            await session.commit()
            await session.refresh(user)
        
        # Create JWT token
        jwt_token = create_jwt({"sub": str(user.id), "email": user.email})
        
        # Prepare user data for URL
        user_data = {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "avatar": user.avatar
        }
        
        # Redirect to frontend with token and user data
        import json
        user_json = urllib.parse.quote(json.dumps(user_data))
        redirect_url = f"{settings.FRONTEND_URL}/auth/callback?token={jwt_token}&user={user_json}"
        
        return RedirectResponse(url=redirect_url)


@router.post('/logout')
async def logout(request: Request):
    """Clear server-side session (useful for OAuth flow). Frontend should also clear local storage."""
    try:
        request.session.clear()
    except Exception:
        pass
    return {"message": "Logged out"}


