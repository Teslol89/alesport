from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.session import SessionModel
from app.models.user import User
from app.models.weekly_schedule import WeeklySchedule

from app.schemas.weekly_schedule import SessionGenerationRequest


LOCAL_TIMEZONE = ZoneInfo("Europe/Madrid")


# ── Horario semanal ───────────────────────────────────────────────────────────
def get_weekly_schedule(db: Session) -> list[WeeklySchedule]:
    """Devuelve todos los horarios semanales registrados."""
    return db.query(WeeklySchedule).all()


def create_weekly_schedule(db: Session, schedule_data) -> WeeklySchedule:
    """Crea un nuevo horario semanal y genera automáticamente las sesiones futuras."""
    # Verificar que el trainer_id corresponde a un entrenador activo
    trainer = (
        db.query(User)
        .filter(
            User.id == schedule_data.trainer_id,
            User.role == "trainer",
            User.is_active.is_(True),
        )
        .first()
    )
    if trainer is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="trainer_id debe pertenecer a un entrenador activo",
        )

    # Extraer weeks_ahead antes de crear el ORM (no es columna de la tabla)
    weeks_ahead = schedule_data.weeks_ahead
    schedule = WeeklySchedule(**schedule_data.model_dump(exclude={"weeks_ahead"}))
    db.add(schedule)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        if "no_overlap_schedule" in str(exc.orig):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="El horario se solapa con otro slot activo del mismo entrenador y dia",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Datos de horario inválidos",
        )

    db.refresh(schedule)
    # Generar sesiones automáticamente para las próximas N semanas
    _generate_for_new_schedule(db, weeks_ahead)
    return schedule


def _generate_for_new_schedule(db: Session, weeks_ahead: int) -> None:
    """Dispara la generación automática de sesiones tras crear un horario."""
    generate_sessions_from_schedule(
        db, SessionGenerationRequest(weeks_ahead=weeks_ahead, start_date=None)
    )


# ── Generación de sesiones ────────────────────────────────────────────────────
def _to_utc(dt: datetime) -> datetime:
    """Normaliza un datetime a UTC para comparaciones consistentes."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=LOCAL_TIMEZONE).astimezone(timezone.utc)
    return dt.astimezone(timezone.utc)


def _local_datetime(d: date, t: time) -> datetime:
    """Combina una fecha y una hora en un datetime aware de la zona local del negocio."""
    return datetime.combine(d, t, tzinfo=LOCAL_TIMEZONE)


def generate_sessions_from_schedule(
    db: Session, generation_data: SessionGenerationRequest
) -> dict:
    """Genera sesiones concretas a partir de los horarios semanales activos.

    Es idempotente: si una sesión ya existe para un entrenador y hora concreta,
    se omite sin crear duplicados.
    """
    window_start = generation_data.start_date or date.today()
    weeks_ahead = generation_data.weeks_ahead
    window_end_exclusive = window_start + timedelta(weeks=weeks_ahead)

    # Obtener solo horarios de entrenadores activos
    schedules = (
        db.query(WeeklySchedule)
        .join(User, User.id == WeeklySchedule.trainer_id)
        .filter(
            WeeklySchedule.is_active.is_(True),
            User.is_active.is_(True),
            User.role == "trainer",
        )
        .all()
    )

    if not schedules:
        return {
            "weeks_ahead": weeks_ahead,
            "window_start": window_start,
            "window_end": window_end_exclusive,
            "total_slots_considered": 0,
            "generated_count": 0,
            "skipped_existing_count": 0,
        }

    # Agrupar horarios por dia de la semana para acceso O(1) en el bucle
    schedules_by_day: dict[int, list[WeeklySchedule]] = {i: [] for i in range(7)}
    for schedule in schedules:
        schedules_by_day[int(schedule.day_of_week)].append(schedule)

    # Cargar todas las sesiones existentes en la ventana en una sola consulta
    min_start = _local_datetime(window_start, time(0, 0, 0))
    max_start = _local_datetime(window_end_exclusive, time(0, 0, 0))
    existing_keys: set[tuple[int, datetime]] = {
        (trainer_id, _to_utc(start_time))
        for trainer_id, start_time in (
            db.query(SessionModel.trainer_id, SessionModel.start_time)
            .filter(
                SessionModel.start_time >= min_start,
                SessionModel.start_time < max_start,
            )
            .all()
        )
    }

    # Recorrer cada dia de la ventana y acumular sesiones a crear
    new_sessions: list[SessionModel] = []
    skipped_existing_count = 0
    total_slots_considered = 0

    current_date = window_start
    while current_date < window_end_exclusive:
        for schedule in schedules_by_day[current_date.weekday()]:
            total_slots_considered += 1
            start_dt = _local_datetime(current_date, schedule.start_time)
            session_key = (schedule.trainer_id, start_dt)

            if session_key in existing_keys:
                # Ya existe -- no crear duplicado
                skipped_existing_count += 1
                continue

            new_sessions.append(
                SessionModel(
                    trainer_id=schedule.trainer_id,
                    start_time=start_dt,
                    end_time=_local_datetime(current_date, schedule.end_time),
                    capacity=schedule.capacity,
                    status="active",
                )
            )
            existing_keys.add(session_key)

        current_date += timedelta(days=1)

    # Inserción en bloque: mas eficiente que add() individual en el bucle
    if new_sessions:
        db.add_all(new_sessions)
        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            if "no_overlap_sessions" in str(exc.orig):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="La generación produjo solapamientos para al menos un entrenador",
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Error al generar sesiones: datos inválidos",
            )

    return {
        "weeks_ahead": weeks_ahead,
        "window_start": window_start,
        "window_end": window_end_exclusive,
        "total_slots_considered": total_slots_considered,
        "generated_count": len(new_sessions),
        "skipped_existing_count": skipped_existing_count,
    }
