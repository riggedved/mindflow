from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.db.base import Base


class Folder(Base):
 __tablename__ = "folders"
 id = Column(Integer, primary_key=True, index=True)
 space_id = Column(Integer, ForeignKey("spaces.id", ondelete="CASCADE"), nullable=False)
 name = Column(String, nullable=False)
 parent_id = Column(Integer, ForeignKey("folders.id"), nullable=True)
 created_at = Column(DateTime(timezone=True), server_default=func.now())