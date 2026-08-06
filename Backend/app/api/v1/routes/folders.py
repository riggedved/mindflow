from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.sessions import get_db

router = APIRouter()


@router.get("/")
async def get_folders(db: AsyncSession = Depends(get_db)):
    """Get all folders"""
    return {"message": "Folders endpoint - Coming soon"}


@router.post("/")
async def create_folder(db: AsyncSession = Depends(get_db)):
    """Create a new folder"""
    return {"message": "Create folder - Coming soon"}


@router.get("/{folder_id}")
async def get_folder(folder_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific folder"""
    return {"message": f"Get folder {folder_id} - Coming soon"}