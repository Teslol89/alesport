import re
from pathlib import Path


def _normalized_sql_text(file_path: Path) -> str:
    content = file_path.read_text(encoding="utf-8")
    return re.sub(r"\s+", " ", content.lower())


def test_seed_includes_required_weekly_schedule_columns():
    """Evita regresiones cuando el esquema exige campos NOT NULL en weekly_schedule."""
    seed_path = Path(__file__).resolve().parents[1] / "seed.py"
    normalized = _normalized_sql_text(seed_path)

    assert "insert into weekly_schedule" in normalized
    assert (
        "insert into weekly_schedule (trainer_id, day_of_week, start_time, end_time, capacity, class_name, notes, is_active)"
        in normalized
    )


def test_seed_includes_required_sessions_columns():
    """Garantiza que el seed mantiene class_name en sesiones, alineado con schema.sql."""
    seed_path = Path(__file__).resolve().parents[1] / "seed.py"
    normalized = _normalized_sql_text(seed_path)

    assert "insert into sessions" in normalized
    assert "insert into sessions (trainer_id, start_time, end_time, capacity, class_name, notes, status)" in normalized
