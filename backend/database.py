import os
import logging
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.dialects import registry

# Ensure psycopg is registered as driver for postgresql dialect
registry.register("postgresql", "sqlalchemy.dialects.postgresql.psycopg", "PGDialect_psycopg")

env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)

_SQLITE_FILE = Path(__file__).resolve().parent / "utm_drone.db"
_DEFAULT_SQLITE_URL = f"sqlite:///{_SQLITE_FILE}"

raw_url = os.getenv("DATABASE_URL", _DEFAULT_SQLITE_URL)
if raw_url.startswith("postgresql://"):
    raw_url = raw_url.replace("postgresql://", "postgresql+psycopg://", 1)

# Check if PostgreSQL is explicitly configured and reachable, else use SQLite quietly
if raw_url.startswith("sqlite"):
    engine = create_engine(
        f"sqlite:///{_SQLITE_FILE}",
        connect_args={"check_same_thread": False},
    )
else:
    try:
        _pg_engine = create_engine(raw_url, pool_pre_ping=True)
        with _pg_engine.connect() as _test_conn:
            pass
        engine = _pg_engine
        logging.info("[DB] Connected to PostgreSQL.")
    except Exception:
        # Fall back cleanly without noisy error trace
        engine = create_engine(
            f"sqlite:///{_SQLITE_FILE}",
            connect_args={"check_same_thread": False},
        )

# SQLite: enable foreign key enforcement on every connection
if str(engine.url).startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
