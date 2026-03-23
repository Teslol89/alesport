# Alesport

Booking and schedule management app for the Alesport gym.

## Overview

This repository contains:

- A FastAPI backend with PostgreSQL
- A mobile app (Ionic React + Capacitor)

The backend now includes JWT authentication and role-based authorization across critical endpoints.

## Roles and Access Model

The API works with three roles:

- `admin`: full operational control (users, weekly schedule creation, manual session generation, all bookings)
- `trainer`: session management for owned sessions and trainer-scoped booking cancellation
- `client`: booking creation/cancellation for own reservations

## Project Structure

```text
alesport/
|-- backend/
|   |-- app/
|   |   |-- auth/          # JWT security (token creation + current_user dependency)
|   |   |-- database/      # SQLAlchemy setup
|   |   |-- models/        # ORM models
|   |   |-- routers/       # FastAPI endpoints
|   |   |-- schemas/       # Pydantic models
|   |   `-- services/      # Business logic
|   |-- database/
|   |   `-- schema.sql     # SQL schema
|   `-- requirements.txt
`-- mobile/
      `-- alesport-app/
```

## Prerequisites

- Python 3.10+
- PostgreSQL
- Node.js 18+ (for mobile)
- Ionic CLI (optional): `npm install -g @ionic/cli`

## Backend Setup (Windows)

1. Create database:

```sql
CREATE DATABASE alesport;
```

2. Load schema:

```bash
psql -U postgres -d alesport -f backend/database/schema.sql
```

3. Create `.env` at repository root and define at least:

```env
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/alesport
JWT_SECRET_KEY=change_me_in_production
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=60
```

4. Install dependencies and run API:

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API docs:

- Swagger: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Authentication

- Login endpoint: `POST /auth/login`
- User profile endpoint: `GET /auth/me`
- Auth scheme: Bearer token (JWT)

Login request body:

```json
{
   "email": "user@example.com",
   "password": "your_password"
}
```

Use returned token as:

```http
Authorization: Bearer <access_token>
```

## Authorization Matrix (Current)

- `GET /users/`: admin only
- `GET /sessions/`: authenticated user
- `PATCH /sessions/{session_id}`: trainer (own session) or admin (any)
- `PATCH /sessions/week`: trainer (own week) or admin (requires `trainer_id` in body)
- `GET /schedule/`: authenticated user
- `POST /schedule/`: admin only
- `POST /schedule/generate-sessions`: admin only
- `GET /bookings/`: admin only
- `GET /bookings/user/{user_id}`: admin or same user
- `POST /bookings/`: client only
- `PATCH /bookings/{booking_id}/cancel`: admin, owner client, or owning trainer

## Important Booking Rule

`POST /bookings/` no longer accepts `user_id` from request body.
The backend always uses `current_user.id` from JWT to prevent impersonation.

Request example:

```json
{
   "session_id": 1
}
```

## Manual Smoke Test (Quick)

1. Login as client -> `POST /auth/login`
2. Create booking with `POST /bookings/` -> expected `201` if first time
3. Repeat same booking -> expected `409`
4. Login as trainer and try `POST /bookings/` -> expected `403`
5. Login as admin and run `POST /schedule/generate-sessions` -> expected `200`

## Mobile App

```bash
cd mobile/alesport-app
npm install
npx ionic serve
```

## Notes for Production

- Restrict CORS origins (do not keep `*`)
- Use a long random `JWT_SECR3. Documentación
README completo: Explica cómo instalar, correr, testear y desplegar el proyecto. Incluye ejemplos de uso de la API.
CONTRIBUTING.md: Guía para colaboradores sobre ramas, PRs, convenciones de código, etc.
OpenAPI/Swagger: Aprovecha la autogeneración de docs de FastAPI y añade descripciones detalladas a los endpoints.ET_KEY`
- Rotate secrets and use environment-specific config
- Protect or remove maintenance/debug endpoints before release