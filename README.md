# Alesport

Aplicación de gestión de clases y reservas para gimnasio con backend en FastAPI y app móvil/web en Ionic React.

## Estado actual (abril 2026)

Este README refleja el estado real del código en backend y mobile, incluyendo los cambios recientes:

- Roles consolidados con superadmin, admin, trainer y client.
- Bloqueo de uso para usuarios inactivos o con membresía inactiva en flujos clave.
- Restricciones de backend para reservas y alumnos fijos.
- Auto-refresco en pantallas operativas (agenda, reservas y búsqueda) mediante polling.
- Mejoras de UX/UI en formularios y mensajes traducidos ES/EN.

## Arquitectura

- Backend: FastAPI + SQLAlchemy + PostgreSQL + JWT.
- Frontend/móvil: Ionic React + Vite + Capacitor.
- Autenticación: JWT Bearer en cada petición protegida.
- Persistencia de sesión en frontend: AuthContext + localStorage.

## Estructura del repositorio

```text
alesport/
|-- backend/
|   |-- app/
|   |   |-- auth/
|   |   |-- database/
|   |   |-- models/
|   |   |-- routers/
|   |   |-- schemas/
|   |   |-- services/
|   |   `-- utils/
|   |-- database/
|   |   |-- schema.sql
|   |   `-- migrations/
|   |-- tests/
|   `-- requirements.txt
|-- mobile/
|   `-- alesport-app/
|       |-- src/
|       `-- package.json
|-- CONTRIBUTING.md
`-- README.md
```

## Modelo de roles y permisos

### Roles disponibles

- superadmin
- admin
- trainer
- client

En backend, superadmin hereda permisos administrativos (mismo grupo de permisos que admin para comprobaciones de administración).

### Reglas principales de acceso

- GET /bookings/: solo admin/superadmin.
- GET /bookings/session/{session_id}: admin/superadmin o trainer dueño de la sesión.
- GET /bookings/user/{user_id}: admin/superadmin o el propio usuario.
- POST /bookings/: solo client.
- Gestión de sesiones (crear/editar/borrado/copia semanal): trainer o admin/superadmin según endpoint y contexto.

Nota: el usuario autenticado debe estar activo. Si no está activo, el backend devuelve 403.

## Reglas de negocio de reservas y membresía

### Backend

En creación de reservas:

- Solo puede reservar un usuario con role=client.
- No se permite reservar sesiones canceladas o pasadas.
- Si membership_active=false, devuelve 403.
- Se respeta cupo mensual si monthly_booking_quota está definido.

En asignación de alumnos fijos en sesiones:

- Solo se aceptan alumnos client + is_active=true + membership_active=true.
- Si se envía un alumno no válido, devuelve 422.

### Frontend

Se bloquea acceso funcional (mensaje claro) cuando user.is_active=false o user.membership_active=false en:

- Crear clases (CrearForm)
- Reservas de cliente (ReservasForm)
- Buscar reservas (BuscarForm), excepto usuarios admin/superadmin

Mensajes traducidos en ES/EN:

- auth.inactiveUserBlocked
- auth.membershipInactiveBlocked

## Auto-refresco (polling) en la app

Hay refresco automático cada 10 segundos (10000 ms) en componentes operativos:

- Agenda/Calendario: constante AGENDA_AUTO_REFRESH_MS
- Buscar reservas: constante SEARCH_AUTO_REFRESH_MS
- Mis reservas (cliente): constante BOOKINGS_AUTO_REFRESH_MS

Además del intervalo, también se refresca al:

- recuperar foco de ventana
- volver la pestaña a visible

Esto es útil para operación casi en tiempo real, pero incrementa el volumen de GET si hay muchos usuarios conectados.

## Convenciones UI recientes

Para mantener consistencia visual y mantenimiento sencillo en los formularios clave:

- Los mensajes de bloqueo por usuario inactivo o membresía inactiva usan clases CSS dedicadas (sin estilos inline).
- Los archivos CSS de formularios principales están ordenados por índice de secciones comentado.
- Se mantiene tipografía y estilo homogéneos en mensajes de estado y carga.
- Las traducciones de bloqueo están centralizadas en LanguageContext (ES/EN).

## Configuración local

### Requisitos

- Python 3.10+
- PostgreSQL
- Node.js 18+

### Variables de entorno

Crear archivo .env en la raíz del repositorio con mínimo:

```env
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/alesport
JWT_SECRET_KEY=tu_clave_larga_y_segura
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=60
```

Opcionales (correo y enlaces):

```env
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
FRONTEND_URL=https://www.verdeguerlabs.es
REDIS_URL=redis://127.0.0.1:6379/0
```

## Backend: instalación y arranque

```bash
cd backend
python -m venv venv
# Windows
venv\Scripts\activate
# Linux/macOS
# source venv/bin/activate

pip install -r requirements.txt
```

Crear base de datos y esquema:

```bash
psql -U postgres -d alesport -f backend/database/schema.sql
```

Lanzar API:

```bash
cd backend
uvicorn app.main:app --reload
```

Documentación de API:

- http://localhost:8000/docs
- http://localhost:8000/redoc

## Frontend/mobile: instalación y arranque

```bash
cd mobile/alesport-app
npm install
npm run dev
```

Build:

```bash
npm run build
```

Tests frontend:

```bash
npm run test.unit
npm run test.e2e
```

Lint frontend:

```bash
npm run lint
```

Capacitor:

```bash
npx cap sync
npx cap open android
```

## Seeds y usuarios de prueba

Puedes poblar datos de prueba con:

```bash
cd backend
python seed.py
```

Antes de ejecutar, exporta variables requeridas por el script si aplica (por ejemplo contraseñas de seed).

## Tests backend

```bash
cd backend
pytest tests/
```

## Despliegue recomendado (resumen)

Producción backend en VPS:

- Ejecutar FastAPI con uvicorn bajo systemd.
- Poner nginx como reverse proxy.
- Activar HTTPS (Let's Encrypt/Certbot).
- No usar --reload en producción.
- Restringir CORS y puertos expuestos.

### Configuración Nginx para WebSocket (tiempo real en UI de Álex)

Si usas el canal en tiempo real de reservas (`/api/realtime/ws`), añade soporte Upgrade en nginx:

```nginx
location /api/realtime/ws {
	proxy_pass http://127.0.0.1:8000;
	proxy_http_version 1.1;
	proxy_set_header Upgrade $http_upgrade;
	proxy_set_header Connection "upgrade";
	proxy_set_header Host $host;
	proxy_set_header X-Real-IP $remote_addr;
	proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
	proxy_set_header X-Forwarded-Proto $scheme;
	proxy_read_timeout 3600;
}
```

Después de editar nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Nota de operación sobre workers

El realtime usa dos modos:

- Con `REDIS_URL` configurado: usa Redis Pub/Sub (válido para varios workers/instancias).
- Sin `REDIS_URL`: fallback en memoria de proceso (válido para 1 worker o entorno local).

Para producción con varias réplicas/workers, deja siempre `REDIS_URL` configurado.

## Troubleshooting

### 403 inesperado en endpoints de reservas

Revisar, en este orden:

1. Token JWT vigente (logout/login para renovar cache local).
2. Rol del usuario real en BD (superadmin/admin/trainer/client).
3. Estado de usuario: is_active=true.
4. Para reservar como cliente: membership_active=true.
5. Para GET /bookings/session/{id}: ser admin/superadmin o trainer dueño de la sesión.

### Muchas peticiones GET repetidas en logs

Comportamiento esperado si hay polling activo en pantallas abiertas.

- Ajustar constantes de refresco en frontend (valor actual: 10000 ms, rango recomendado: 10000-30000 ms), o
- pasar a refresco manual + foco/visibilidad.

### No se ven clientes/alumnos en ciertas acciones

Verificar que los alumnos cumplen requisitos de negocio (activos y con membresía activa), especialmente para asignación de alumnos fijos.

## Documentación de colaboración

Para flujo de ramas, PRs y convenciones:

- Ver CONTRIBUTING.md

## Notas finales

Este README prioriza precisión operativa sobre teoría. Si cambias reglas de permisos, membresía o refresco automático, actualiza este documento en el mismo PR para evitar divergencia entre código y documentación.
