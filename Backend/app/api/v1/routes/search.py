from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from datetime import datetime
from sqlalchemy import or_, and_, any_, func
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.db.sessions import get_db
from app.modals.user import User
from app.modals.item import Item
from app.core.security import decode_jwt

router = APIRouter()
security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    """Get current user from JWT token"""
    token = credentials.credentials
    payload = decode_jwt(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
        )

    return user


@router.get("/")
async def search_items(
    q: str = Query(..., description="Search query"),
    types: Optional[str] = Query(None, description="Comma-separated content types"),
    date_from: Optional[datetime] = Query(None, description="Filter by creation date from"),
    date_to: Optional[datetime] = Query(None, description="Filter by creation date to"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Search items by title, content, and tags with filters
    """
    # Start with base query for current user
    query = select(Item).filter(Item.user_id == current_user.id)

    # Search in title, content, and tags (both ARRAY column and JSONB ai_meta)
    if q:
        search_term = f"%{q}%"

        # Build search conditions for title, content, ai-generated description, and tags
        search_conditions = [
            Item.title.ilike(search_term),
            Item.content.ilike(search_term),
            # Search in ai_meta.description (AI-generated description)
            Item.ai_meta["description"].astext.ilike(search_term),
            # Search in ai_meta.tags JSON/text
            Item.ai_meta["tags"].astext.ilike(search_term),
        ]

        # Search in tags array column using func.array_to_string for fallback
        search_conditions.append(func.array_to_string(Item.tags, '||').ilike(search_term))

        query = query.filter(or_(*search_conditions))

    # Filter by content types
    if types:
        type_list = [t.strip() for t in types.split(",")]
        query = query.filter(Item.type.in_(type_list))

    # Filter by date range
    if date_from:
        query = query.filter(Item.created_at >= date_from)
    if date_to:
        # Include the entire day for date_to
        query = query.filter(Item.created_at <= date_to)

    # Order by relevance (most recent first)
    query = query.order_by(Item.created_at.desc())

    # Execute query with limit
    query = query.limit(50)
    result = await db.execute(query)
    items = result.scalars().all()

    # Format response
    result_items = []
    for item in items:
        item_dict = {
            "id": item.id,
            "type": item.type,
            "title": item.title,
            # Prefer AI description for search/result previews; fall back to title
            "description": (item.ai_meta.get("description") if item.ai_meta else item.title),
            # Keep original content (what user saved)
            "content": item.content,
            "url": item.url,
            "storage_path": item.storage_path,
            "mime_type": item.mime_type,
            # Merge tags from column or ai_meta
            "tags": item.tags if item.tags else (item.ai_meta.get("tags", []) if item.ai_meta else []),
            "category": item.ai_meta.get("category", "") if item.ai_meta else "",
            "created_at": item.created_at.isoformat(),
            "updated_at": item.updated_at.isoformat() if item.updated_at else item.created_at.isoformat(),
        }
        result_items.append(item_dict)

    return {
        "items": result_items,
        "count": len(result_items),
        "query": q,
    }
