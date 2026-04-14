import logging
from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.booking import Booking
from app.models.session import SessionModel
from app.models.user import User
from app.models.weekly_schedule import WeeklySchedule
from app.models.weekly_schedule_student import WeeklyScheduleStudent

from app.auth.roles import ASSIGNABLE_TRAINER_ROLES
from app.schemas.weekly_schedule import SessionGenerationRequest
from app.services.user_service import get_assignable_trainer_by_id


LOCAL_TIMEZONE = ZoneInfo("Europe/Madrid")
logger = logging.getLogger(__name__)


# ── Horario semanal ───────────────────────────────────────────────────────────
def _get_fixed_student_ids_by_schedule(
    db: Session, schedule_ids: list[int]
) -> dict[int, list[int]]:
    if not schedule_ids:
        return {}

    rows = (
        db.query(WeeklyScheduleStudent.weekly_schedule_id, WeeklyScheduleStudent.user_id)
        .join(User, User.id == WeeklyScheduleStudent.user_id)
        .filter(
            WeeklyScheduleStudent.weekly_schedule_id.in_(schedule_ids),
            WeeklyScheduleStudent.is_active.is_(True),
            User.role == "client",
            User.is_active.is_(True),
            User.membership_active.is_(True),
        )
        .order_by(WeeklyScheduleStudent.id.asc())
        .all()
    )

    schedule_map: dict[int, list[int]] = defaultdict(list)
    for schedule_id, user_id in rows:
        schedule_map[int(schedule_id)].append(int(user_id))
    return schedule_map


def _attach_fixed_student_ids(db: Session, schedules):
    schedule_list = schedules if isinstance(schedules, list) else [schedules]
    schedule_ids = [schedule.id for schedule in schedule_list if getattr(schedule, "id", None) is not None]
    fixed_students_by_schedule = _get_fixed_student_ids_by_schedule(db, schedule_ids)

    for schedule in schedule_list:
        setattr(schedule, "fixed_student_ids", fixed_students_by_schedule.get(schedule.id, []))

    return schedules


def _get_valid_fixed_students(db: Session, student_ids: list[int] | None) -> list[User]:
    normalized_ids = list(dict.fromkeys(int(student_id) for student_id in (student_ids or []) if int(student_id) > 0))
    if not normalized_ids:
        return []

    students = (
        db.query(User)
        .filter(
            User.id.in_(normalized_ids),
            User.role == "client",
            User.is_active.is_(True),
            User.membership_active.is_(True),
        )
        .all()
    )
    students_by_id = {student.id: student for student in students}
    missing_ids = [student_id for student_id in normalized_ids if student_id not in students_by_id]
    if missing_ids:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Los alumnos fijos deben ser clientes activos con la membresía vigente",
        )

    return [students_by_id[student_id] for student_id in normalized_ids]


def _times_overlap(start_a: time, end_a: time, start_b: time, end_b: time) -> bool:
    return start_a < end_b and start_b < end_a


def _ensure_no_global_weekly_overlap(
    db: Session,
    *,
    day_of_week: int,
    start_time: time,
    end_time: time,
) -> None:
    active_slots = (
        db.query(WeeklySchedule)
        .filter(
            WeeklySchedule.is_active.is_(True),
            WeeklySchedule.day_of_week == day_of_week,
        )
        .all()
    )

    for slot in active_slots:
        if _times_overlap(start_time, end_time, slot.start_time, slot.end_time):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe otra clase activa en esa franja horaria",
            )


def _ensure_fixed_bookings_for_session(
    db: Session, session: SessionModel, student_ids: list[int]
) -> int:
    if not student_ids or session.status == "cancelled":
        return 0

    existing_user_ids = {
        user_id
        for (user_id,) in (
            db.query(Booking.user_id)
            .filter(
                Booking.session_id == session.id,
                Booking.user_id.in_(student_ids),
            )
            .all()
        )
    }
    reserved_slots = (
        db.query(Booking)
        .filter(
            Booking.session_id == session.id,
            Booking.status.in_(("active", "offered")),
        )
        .count()
    )

    created_count = 0
    for student_id in student_ids:
        if student_id in existing_user_ids:
            continue
        if reserved_slots >= session.capacity:
            logger.warning(
                "No se ha podido preasignar al alumno %s en la sesión %s porque el aforo ya está completo.",
                student_id,
                session.id,
            )
            break

        db.add(
            Booking(
                user_id=student_id,
                session_id=session.id,
                status="active",
            )
        )
        existing_user_ids.add(student_id)
        reserved_slots += 1
        created_count += 1

    if created_count:
        db.flush()

    return created_count


def get_weekly_schedule(db: Session) -> list[WeeklySchedule]:
    """Devuelve todos los horarios semanales registrados."""
    schedules = db.query(WeeklySchedule).all()
    return _attach_fixed_student_ids(db, schedules)


def create_weekly_schedule(db: Session, schedule_data) -> WeeklySchedule:
    """Crea un nuevo horario semanal y genera automáticamente las sesiones futuras."""
    # Verificar que el trainer_id corresponde a un entrenador activo
    trainer = get_assignable_trainer_by_id(db, schedule_data.trainer_id)
    if trainer is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="trainer_id debe pertenecer a un entrenador disponible",
        )

    fixed_students = _get_valid_fixed_students(db, schedule_data.fixed_student_ids)
    _ensure_no_global_weekly_overlap(
        db,
        day_of_week=schedule_data.day_of_week,
        start_time=schedule_data.start_time,
        end_time=schedule_data.end_time,
    )

    # Extraer weeks_ahead antes de crear el ORM (no es columna de la tabla)
    weeks_ahead = schedule_data.weeks_ahead
    start_date = schedule_data.start_date
    schedule = WeeklySchedule(
        **schedule_data.model_dump(exclude={"weeks_ahead", "fixed_student_ids", "start_date"})
    )
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

    if fixed_students:
        db.add_all(
            [
                WeeklyScheduleStudent(
                    weekly_schedule_id=schedule.id,
                    user_id=student.id,
                )
                for student in fixed_students
            ]
        )
        db.commit()
        db.refresh(schedule)

    # Generar sesiones automáticamente para las próximas N semanas
    _generate_for_new_schedule(db, weeks_ahead, start_date)
    return _attach_fixed_student_ids(db, schedule)


def _generate_for_new_schedule(db: Session, weeks_ahead: int, start_date: date | None) -> None:
    """Dispara la generación automática de sesiones tras crear un horario."""
    generate_sessions_from_schedule(
        db, SessionGenerationRequest(weeks_ahead=weeks_ahead, start_date=start_date)
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
            User.role.in_(tuple(ASSIGNABLE_TRAINER_ROLES)),
        )
        .all()
    )
    fixed_students_by_schedule = _get_fixed_student_ids_by_schedule(
        db, [schedule.id for schedule in schedules]
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
    existing_sessions_by_key: dict[tuple[int, datetime], SessionModel] = {
        (session.trainer_id, _to_utc(session.start_time)): session
        for session in (
            db.query(SessionModel)
            .filter(
                SessionModel.start_time >= min_start,
                SessionModel.start_time < max_start,
            )
            .all()
        )
    }

    # Recorrer cada dia de la ventana y acumular sesiones a crear
    new_sessions: list[SessionModel] = []
    sessions_to_prebook: list[tuple[SessionModel, list[int]]] = []
    skipped_existing_count = 0
    total_slots_considered = 0

    current_date = window_start
    while current_date < window_end_exclusive:
        for schedule in schedules_by_day[current_date.weekday()]:
            total_slots_considered += 1
            start_dt = _local_datetime(current_date, schedule.start_time)
            session_key = (schedule.trainer_id, _to_utc(start_dt))
            fixed_student_ids = fixed_students_by_schedule.get(schedule.id, [])
            existing_session = existing_sessions_by_key.get(session_key)

            if existing_session is not None:
                # Ya existe -- no crear duplicado, pero sí intentar completar sus reservas fijas pendientes.
                skipped_existing_count += 1
                if existing_session.weekly_schedule_id is None:
                    existing_session.weekly_schedule_id = schedule.id
                if fixed_student_ids:
                    sessions_to_prebook.append((existing_session, fixed_student_ids))
                continue

            new_session = SessionModel(
                trainer_id=schedule.trainer_id,
                weekly_schedule_id=schedule.id,
                start_time=start_dt,
                end_time=_local_datetime(current_date, schedule.end_time),
                capacity=schedule.capacity,
                class_name=schedule.class_name,
                notes=schedule.notes,
                status="active",
            )
            new_sessions.append(new_session)
            existing_sessions_by_key[session_key] = new_session

            if fixed_student_ids:
                sessions_to_prebook.append((new_session, fixed_student_ids))

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
                    detail="La generación produjo solapamientos con sesiones no canceladas para al menos un entrenador",
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Error al generar sesiones: datos inválidos",
            )

    if sessions_to_prebook:
        try:
            for session, fixed_student_ids in sessions_to_prebook:
                _ensure_fixed_bookings_for_session(db, session, fixed_student_ids)
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Error al asignar los alumnos fijos a las sesiones generadas",
            ) from exc

    return {
        "weeks_ahead": weeks_ahead,
        "window_start": window_start,
        "window_end": window_end_exclusive,
        "total_slots_considered": total_slots_considered,
        "generated_count": len(new_sessions),
        "skipped_existing_count": skipped_existing_count,
    }
