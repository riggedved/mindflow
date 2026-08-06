from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base import Base


class Item(Base):
 __tablename__ = "items"
 id = Column(Integer, primary_key=True, index=True)
 user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
 space_id = Column(Integer, ForeignKey("spaces.id", ondelete="SET NULL"), nullable=True)  # Space assignment
 type = Column(String, nullable=False) # note|link|article|image|video
 title = Column(String)
 content = Column(Text)
 url = Column(String, nullable=True)
 storage_path = Column(String, nullable=True)
 mime_type = Column(String, nullable=True)
 tags = Column(ARRAY(String))
 ai_meta = Column(JSONB)
 created_at = Column(DateTime(timezone=True), server_default=func.now())
 updated_at = Column(DateTime(timezone=True), onupdate=func.now())