from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.sessions import get_db

router = APIRouter()


@router.get("/")
async def get_tags(db: AsyncSession = Depends(get_db)):
    """Get all tags"""
    return {"message": "Tags endpoint - Coming soon"}


@router.post("/")
async def create_tag(db: AsyncSession = Depends(get_db)):
    """Create a new tag"""
    return {"message": "Create tag - Coming soon"}