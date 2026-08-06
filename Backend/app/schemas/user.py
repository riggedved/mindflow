from pydantic import BaseModel
from typing import Optional


class UserBase(BaseModel):
 email: str
 name: Optional[str]
 avatar: Optional[str]


class UserCreate(UserBase):
 pass


class UserOut(UserBase):
 id: int
class Config:
 orm_mode = True