from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel
from typing import Optional
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.db.sessions import get_db
from app.modals.user import User
from app.core.security import decode_jwt
from app.services.supabase_service import supabase_service

router = APIRouter()
security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
):
    token = credentials.credentials
    payload = decode_jwt(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return user


class UpdateMeRequest(BaseModel):
    name: Optional[str] = None
    avatar: Optional[str] = None


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "avatar": current_user.avatar,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
    }


@router.patch("/me")
async def update_me(
    request: UpdateMeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if request.name is not None:
        current_user.name = request.name
    if request.avatar is not None:
        current_user.avatar = request.avatar

    await db.commit()
    await db.refresh(current_user)

    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "avatar": current_user.avatar,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
    }


@router.post("/me/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload an avatar image for the current user and update avatar URL."""
    # Basic mime validation
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Invalid image file")

    # Reuse Supabase upload utility
    upload_result = await supabase_service.upload_file(file, current_user.id)
    public_url = upload_result.get("public_url")
    if not public_url:
        raise HTTPException(status_code=500, detail="Failed to upload avatar")

    current_user.avatar = public_url
    await db.commit()
    await db.refresh(current_user)

    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "avatar": current_user.avatar,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
    }
