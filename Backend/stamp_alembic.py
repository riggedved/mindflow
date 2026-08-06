import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()
url = os.getenv('DATABASE_URL', '')
if url.startswith('postgresql+asyncpg://'):
    url = url.replace('postgresql+asyncpg://', 'postgresql+psycopg2://', 1)
# Enable connection health checks and periodic recycle to avoid stale handles when stamping migrations.
engine = create_engine(url, pool_pre_ping=True, pool_recycle=1800)
with engine.connect() as conn:
    conn.execute(text('CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(32) NOT NULL);'))
    result = conn.execute(text('SELECT version_num FROM alembic_version')).fetchall()
    if not result:
        conn.execute(text("INSERT INTO alembic_version (version_num) VALUES ('c7a5f3d219ab')"))
    else:
        conn.execute(text("UPDATE alembic_version SET version_num='c7a5f3d219ab'"))
    conn.commit()
