from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Float
from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from sqlalchemy.sql import func
from app.db.base import Base


class Space(Base):
 __tablename__ = "spaces"
 id = Column(Integer, primary_key=True, index=True)
 user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
 name = Column(String, nullable=False)
 description = Column(String, nullable=True)
 color = Column(String, nullable=True)
 icon = Column(String, nullable=True)  # Icon name for the space
 is_suggested = Column(Boolean, default=False)  # True if AI-suggested, False if user-created
 is_active = Column(Boolean, default=True)  # False if archived
 centroid_embedding = Column(ARRAY(Float), nullable=True)  # Average embedding of all items
 similarity_threshold = Column(Float, default=0.75)  # Threshold for auto-assignment
 item_count = Column(Integer, default=0)
 space_metadata = Column(JSONB, nullable=True)  # Stores learning data, user feedback, etc.
 created_at = Column(DateTime(timezone=True), server_default=func.now())
 updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())