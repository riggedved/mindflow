from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.core.config import settings


engine_kwargs = {
    "future": True,
    "echo": False,
    "pool_pre_ping": True,
    "pool_recycle": 1800,
}

database_url = settings.DATABASE_URL

engine = create_async_engine(
    database_url,
    **engine_kwargs,
)

AsyncSessionLocal = sessionmaker(
    engine,
    expire_on_commit=False,
    class_=AsyncSession,
)


async def init_db():
    # Create tables via metadata.create_all in dev
    # (or use Alembic migrations in production)
    from app.db.base import Base

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session