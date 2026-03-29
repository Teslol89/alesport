# Guía de desarrollo y autenticación (2026)

Esta guía describe paso a paso cómo funciona y cómo mantener el flujo de registro, login y persistencia de sesión en la app Alesport, tanto en web como en móvil (Ionic/Capacitor), con advertencias y buenas prácticas para el futuro.

## 1. Estructura y dependencias clave

- **Backend:** FastAPI, PostgreSQL, JWT, roles.
- **Frontend:** React, Ionic, React Router, localStorage para persistencia de sesión.
- **Móvil:** Capacitor (sin Secure Storage, solo localStorage para máxima compatibilidad y menos problemas).

## 2. Registro de usuario (UX y validaciones)

1. El usuario rellena el formulario de registro (`RegisterForm.tsx`).
2. Validaciones en tiempo real: nombre, email, contraseña y aceptación de términos.
3. Errores de campo se muestran bajo el input, nunca en toast (excepto errores globales).
4. Si todo es correcto, se envía al backend (`/auth/register`).
5. Si el registro es exitoso, se muestra un toast de éxito y se redirige automáticamente a login.
6. Si hay errores (email duplicado, etc.), se muestran de forma clara y priorizada.

## 3. Login y persistencia de sesión

1. El usuario inicia sesión desde el formulario de login (`LoginForm.tsx`).
2. Si las credenciales son correctas, el backend devuelve un JWT.
3. El token se guarda en localStorage y en el contexto global (`AuthContext`).
4. Mientras el token esté en localStorage, la sesión persiste aunque se cierre la app o el navegador.
5. Al cerrar sesión, el token se elimina de ambos sitios.
6. Si el token expira o es inválido, el backend responde 401 y la app fuerza logout.

**Nota:** No se usa Secure Storage en móvil para evitar problemas de compatibilidad y build. Si en el futuro se quiere máxima seguridad en móvil, revisar la integración de plugins Cordova/Capacitor y asegurarse de que `cordova.js` esté presente y el plugin funcione en todos los dispositivos.

## 4. Rutas protegidas y control de acceso

- El contexto `AuthContext` expone `isAuthenticated`, `token`, `setToken` y `logout`.
- Las rutas privadas usan `PrivateRoute` y solo son accesibles si hay token válido.
- El backend valida el token en cada petición y aplica control de roles.

## 5. Desarrollo, build y despliegue

### Web y móvil (Ionic/React)

1. Instala dependencias:
   ```bash
   cd mobile/alesport-app
   npm install
   ```
2. Para desarrollo web:
   ```bash
   npm run dev
   ```
3. Para build de producción:
   ```bash
   npm run build
   ```
4. Para móvil (Android/iOS):
   - Sincroniza con Capacitor:
     ```bash
     npx cap sync
     ```
   - Abre en Android Studio:
     ```bash
     npx cap open android
     ```
   - Compila y prueba en dispositivo/emulador.

**Importante:**
- Si necesitas almacenamiento seguro en móvil, revisa la integración de Secure Storage y asegúrate de que `<script src="cordova.js"></script>` esté en el index.html fuente (no solo en el build).
- Si tienes problemas de sesión en móvil, primero prueba solo con localStorage (como está ahora) para máxima estabilidad.

## 6. Troubleshooting y restauración

- Si la sesión no persiste en móvil, revisa que localStorage esté disponible y que no haya restricciones del sistema.
- Si el login o registro falla, revisa los logs del backend y los mensajes de error en frontend.
- Si necesitas restaurar usuarios de prueba, ejecuta `seed.py` en el backend.
- Si el build móvil no reconoce Cordova/Capacitor, revisa la presencia de `cordova.js` y la instalación de plugins.

---

# Alesport


## Guía de despliegue y configuración completa (VPS, PostgreSQL, Backend, App Móvil y Producción)
---

## Despliegue profesional en producción (backend FastAPI/Uvicorn)

### 0. Objetivo

El backend debe funcionar 24/7 en el VPS, sin depender de tu PC, iniciarse automáticamente al arrancar el servidor, reiniciarse si falla y estar protegido tras un proxy seguro (nginx). Este es el estándar profesional para aplicaciones web modernas.

### 1. Crear un servicio systemd para el backend

1.1. Crea el archivo `/etc/systemd/system/alesport-backend.service` con el siguiente contenido (ajusta rutas según tu entorno):

```ini
[Unit]
Description=Alesport FastAPI backend (Uvicorn)
After=network.target

[Service]
User=ubuntu  # o el usuario que corresponda
Group=ubuntu
WorkingDirectory=/home/ubuntu/alesport/backend
Environment="PATH=/home/ubuntu/alesport/backend/venv/bin"
ExecStart=/home/ubuntu/alesport/backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

1.2. Recarga systemd y habilita el servicio:

```bash
sudo systemctl daemon-reload
sudo systemctl enable alesport-backend
sudo systemctl start alesport-backend
sudo systemctl status alesport-backend
```

El backend quedará corriendo en segundo plano, se reiniciará si falla y arrancará automáticamente con el VPS.

### 2. Configuración de nginx como proxy inverso

1. Instala nginx:
   ```bash
   sudo apt install nginx
   ```
2. Edita `/etc/nginx/sites-available/default` para añadir:
   ```nginx
   location / {
      proxy_pass http://127.0.0.1:8000;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
   }
   location /docs {
      proxy_pass http://127.0.0.1:8000/docs;
   }
   location /openapi.json {
      proxy_pass http://127.0.0.1:8000/openapi.json;
   }
   ```
3. Recarga nginx:
   ```bash
   sudo systemctl reload nginx
   ```

### 3. Seguridad y buenas prácticas

- Usa HTTPS (puedes instalar Certbot para obtener SSL gratis de Let's Encrypt).
- Limita el acceso a la base de datos solo a IPs necesarias.
- Mantén el firewall activo (ufw) y solo abre los puertos requeridos (80, 443, 5432 si necesitas acceso remoto).
- No uses `--reload` en producción.
- El backend ya no depende de tu PC: el VPS lo ejecuta siempre, aunque apagues tu ordenador.

---

### 1. Despliegue del backend FastAPI en VPS

- Crear un VPS (IONOS en este caso) con Ubuntu.
- Instalar Python 3, pip y git.
- Clonar el repositorio en el VPS.
- Crear y activar un entorno virtual:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```
- Instalar dependencias:
   ```bash
   pip install -r backend/requirements.txt
   ```

### 2. Configuración y acceso remoto a PostgreSQL

- Instalar PostgreSQL en el VPS:
   ```bash
   sudo apt update && sudo apt install postgresql postgresql-contrib
   ```
- Crear base de datos y usuario:
   ```bash
   sudo -u postgres psql
   CREATE DATABASE alesportAPP;
   CREATE USER postgres WITH PASSWORD 'TU_PASSWORD';
   GRANT ALL PRIVILEGES ON DATABASE alesportAPP TO postgres;
   \q
   ```
- Editar `/etc/postgresql/16/main/postgresql.conf`:
   - Cambiar `listen_addresses = '*'`
- Editar `/etc/postgresql/16/main/pg_hba.conf`:
   - Añadir:
      ```
      host    all    all    0.0.0.0/0    md5
      ```
- Reiniciar PostgreSQL:
   ```bash
   sudo systemctl restart postgresql
   ```

### 3. Abrir el puerto 5432 en el firewall y en IONOS

- En el VPS, abrir el puerto (si usas UFW):
   ```bash
   sudo ufw allow 5432/tcp
   ```
- En el panel de IONOS, añadir regla para permitir el puerto 5432 TCP para todas las IPs o solo tu IP pública.

### 4. Probar acceso remoto con pgAdmin

- Conectar desde tu PC usando pgAdmin:
   - Host: IP pública del VPS
   - Puerto: 5432
   - Usuario: postgres
   - Contraseña: TU_PASSWORD
   - Base de datos: alesportAPP

### 5. Poblar la base de datos con usuarios y datos de prueba

- Editar `backend/seed.py` para que la cadena de conexión apunte a la IP pública del VPS:
   ```python
   DB_URL = "postgresql+psycopg://postgres:TU_PASSWORD@IP_VPS:5432/alesportAPP"
   ```
- Subir el archivo al VPS (por ejemplo, con FileZilla).
- En el VPS, activar el entorno virtual y ejecutar:
   ```bash
   source venv/bin/activate
   python backend/seed.py
   ```
- Esto crea 3 usuarios de prueba:
   - admin@demo.com / admin123 (rol: admin)
   - trainer@demo.com / trainer123 (rol: trainer)
   - cliente@demo.com / cliente123 (rol: client)

### 6. Lanzar el backend en modo producción/desarrollo

- Desde la carpeta backend:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```
- El backend queda accesible desde la IP pública del VPS en el puerto 8000.

### 7. Configuración de la app móvil

- Editar el archivo `.env` de la app móvil para que apunte a la URL del backend en producción:
   ```env
   VITE_API_BASE_URL=https://TU_DOMINIO_O_IP:8000
   ```
- Compilar y probar la app móvil. Ya puedes loguear con los usuarios de prueba y operar normalmente.

---


**Resumen actualizado:**

1. VPS con Ubuntu, Python, PostgreSQL y puertos abiertos.
2. PostgreSQL configurado para acceso remoto y seguro.
3. Backend desplegado y conectado a la base remota.
4. Usuarios de prueba y datos insertados con seed.py.
5. App móvil conectada y funcional.
6. Backend corriendo como servicio profesional (systemd), gestionado por nginx, seguro y persistente.

Si necesitas restaurar datos de prueba, vuelve a ejecutar `seed.py`.

---

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



## Registro de usuario: experiencia y validaciones profesionales

El proceso de creación de usuario en Alesport está diseñado para ser robusto, claro y profesional, tanto en la app móvil como en la web. A continuación se detallan los aspectos clave del flujo de registro:

### 1. Validaciones frontend (Ionic React)

- **Validación secuencial:** El usuario solo puede avanzar al siguiente campo si el anterior es válido. Por ejemplo, no puede escribir el email si el nombre no es correcto.
- **Mensajes de error claros y específicos:** Cada campo muestra mensajes de error dinámicos y detallados justo debajo del input, indicando exactamente qué falta o es incorrecto (ej: "Debe tener al menos 2 caracteres").
- **Animación shake:** Si el usuario intenta avanzar con un campo inválido, el input correspondiente vibra (shake) para llamar la atención de forma visual y profesional.
- **Toasts solo para errores globales:** Los mensajes emergentes (IonToast) solo aparecen para errores esenciales (formulario incompleto, email ya registrado, términos no aceptados, registro exitoso). Los errores de validación de campos nunca se muestran en toast, solo bajo el input.
- **Aceptación de términos:** El toast "Debes aceptar los términos y condiciones" solo aparece si todos los campos previos son válidos.

### 2. Interacción con el backend (FastAPI)

- El formulario envía los datos solo si todas las validaciones frontend pasan.
- Si el backend responde con errores de validación (por ejemplo, email ya registrado), estos se muestran de forma priorizada y clara en el frontend, siguiendo el mismo patrón de mensajes específicos.
- El mensaje de éxito "¡Bienvenido!" se muestra en un toast solo si el registro es correcto.

### 3. Experiencia de usuario (UX) y accesibilidad

- El flujo evita frustraciones: nunca se bloquea al usuario sin explicar el motivo.
- Los mensajes son siempre accionables y ayudan a corregir el error.
- El botón de registro se desactiva durante el envío para evitar dobles envíos.
- El enlace "¿Ya tienes una cuenta? Inicia sesión" usa navegación interna (React Router) para evitar recargas y problemas de splash.

### 4. Detalles técnicos importantes

- El formulario está implementado en `src/components/RegisterForm.tsx`.
- Las animaciones y estilos de error están en `src/components/RegisterForm.css`.
- Se usa React, Ionic y React Router para la navegación y experiencia fluida.
- El backend FastAPI valida de nuevo todos los datos y responde con detalles claros en caso de error.
- El código sigue buenas prácticas de separación de responsabilidades y feedback inmediato al usuario.

### 5. Pruebas y mantenimiento

- El flujo ha sido probado manualmente y cubre los casos de error más comunes (campos vacíos, email inválido, contraseña corta, email duplicado, términos no aceptados).
- El código está preparado para ser extendido con tests automáticos y nuevas validaciones si se requieren.

---

### Autenticación y Seguridad (Frontend)

- El login se realiza vía `/auth/login` y el token JWT se almacena en memoria (contexto) y localStorage.
- El contexto global (`AuthContext`) gestiona el estado de sesión y el token.
- Logout seguro: elimina el token y limpia el estado de usuario.
- Rutas privadas protegidas con `PrivateRoute`: solo accesibles si hay token válido.
- Todas las peticiones autenticadas usan el helper `fetchWithAuth`, que agrega el header `Authorization: Bearer <token>` automáticamente.
- Si el backend responde 401 (token expirado/inválido), la app cierra sesión y redirige a login.
- El botón de logout solo aparece si el usuario está autenticado.
- Ejemplo de consumo seguro de API:

```ts
import { getUserProfile } from './api/user';
const { logout } = useAuth();
useEffect(() => {
   getUserProfile(logout)
      .then(user => setUser(user))
      .catch(err => {/* manejar error */});
}, []);
```

**Recomendaciones:**
- Usa tokens de corta duración y refresh tokens en backend para máxima seguridad.
- No expongas datos sensibles en el frontend si el usuario no está autenticado.
- Documenta el flujo de autenticación para nuevos desarrolladores.


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