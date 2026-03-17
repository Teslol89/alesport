# Alesport

Booking app for Alesport gym.

## Estructura del proyecto

```
alesport/
├── backend/              # API REST con FastAPI + PostgreSQL
│   ├── app/
│   │   ├── main.py       # Punto de entrada de la API
│   │   ├── database/     # Conexión a la base de datos
│   │   ├── models/       # Modelos SQLAlchemy
│   │   ├── routers/      # Endpoints por recurso
│   │   ├── schemas/      # Esquemas Pydantic
│   │   └── services/     # Lógica de negocio
│   ├── database/
│   │   └── schema.sql    # Esquema SQL de la base de datos
│   ├── venv/             # Entorno virtual Python (no versionado)
│   └── requirements.txt  # Dependencias Python
└── mobile/
    └── alesport-app/     # App móvil con Ionic React + Capacitor
```

## Requisitos previos

- Python 3.10+
- Node.js 18+
- PostgreSQL
- Ionic CLI (`npm install -g @ionic/cli`)

## Backend (FastAPI)

### Setup inicial

1. **Base de datos:**
   - Crea una BD en PostgreSQL: `CREATE DATABASE alesportAPP;`
   - Importa el esquema: `psql -U postgres -d alesportAPP -f backend/database/schema.sql`

2. **Variables de entorno:**
   - Copia `.env.example` a `.env` en la **raíz del proyecto**
   - Edita `.env` con tus credenciales de PostgreSQL

3. **Backend:**

```bash
cd backend
venv\Scripts\activate        # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

La API estará disponible en `http://localhost:8000`.  
Documentación automática en `http://localhost:8000/docs`.

## Mobile (Ionic React)

```bash
cd mobile/alesport-app
npm install
npx ionic serve                           # Vista en navegador (localhost)
npx ionic serve --external --host=0.0.0.0 --port=8100  # Vista en móvil por WiFi
```

## Base de datos

El esquema SQL está en `backend/database/schema.sql`.  
Tablas: `users`, `weekly_schedule`, `sessions`, `bookings`.