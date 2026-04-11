from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.roles import is_admin_role
from app.auth.security import get_current_user
from app.database.db import get_db
from app.models.center_rule import CenterRuleModel
from app.models.user import User
from app.schemas.center_rule import CenterRulesResponse, CenterRulesUpdate

router = APIRouter(prefix="/center-rules", tags=["settings"])


@router.get("/", response_model=CenterRulesResponse)
def read_center_rules(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Devuelve las normas compartidas del centro para cualquier usuario autenticado."""
    _ = current_user
    rules = (
        db.query(CenterRuleModel)
        .order_by(CenterRuleModel.sort_order.asc(), CenterRuleModel.id.asc())
        .all()
    )
    return CenterRulesResponse(rules=[rule.text for rule in rules])


@router.put("/", response_model=CenterRulesResponse)
def update_center_rules(
    payload: CenterRulesUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Permite al admin actualizar la lista completa de normas compartidas."""
    if not is_admin_role(current_user.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden actualizar las normas del centro",
        )

    db.query(CenterRuleModel).delete()
    db.flush()

    for index, rule in enumerate(payload.rules):
        db.add(CenterRuleModel(text=rule, sort_order=index))

    db.commit()

    rules = (
        db.query(CenterRuleModel)
        .order_by(CenterRuleModel.sort_order.asc(), CenterRuleModel.id.asc())
        .all()
    )
    return CenterRulesResponse(rules=[rule.text for rule in rules])
