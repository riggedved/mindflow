from sqlalchemy import Column, Integer, String, ForeignKey
from app.db.base import Base


class Tag(Base):
 __tablename__ = "tags"
 id = Column(Integer, primary_key=True, index=True)
 user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
 name = Column(String, nullable=False)