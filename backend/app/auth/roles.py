"""Helpers compartidos para permisos y distinción de roles de usuario."""

from collections.abc import Iterable

ADMIN_ROLES = {"admin", "superadmin"}
SESSION_MANAGER_ROLES = {"trainer", *ADMIN_ROLES}
ASSIGNABLE_TRAINER_ROLES = {"admin", "trainer"}


def has_any_role(role: str | None, allowed_roles: Iterable[str]) -> bool:
    """Devuelve True si el rol recibido pertenece al conjunto permitido."""
    return role in set(allowed_roles)


def is_admin_role(role: str | None) -> bool:
    """Los superadmins heredan los permisos administrativos del centro."""
    return has_any_role(role, ADMIN_ROLES)


def can_manage_sessions_role(role: str | None) -> bool:
    """Roles con acceso a gestión operativa de sesiones."""
    return has_any_role(role, SESSION_MANAGER_ROLES)


def can_be_assigned_trainer_role(role: str | None) -> bool:
    """Solo admins del centro y trainers pueden impartir sesiones en la app."""
    return has_any_role(role, ASSIGNABLE_TRAINER_ROLES)
