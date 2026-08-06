from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_, func
from pydantic import BaseModel
from typing import List, Optional
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.db.sessions import get_db
from app.modals.space import Space
from app.modals.item import Item
from app.modals.user import User
from app.core.security import decode_jwt
from app.services.space_service import SpaceService

router = APIRouter()
security = HTTPBearer()


class CreateSpaceRequest(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = "#6366f1"
    icon: Optional[str] = "Folder"


class AcceptSuggestionRequest(BaseModel):
    suggestion: dict
    item_ids: List[int]


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
async def get_spaces(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all active spaces for the current user"""
    try:
        result = await db.execute(
            select(Space).where(
                and_(
                    Space.user_id == current_user.id,
                    Space.is_active == True
                )
            ).order_by(Space.created_at.desc())
        )
        spaces = result.scalars().all()
        
        spaces_list = []
        for space in spaces:
            space_dict = {
                "id": space.id,
                "name": space.name,
                "description": space.description,
                "color": space.color,
                "icon": space.icon,
                "item_count": space.item_count,
                "is_suggested": space.is_suggested,
                "created_at": space.created_at.isoformat()
            }
            spaces_list.append(space_dict)
        
        return {"spaces": spaces_list}
    except Exception as e:
        print(f"Error fetching spaces: {str(e)}")
        # Return empty list instead of error
        return {"spaces": []}


@router.post("/")
async def create_space(
    request: CreateSpaceRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new space manually"""
    try:
        print(f"Creating space: {request.name} for user {current_user.id}")
        
        new_space = Space(
            user_id=current_user.id,
            name=request.name,
            description=request.description,
            color=request.color,
            icon=request.icon,
            is_suggested=False,
            is_active=True,
            item_count=0,
            similarity_threshold=0.75,
            space_metadata={"created_manually": True}
        )
        
        db.add(new_space)
        await db.commit()
        await db.refresh(new_space)
        
        print(f"Space created successfully: {new_space.id}")
        
        return {
            "id": new_space.id,
            "name": new_space.name,
            "description": new_space.description,
            "color": new_space.color,
            "icon": new_space.icon,
            "item_count": new_space.item_count,
            "created_at": new_space.created_at.isoformat()
        }
    except Exception as e:
        print(f"Error creating space: {str(e)}")
        import traceback
        traceback.print_exc()
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create space: {str(e)}"
        )


@router.get("/suggestions") 
async def get_space_suggestions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get AI-generated space suggestions based on unclustered items"""
    try:
        print(f"Getting space suggestions for user {current_user.id}")
        suggestions = await SpaceService.detect_new_clusters(current_user.id, db)
        print(f"Found {len(suggestions)} suggestions")
        return {"suggestions": suggestions}
    except Exception as e:
        print(f"Error getting suggestions: {str(e)}")
        import traceback
        traceback.print_exc()
        # Return empty list instead of error
        return {"suggestions": []}


@router.post("/suggestions/accept")
async def accept_suggestion(
    request: AcceptSuggestionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Accept an AI suggestion and create a new space"""
    new_space = await SpaceService.create_space_from_suggestion(
        request.suggestion,
        request.item_ids,
        current_user.id,
        db
    )
    
    return {
        "id": new_space.id,
        "name": new_space.name,
        "description": new_space.description,
        "color": new_space.color,
        "icon": new_space.icon,
        "item_count": new_space.item_count,
        "created_at": new_space.created_at.isoformat()
    }


@router.post("/suggestions/reject")
async def reject_suggestion(
    request: AcceptSuggestionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Reject an AI suggestion and learn from it"""
    await SpaceService.reject_suggestion(current_user.id, request.item_ids, db)
    return {"message": "Suggestion rejected. System will be more conservative next time."}


@router.get("/{space_id}")
async def get_space(
    space_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific space with its items"""
    result = await db.execute(
        select(Space).where(
            and_(
                Space.id == space_id,
                Space.user_id == current_user.id
            )
        )
    )
    space = result.scalar_one_or_none()
    
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
    
    # Get items in this space
    items_result = await db.execute(
        select(Item).where(Item.space_id == space_id).order_by(Item.created_at.desc())
    )
    items = items_result.scalars().all()
    
    items_list = []
    for item in items:
        item_dict = {
            "id": item.id,
            "type": item.type,
            "title": item.title,
            "content": item.content,
            "url": item.url,
            "tags": item.tags or [],
            "created_at": item.created_at.isoformat(),
            "space_id": item.space_id
        }
        items_list.append(item_dict)
    
    return {
        "id": space.id,
        "name": space.name,
        "description": space.description,
        "color": space.color,
        "icon": space.icon,
        "item_count": space.item_count,
        "items": items_list,
        "created_at": space.created_at.isoformat()
    }


@router.put("/{space_id}")
async def update_space(
    space_id: int,
    request: CreateSpaceRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a space's name, description, color, or icon"""
    result = await db.execute(
        select(Space).where(
            and_(
                Space.id == space_id,
                Space.user_id == current_user.id
            )
        )
    )
    space = result.scalar_one_or_none()
    
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
    
    space.name = request.name
    space.description = request.description
    space.color = request.color
    space.icon = request.icon
    
    await db.commit()
    await db.refresh(space)
    
    return {
        "id": space.id,
        "name": space.name,
        "description": space.description,
        "color": space.color,
        "icon": space.icon,
        "item_count": space.item_count
    }


class AddItemsRequest(BaseModel):
    item_ids: List[int]


class RemoveItemsRequest(BaseModel):
    item_ids: List[int]


@router.post("/{space_id}/items")
async def add_items_to_space(
    space_id: int,
    request: AddItemsRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Add items to a space"""
    # Verify space exists and belongs to user
    result = await db.execute(
        select(Space).where(
            and_(
                Space.id == space_id,
                Space.user_id == current_user.id
            )
        )
    )
    space = result.scalar_one_or_none()
    
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
    
    # Get all items that belong to the user and match the provided IDs
    items_result = await db.execute(
        select(Item).where(
            and_(
                Item.id.in_(request.item_ids),
                Item.user_id == current_user.id
            )
        )
    )
    items = items_result.scalars().all()
    
    if len(items) != len(request.item_ids):
        raise HTTPException(status_code=404, detail="One or more items not found")
    
    # Assign items to space
    added_count = 0
    for item in items:
        if item.space_id != space_id:
            item.space_id = space_id
            added_count += 1
    
    await db.commit()
    
    # Update space item count
    space.item_count = await db.scalar(
        select(func.count(Item.id)).where(Item.space_id == space_id)
    )
    await db.commit()
    
    return {
        "message": f"Added {added_count} item(s) to space",
        "space_id": space_id,
        "item_count": space.item_count
    }


@router.post("/{space_id}/items/remove")
async def remove_items_from_space(
    space_id: int,
    request: RemoveItemsRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Detach items from a space without deleting them."""
    result = await db.execute(
        select(Space).where(
            and_(
                Space.id == space_id,
                Space.user_id == current_user.id
            )
        )
    )
    space = result.scalar_one_or_none()

    if not space:
        raise HTTPException(status_code=404, detail="Space not found")

    if not request.item_ids:
        return {"message": "No items selected", "removed": 0, "item_count": space.item_count}

    items_result = await db.execute(
        select(Item).where(
            and_(
                Item.id.in_(request.item_ids),
                Item.user_id == current_user.id,
                Item.space_id == space_id
            )
        )
    )
    items = items_result.scalars().all()

    removed_count = 0
    for item in items:
        item.space_id = None
        removed_count += 1

    if removed_count == 0:
        return {"message": "No matching items found in this space", "removed": 0, "item_count": space.item_count}

    await db.commit()

    space.item_count = await db.scalar(
        select(func.count(Item.id)).where(Item.space_id == space_id)
    )
    await db.commit()

    return {
        "message": f"Removed {removed_count} item(s) from space",
        "removed": removed_count,
        "space_id": space_id,
        "item_count": space.item_count
    }


@router.delete("/{space_id}")
async def delete_space(
    space_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a space (items will be unassigned)"""
    result = await db.execute(
        select(Space).where(
            and_(
                Space.id == space_id,
                Space.user_id == current_user.id
            )
        )
    )
    space = result.scalar_one_or_none()
    
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
    
    # Unassign all items from this space
    items_result = await db.execute(
        select(Item).where(Item.space_id == space_id)
    )
    items = items_result.scalars().all()
    
    for item in items:
        item.space_id = None
    
    await db.delete(space)
    await db.commit()
    
    return {"message": "Space deleted successfully"}