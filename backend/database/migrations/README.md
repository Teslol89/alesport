# Database Migrations

This folder stores incremental SQL migrations for existing databases.

Current baseline is the schema in `backend/database/schema.sql`.

## Naming convention

Use sequential, descriptive names:

- `001_baseline.sql`
- `002_add_new_column_to_sessions.sql`
- `003_update_booking_index.sql`

## Rules

- Keep `schema.sql` as the clean base schema for fresh setups.
- Put only incremental changes here (`ALTER`, `DROP`, backfills, data fixes).
- Migrations should be idempotent when possible.
- Never rewrite old migration files once they are applied in shared environments.

## Starting point

- For a new database, apply `backend/database/schema.sql`.
- `001_baseline.sql` is a history marker that represents the current schema as migration starting point.
