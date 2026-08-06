import ssl
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlsplit, urlunsplit

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

engine_kwargs = {
    "future": True,
    "echo": False,
    # Enable pre-ping so dropped connections are recycled automatically.
    "pool_pre_ping": True,
    # Recycle connections periodically to avoid stale connections on managed DBs.
    "pool_recycle": 1800,
}

database_url = settings.DATABASE_URL

ssl_context = None

if database_url:
    split = urlsplit(database_url)
    query_params = parse_qs(split.query, keep_blank_values=True)

    ssl_mode = query_params.pop("sslmode", [None])[0]
    ssl_root_cert = query_params.pop("sslrootcert", [None])[0]

    if ssl_root_cert:
        cert_path = Path(ssl_root_cert)
        if not cert_path.is_absolute():
            project_root = Path(__file__).resolve().parents[2]
            cert_path = project_root / cert_path

        if not cert_path.exists():
            raise FileNotFoundError(
                f"Supplied sslrootcert path '{ssl_root_cert}' does not exist "
                f"(resolved to '{cert_path}')."
            )

        ssl_context = ssl.create_default_context(cafile=str(cert_path))
    elif ssl_mode and ssl_mode.lower() not in {"disable", "allow", "prefer"}:
        ssl_context = ssl.create_default_context()

    if ssl_context and ssl_mode:
        mode = ssl_mode.lower()
        if mode == "disable":
            ssl_context = None
        elif mode in {"require", "verify-full", "verify-ca"}:
            ssl_context.check_hostname = True

    remaining_query = urlencode(
        {key: values for key, values in query_params.items() if values},
        doseq=True,
    )

    database_url = urlunsplit(
        (split.scheme, split.netloc, split.path, remaining_query, split.fragment)
    )

if ssl_context is None and database_url and "supabase.co" in database_url:
    ssl_context = ssl.create_default_context()

if ssl_context is not None:
    engine_kwargs["connect_args"] = {"ssl": ssl_context}

engine = create_async_engine(database_url, **engine_kwargs)
AsyncSessionLocal = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def init_db():
    # Create tables via metadata.create_all in dev (or use alembic migrations in prod)
    from app.db.base import Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session