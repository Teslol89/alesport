# Database Migrations

This folder stores incremental SQL migrations for existing databases.

## Naming convention

Use sequential, descriptive names:

- `001_init.sql`
- `002_booking_active_unique_index.sql`
- `003_add_new_column_to_sessions.sql`

## Rules

- Keep `schema.sql` as the clean base schema for fresh setups.
- Put only incremental changes here (`ALTER`, `DROP`, backfills, data fixes).
- Migrations should be idempotent when possible.
- Never rewrite old migration files once they are applied in shared environments.
