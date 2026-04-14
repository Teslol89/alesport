import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session

from app.auth.roles import can_manage_sessions_role
from app.auth.security import get_current_user
from app.database.db import get_db
from app.models.user import User
from app.services.realtime_events import realtime_event_bus
from app.services.realtime_ticket_service import WS_TICKET_TTL_SECONDS, realtime_ticket_service


router = APIRouter(prefix="/realtime", tags=["realtime"])


@router.post("/ws-ticket")
def create_realtime_ws_ticket(current_user: User = Depends(get_current_user)):
    if not can_manage_sessions_role(current_user.role):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")

    ticket = realtime_ticket_service.issue_ticket(current_user)
    return {
        "ticket": ticket,
        "expires_in": WS_TICKET_TTL_SECONDS,
    }


@router.websocket("/ws")
async def realtime_ws_endpoint(
    websocket: WebSocket,
    ticket: str = Query(...),
    db: Session = Depends(get_db),
):
    payload = realtime_ticket_service.consume_ticket(ticket)
    if payload is None:
        await websocket.close(code=1008)
        return

    user_email = payload.get("email")
    if not isinstance(user_email, str) or not user_email:
        await websocket.close(code=1008)
        return

    user = db.query(User).filter(User.email == user_email).first()
    if user is None or not user.is_active:
        await websocket.close(code=1008)
        return

    # The Alex management UI lives under trainer/admin capabilities.
    if not can_manage_sessions_role(user.role):
        await websocket.close(code=1008)
        return

    await websocket.accept()

    subscription = realtime_event_bus.subscribe()
    try:
        await websocket.send_json({"type": "connected"})
        while True:
            event = await asyncio.to_thread(subscription.get, 1.0)
            if event is None:
                continue
            await websocket.send_json(event)
    except WebSocketDisconnect:
        pass
    except asyncio.CancelledError:
        raise
    finally:
        subscription.close()
