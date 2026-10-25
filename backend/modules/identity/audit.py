import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session

from modules.identity.models import AuditLog
from modules.telemetry.websocket import broadcast_telemetry

logger = logging.getLogger("utm.audit")

# Optional reference to running asyncio event loop (captured on startup/request)
_main_loop: Optional[asyncio.AbstractEventLoop] = None


def set_main_loop(loop: asyncio.AbstractEventLoop) -> None:
    """Store reference to the main ASGI event loop."""
    global _main_loop
    _main_loop = loop


def _dispatch_broadcast(envelope: dict) -> None:
    """
    Safely dispatch async broadcast from either an async context or a sync thread.
    Non-blocking, zero-throw guarantee: if no clients exist or connection fails,
    it logs a debug/warning without affecting the HTTP transaction.
    """
    global _main_loop
    try:
        # 1. If currently in an async thread with an active running loop:
        try:
            current_loop = asyncio.get_running_loop()
            if current_loop.is_running():
                current_loop.create_task(broadcast_telemetry(envelope))
                return
        except RuntimeError:
            pass

        # 2. If called from a sync threadpool worker, dispatch to main event loop:
        if _main_loop is not None and _main_loop.is_running():
            asyncio.run_coroutine_threadsafe(broadcast_telemetry(envelope), _main_loop)
            return

        # 3. Fallback: run in a local one-off loop if safe (e.g. CLI/tests)
        try:
            asyncio.run(broadcast_telemetry(envelope))
        except RuntimeError:
            # If a loop is already running in current thread, ignore
            pass
    except Exception as exc:
        logger.warning("Failed to broadcast audit_event over WebSocket: %s", exc)


def write_audit(
    db: Session,
    actor_id: Optional[int],
    action: str,
    entity: str,
    entity_id: Optional[int],
) -> AuditLog:
    """
    Persist an audit entry atomically into the PostgreSQL database, and only
    AFTER a successful commit, broadcast the standard audit_event envelope
    to connected WebSocket clients.

    Returns:
        AuditLog: The persisted audit record.
    """
    audit = AuditLog(
        actor_id=actor_id,
        action=action,
        entity=entity,
        entity_id=entity_id,
    )
    db.add(audit)
    db.commit()
    db.refresh(audit)

    # Format created_at as ISO-8601 string
    created_at_iso = (
        audit.created_at.isoformat()
        if audit.created_at is not None
        else datetime.now(timezone.utc).isoformat()
    )

    envelope = {
        "event": "audit_event",
        "data": {
            "id": audit.id,
            "actor_id": audit.actor_id,
            "action": audit.action,
            "entity": audit.entity,
            "entity_id": audit.entity_id,
            "created_at": created_at_iso,
        },
    }

    _dispatch_broadcast(envelope)
    return audit
