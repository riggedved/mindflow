from pydantic import BaseModel
from typing import List, Optional


class ItemCreate(BaseModel):
 type: str
 title: Optional[str]
 content: Optional[str]
 url: Optional[str]
 storage_path: Optional[str]
 mime_type: Optional[str]


class ItemOut(ItemCreate):
 id: int
 tags: Optional[List[str]]
 ai_meta: Optional[dict]
 created_at: Optional[str]
 class Config:
  orm_mode = True