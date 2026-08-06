from sqlalchemy import Column, String, Integer, DateTime
from sqlalchemy.sql import func
from app.db.base import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=True)
    avatar = Column(String, nullable=True)
    password_hash = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

