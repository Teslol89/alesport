import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.auth.roles import can_manage_sessions_role
from app.auth.security import JWT_ALGORITHM, JWT_SECRET_KEY
from app.database.db import get_db
from app.models.user import User
from app.services.realtime_events import realtime_event_bus


router = APIRouter(prefix="/realtime", tags=["realtime"])


def _get_user_from_ws_token(token: str, db: Session) -> User:
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        email = payload.get("sub")
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido") from exc

    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cuenta desactivada")
    return user


@router.websocket("/ws")
async def realtime_ws_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    try:
        user = _get_user_from_ws_token(token, db)
    except HTTPException:
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
            event = await asyncio.to_thread(subscription.get)
            await websocket.send_json(event)
    except WebSocketDisconnect:
        pass
    finally:
        subscription.close()
