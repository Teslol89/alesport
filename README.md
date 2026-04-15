# Alesport

> Plataforma de gestión de clases y reservas deportivas — backend en FastAPI, app móvil en Ionic React + Capacitor.

[![Backend tests](https://img.shields.io/badge/tests-50%20passing-brightgreen)](#tests-backend)
[![Python](https://img.shields.io/badge/python-3.10%2B-blue)](https://www.python.org/)
[![Node](https://img.shields.io/badge/node-22.x-green)](https://nodejs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.135-009688)](https://fastapi.tiangolo.com/)
[![Ionic](https://img.shields.io/badge/Ionic-8.x-3880FF)](https://ionicframework.com/)

---

## Índice

1. [Descripción](#descripción)
2. [URLs de producción](#urls-de-producción)
3. [Stack tecnológico](#stack-tecnológico)
4. [Arquitectura del sistema](#arquitectura-del-sistema)
5. [Estructura del repositorio](#estructura-del-repositorio)
6. [Modelo de roles y permisos](#modelo-de-roles-y-permisos)
7. [Reglas de negocio — reservas y membresía](#reglas-de-negocio--reservas-y-membresía)
8. [API — resumen de endpoints](#api--resumen-de-endpoints)
9. [Realtime — WebSocket y polling](#realtime--websocket-y-polling)
10. [Internacionalización (i18n)](#internacionalización-i18n)
11. [Notificaciones push (Firebase FCM)](#notificaciones-push-firebase-fcm)
12. [Configuración local](#configuración-local)
13. [Variables de entorno](#variables-de-entorno)
14. [Backend — instalación y arranque](#backend--instalación-y-arranque)
15. [Frontend/mobile — instalación y arranque](#frontendmobile--instalación-y-arranque)
16. [Seeds y usuarios de prueba](#seeds-y-usuarios-de-prueba)
17. [Tests](#tests)
18. [Builds móvil — iOS y Android](#builds-móvil--ios-y-android)
19. [CI/CD — Codemagic](#cicd--codemagic)
20. [Despliegue en producción (VPS)](#despliegue-en-producción-vps)
21. [Troubleshooting](#troubleshooting)
22. [Convenciones UI](#convenciones-ui)
23. [Contribuir](#contribuir)
24. [Licencia y contacto](#licencia-y-contacto)

---

## Descripción

Alesport es una aplicación de gestión deportiva que conecta entrenadores y alumnos en una sola plataforma.

**Para alumnos:**
- Consulta y reserva de sesiones desde el móvil (iOS y Android)
- Visualización del plan de membresía y sesiones restantes
- Notificaciones push de próximas clases y cambios en reservas
- Interfaz en español e inglés

**Para entrenadores / administradores:**
- Panel de gestión de horarios, sesiones y alumnos
- Control de membresías, planes y alumnos fijos
- Vista de reservas en tiempo real via WebSocket
- Gestión de múltiples roles (superadmin, admin, trainer)

---

## URLs de producción

| Servicio | URL |
|---|---|
| App móvil / web | https://alesport.verdeguerlabs.es |
| API REST | https://api.verdeguerlabs.es |
| Documentación API (Swagger) | https://api.verdeguerlabs.es/docs |
| Documentación API (ReDoc) | https://api.verdeguerlabs.es/redoc |
| Política de privacidad | https://www.verdeguerlabs.es/privacidad-alesport |

---

## Stack tecnológico

### Backend

| Tecnología | Versión | Uso |
|---|---|---|
| Python | 3.10+ | Lenguaje base |
| FastAPI | 0.135.1 | Framework API REST |
| SQLAlchemy | 2.0.48 | ORM |
| PostgreSQL | 14+ | Base de datos relacional |
| uvicorn | 0.42.0 | Servidor ASGI |
| python-jose | 3.3.0 | JWT autenticación |
| passlib / bcrypt | 1.7.4 / 4.0.1 | Hash de contraseñas |
| firebase-admin | 6.5.0 | Notificaciones push FCM |
| aiosmtplib | 5.1.0 | Envío de emails async |
| Redis | 5.0.8 | Bus pub/sub para realtime distribuido |
| pytest | 9.0.2 | Tests automáticos |

### Frontend / Mobile

| Tecnología | Versión | Uso |
|---|---|---|
| Node.js | 22.x | Entorno de build |
| React | 19.0.0 | Framework UI |
| Ionic React | 8.5.0 | Componentes móviles |
| Capacitor | 8.2.0 | Bridge nativo iOS/Android |
| Vite | 5.x | Bundler |
| TypeScript | 5.x | Tipado estático |
| Firebase JS SDK | 12.x | Push notifications cliente |
| Cypress | 13.x | Tests E2E |

---

## Arquitectura del sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                          CLIENTE                                │
│                                                                 │
│  iOS App (Capacitor)   Android App (Capacitor)   Web Browser   │
│        └──────────────────────┴──────────────────────┘         │
│                               │                                 │
│              Ionic React + Vite (SPA)                          │
│              alesport.verdeguerlabs.es                         │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTPS / WSS
┌───────────────────────────────▼─────────────────────────────────┐
│                       VPS (Ubuntu)                              │
│                                                                 │
│  ┌─────────────┐     ┌────────────────────────────────────┐    │
│  │   nginx     │────▶│  FastAPI + uvicorn (puerto 8000)   │    │
│  │ reverse     │     │  api.verdeguerlabs.es              │    │
│  │ proxy       │     │                                    │    │
│  │ + TLS       │     │  /api/sessions  (REST)             │    │
│  └─────────────┘     │  /api/bookings  (REST)             │    │
│                      │  /api/realtime/ws  (WebSocket)     │    │
│                      └──────────────────┬─────────────────┘    │
│                                         │                       │
│              ┌──────────────────────────┼─────────────────┐    │
│              │                          │                  │    │
│  ┌───────────▼────┐          ┌──────────▼──────┐          │    │
│  │  PostgreSQL    │          │     Redis        │          │    │
│  │  (puerto 5432) │          │  (pub/sub WS)   │          │    │
│  └────────────────┘          └─────────────────┘          │    │
└─────────────────────────────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│              Firebase Cloud Messaging (FCM)                     │
│         Notificaciones push iOS + Android                       │
└─────────────────────────────────────────────────────────────────┘
```

**Flujo de autenticación:**
1. El cliente envía credenciales a `POST /api/auth/login`
2. El backend valida y devuelve un JWT (Bearer token)
3. El frontend almacena el token en `localStorage` vía `AuthContext`
4. Todas las peticiones protegidas incluyen `Authorization: Bearer <token>`
5. Para WebSocket: se obtiene un ticket efímero via `POST /api/realtime/ws-ticket` y se pasa como query param (el JWT no viaja en la URL)

---

## Estructura del repositorio

```text
alesport/
├── backend/
│   ├── app/
│   │   ├── auth/               # JWT, hashing, seguridad
│   │   ├── database/           # Conexión SQLAlchemy
│   │   ├── models/             # Modelos ORM (User, Session, Booking, WeeklySchedule)
│   │   ├── routers/            # Endpoints REST por dominio
│   │   │   ├── auth_router.py
│   │   │   ├── booking_router.py
│   │   │   ├── schedule_router.py
│   │   │   ├── session_router.py
│   │   │   └── user_router.py
│   │   ├── schemas/            # Modelos Pydantic (validación entrada/salida)
│   │   ├── services/           # Lógica de negocio desacoplada de routers
│   │   │   ├── booking_service.py
│   │   │   ├── notification_service.py   # FCM push notifications
│   │   │   ├── schedule_service.py
│   │   │   ├── session_service.py
│   │   │   └── user_service.py
│   │   ├── utils/
│   │   └── main.py             # Entry point FastAPI + middlewares CORS
│   ├── database/
│   │   ├── schema.sql          # Esquema inicial SQL
│   │   └── migrations/         # Migraciones manuales
│   ├── tests/
│   │   ├── conftest.py         # Fixtures compartidos
│   │   ├── test_auth.py
│   │   ├── test_authorization.py
│   │   └── test_booking_status_sync.py
│   ├── requirements.txt
│   └── seed.py                 # Datos de prueba
├── mobile/
│   └── alesport-app/
│       ├── src/
│       │   ├── api/            # Clientes HTTP por dominio
│       │   ├── components/     # Formularios y componentes principales
│       │   ├── i18n/           # Traducciones ES/EN (LanguageContext)
│       │   ├── pages/          # Páginas de la app
│       │   ├── services/       # Servicios frontend
│       │   └── utils/
│       ├── android/            # Proyecto Android nativo (Capacitor)
│       ├── ios/                # Proyecto iOS nativo (Capacitor)
│       ├── capacitor.config.ts
│       └── package.json
├── codemagic.yaml              # Pipeline CI/CD iOS (Codemagic)
├── CONTRIBUTING.md
└── README.md
```

## Modelo de roles y permisos

### Roles disponibles

| Rol | Descripción |
|---|---|
| `superadmin` | Control total. Hereda todos los permisos de `admin`. |
| `admin` | Gestión completa de sesiones, alumnos y reservas. |
| `trainer` | Gestiona sus propias sesiones y ve reservas de sus clases. |
| `client` | Puede reservar y consultar sus propias reservas. |

> Un usuario con `is_active = false` recibe **403** en cualquier endpoint protegido, independientemente del rol.

### Matriz de permisos por endpoint

| Endpoint | superadmin | admin | trainer | client |
|---|:---:|:---:|:---:|:---:|
| `GET /bookings/` | ✅ | ✅ | ❌ | ❌ |
| `GET /bookings/session/{id}` | ✅ | ✅ | Solo propias | ❌ |
| `GET /bookings/user/{user_id}` | ✅ | ✅ | ❌ | Solo el propio |
| `POST /bookings/` | ❌ | ❌ | ❌ | ✅ |
| `POST /sessions/` | ✅ | ✅ | ✅ | ❌ |
| `PUT /sessions/{id}` | ✅ | ✅ | Solo propias | ❌ |
| `DELETE /sessions/{id}` | ✅ | ✅ | Solo propias | ❌ |
| `GET /users/` | ✅ | ✅ | ❌ | ❌ |
| `PUT /users/{id}` | ✅ | ✅ | ❌ | Solo el propio |

---

## Reglas de negocio — reservas y membresía

### Backend (validaciones en `booking_service.py`)

Al crear una reserva (`POST /bookings/`):

1. El usuario debe tener `role = client`
2. La sesión no puede estar cancelada ni en el pasado
3. `membership_active` debe ser `true` → si no, devuelve **403**
4. Si `monthly_booking_quota` está definido en el plan, se respeta el cupo mensual
5. No se permiten reservas duplicadas para la misma sesión y usuario

Al asignar alumnos fijos en una sesión:

- El alumno debe cumplir: `role = client` + `is_active = true` + `membership_active = true`
- Si algún alumno no cumple → devuelve **422**

### Frontend (bloqueo en componentes)

Los siguientes componentes bloquean acceso funcional con mensaje claro cuando `user.is_active = false` o `user.membership_active = false`:

| Componente | Condición de bloqueo |
|---|---|
| `CrearForm` | `is_active = false` |
| `ReservasForm` | `is_active = false` o `membership_active = false` |
| `BuscarForm` | `is_active = false` o `membership_active = false` (excepto admin/superadmin) |

Claves de traducción de los mensajes de bloqueo:
- `auth.inactiveUserBlocked`
- `auth.membershipInactiveBlocked`

---

## API — resumen de endpoints

La documentación interactiva completa está en https://api.verdeguerlabs.es/docs

### Autenticación

| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/api/auth/login` | Login con email + contraseña → devuelve JWT |
| `POST` | `/api/auth/google` | Login / registro con Google OAuth |
| `POST` | `/api/auth/password-reset-request` | Solicitud de restablecimiento de contraseña |
| `POST` | `/api/auth/password-reset` | Confirmar nueva contraseña con token |

### Usuarios

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/users/` | Listar usuarios (admin+) |
| `GET` | `/api/users/me` | Perfil del usuario autenticado |
| `PUT` | `/api/users/{id}` | Actualizar usuario |
| `DELETE` | `/api/users/{id}` | Eliminar usuario (admin+) |

### Sesiones

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/sessions/` | Listar sesiones |
| `POST` | `/api/sessions/` | Crear sesión |
| `PUT` | `/api/sessions/{id}` | Editar sesión |
| `DELETE` | `/api/sessions/{id}` | Eliminar sesión |
| `POST` | `/api/sessions/copy-week` | Copiar semana de sesiones |

### Reservas

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/bookings/` | Listar todas las reservas (admin+) |
| `GET` | `/api/bookings/session/{id}` | Reservas de una sesión |
| `GET` | `/api/bookings/user/{id}` | Reservas de un usuario |
| `POST` | `/api/bookings/` | Crear reserva (client) |
| `PUT` | `/api/bookings/{id}` | Modificar reserva |
| `DELETE` | `/api/bookings/{id}` | Cancelar reserva |

### Horarios semanales

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/schedule/` | Obtener horario semanal |
| `POST` | `/api/schedule/` | Crear/actualizar horario |

### Realtime

| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/api/realtime/ws-ticket` | Obtener ticket efímero para WebSocket |
| `WS` | `/api/realtime/ws?ticket=...` | Canal WebSocket de eventos |

---

## Realtime — WebSocket y polling

### WebSocket (canal principal)

El canal realtime usa WebSocket con autenticación por ticket efímero para evitar que el JWT viaje en URLs (y aparezca en logs de nginx).

**Flujo:**
1. El cliente hace `POST /api/realtime/ws-ticket` con su JWT en el header → recibe un `ticket` de un solo uso
2. Abre el WebSocket: `wss://api.verdeguerlabs.es/api/realtime/ws?ticket=<ticket>`
3. El servidor valida el ticket y acepta la conexión (HTTP 101)
4. Los eventos llegan como JSON:

```json
{ "type": "booking_changed", "session_id": 42 }
{ "type": "user_profile_changed", "user_id": 7 }
```

**Modo distribuido (producción):** cuando `REDIS_URL` está configurado, el bus de eventos usa Redis Pub/Sub, lo que permite múltiples workers o instancias. Sin `REDIS_URL`, usa memoria interna del proceso (solo válido para 1 worker).

### Polling (fallback)

Todos los componentes operativos tienen polling automático cada **10 segundos** como fallback cuando el WebSocket no está disponible:

| Componente | Constante |
|---|---|
| Agenda / Calendario | `AGENDA_AUTO_REFRESH_MS = 10000` |
| Buscar reservas | `SEARCH_AUTO_REFRESH_MS = 10000` |
| Mis reservas (cliente) | `BOOKINGS_AUTO_REFRESH_MS = 10000` |

Además, el refresco se dispara al recuperar el foco de ventana o cuando la pestaña vuelve a ser visible.

> ⚠️ El polling incrementa el volumen de peticiones GET. Si hay muchos usuarios concurrentes, considera aumentar el intervalo a 20000–30000 ms o pasar a refresco manual + evento de visibilidad.

### Configuración nginx para WebSocket

Añadir este bloque al virtual host de la API:

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

Aplicar cambios:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## Internacionalización (i18n)

La app soporta **español (ES)** e **inglés (EN)**. El idioma se persiste en `localStorage` con la clave `alesport-language`.

**Gestión del idioma:** `src/i18n/LanguageContext.tsx` expone un hook con el idioma activo y la función para cambiarlo. Los componentes principales leen las traducciones de este contexto.

Para añadir una nueva clave de traducción:
1. Añadir la clave en `LanguageContext.tsx` en los dos objetos (`es` y `en`)
2. Usar `t('clave.nueva')` en el componente correspondiente

---

## Notificaciones push (Firebase FCM)

La app usa **Firebase Cloud Messaging** para notificaciones push en iOS y Android.

### Configuración backend

1. En [console.firebase.google.com](https://console.firebase.google.com), descarga el JSON de cuenta de servicio del proyecto
2. Guárdalo como `backend/alesport-firebase-adminsdk-*.json`
3. Referencia la ruta en el `.env`:

```env
FIREBASE_CREDENTIALS_PATH=alesport-firebase-adminsdk-*.json
```

### Configuración frontend (mobile)

1. En la consola de Firebase, descarga:
   - `google-services.json` → copiarlo en `android/app/`
   - `GoogleService-Info.plist` → copiarlo en `ios/App/App/`
2. El archivo `GoogleService-Info.plist` para iOS se inyecta también en Codemagic vía variable de entorno `GOOGLE_SERVICE_INFO_PLIST_BASE64`

---

## Configuración local

### Requisitos previos

| Herramienta | Versión mínima |
|---|---|
| Python | 3.10 |
| Node.js | 18 (recomendado 22) |
| PostgreSQL | 14 |
| Redis | 6 (opcional, solo para realtime distribuido) |
| Git | cualquier versión reciente |

---

## Variables de entorno

Crear un archivo `.env` en la **raíz del repositorio** (`alesport/.env`):

```env
# ─────────────────────────────────────────
# Base de datos
# ─────────────────────────────────────────
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/alesport

# ─────────────────────────────────────────
# JWT
# ─────────────────────────────────────────
JWT_SECRET_KEY=tu_clave_muy_larga_y_aleatoria_minimo_32_chars
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=60

# ─────────────────────────────────────────
# SMTP (opcional — para emails de reset de contraseña)
# ─────────────────────────────────────────
SMTP_HOST=smtp.ejemplo.com
SMTP_PORT=587
SMTP_USER=usuario@ejemplo.com
SMTP_PASSWORD=contraseña_smtp
SMTP_FROM=noreply@ejemplo.com

# ─────────────────────────────────────────
# URLs
# ─────────────────────────────────────────
FRONTEND_URL=https://alesport.verdeguerlabs.es

# ─────────────────────────────────────────
# Redis (opcional — realtime distribuido)
# ─────────────────────────────────────────
REDIS_URL=redis://127.0.0.1:6379/0

# ─────────────────────────────────────────
# Firebase (notificaciones push)
# ─────────────────────────────────────────
FIREBASE_CREDENTIALS_PATH=alesport-firebase-adminsdk-*.json
```

> ⚠️ **Nunca subas el `.env` ni el JSON de Firebase al repositorio.** Ambos ya están en `.gitignore`.

---

## Backend — instalación y arranque

```bash
# 1. Clona el repositorio (si no lo tienes)
git clone <url>
cd alesport

# 2. Crea el entorno virtual
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# Linux/macOS
source venv/bin/activate

# 3. Instala dependencias
pip install -r requirements.txt

# 4. Crea la base de datos y aplica el esquema
psql -U postgres -c "CREATE DATABASE alesport;"
psql -U postgres -d alesport -f database/schema.sql

# 5. Copia y configura el .env (ver sección Variables de entorno)
cp .env.example .env   # o créalo manualmente en la raíz

# 6. Lanza el servidor
uvicorn app.main:app --reload
```

El servidor estará disponible en:
- API: http://localhost:8000
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

> ⚠️ No uses `--reload` en producción.

---

## Frontend/mobile — instalación y arranque

```bash
cd mobile/alesport-app

# Instalar dependencias
npm install --legacy-peer-deps

# Servidor de desarrollo
npm run dev
```

La app estará en http://localhost:5173

### Comandos disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo con hot reload |
| `npm run build` | Build de producción en `/dist` |
| `npm run preview` | Preview del build de producción |
| `npm run lint` | Linter ESLint |
| `npm run test.unit` | Tests unitarios con Vitest |
| `npm run test.e2e` | Tests E2E con Cypress |

### Capacitor (builds nativos)

Tras hacer cambios en la web:

```bash
npm run build           # Build web
npx cap sync            # Sincronizar con proyectos nativos
npx cap open ios        # Abrir en Xcode
npx cap open android    # Abrir en Android Studio
```

---

## Seeds y usuarios de prueba

Poblar la base de datos con datos de prueba:

```bash
cd backend
source venv/bin/activate   # o venv\Scripts\activate en Windows
python seed.py
```

El script crea usuarios de prueba con diferentes roles. Consulta `seed.py` para ver las credenciales de los usuarios generados.

---

## Tests

### Backend

```bash
cd backend
source venv/bin/activate
pytest tests/
```

Para ver cobertura detallada:

```bash
pytest tests/ -v
```

Estado actual: **50 tests pasando** ✅

Suite de tests cubiertos:
- `test_auth.py` — login, tokens JWT, registro
- `test_authorization.py` — permisos por rol en todos los endpoints
- `test_booking_status_sync.py` — sincronización de estados de reservas

### Frontend

Tests unitarios:
```bash
cd mobile/alesport-app
npm run test.unit
```

Tests E2E (requiere servidor de desarrollo activo):
```bash
npm run test.e2e
```

---

## Builds móvil — iOS y Android

### iOS (manual con Xcode)

Requiere Mac con Xcode instalado.

```bash
cd mobile/alesport-app
npm run build
npx cap sync ios
npx cap open ios
```

En Xcode:
1. Selecciona tu equipo de desarrollo en **Signing & Capabilities**
2. Conecta un dispositivo o selecciona un simulador
3. `Product → Archive` para generar el `.ipa` de distribución

### iOS (automático via Codemagic)

Ver sección [CI/CD — Codemagic](#cicd--codemagic).

### Android (manual)

Requiere Android Studio y Java 17+.

```bash
cd mobile/alesport-app
npm run build
npx cap sync android
npx cap open android
```

Para generar un APK firmado de release:

```bash
# Desde la raíz del proyecto Android
cd mobile/alesport-app/android
./gradlew assembleRelease
```

El APK se genera en: `android/app/build/outputs/apk/release/`

**Archivos de firma** (no versionar, mantener en copia de seguridad privada):
- `android/app/alesport-release-key.jks` — keystore
- `android/keystore.properties` — contraseñas y alias

---

## CI/CD — Codemagic

El pipeline de integración y distribución continua está configurado en `codemagic.yaml`.

### Workflow iOS (`ionic-ios`)

**Qué hace:**
1. Instala dependencias Node.js
2. Ejecuta `npm run build`
3. Prepara el proyecto iOS y sincroniza Capacitor
4. Inyecta el `GoogleService-Info.plist` desde variable de entorno
5. Resuelve paquetes Swift
6. Aplica perfiles de firma de Codemagic
7. Asigna build number único (usando `PROJECT_BUILD_NUMBER` o timestamp)
8. Compila el `.xcarchive` en Release
9. Exporta el `.ipa`
10. Publica en TestFlight (`submit_to_testflight: true`)

**Variables de entorno necesarias en Codemagic** (grupo `ios`):

| Variable | Descripción |
|---|---|
| `APPLE_TEAM_ID` | ID del equipo de desarrollo de Apple |
| `GOOGLE_SERVICE_INFO_PLIST_BASE64` | `GoogleService-Info.plist` codificado en Base64 |

**Activar publicación a App Store:**

En `codemagic.yaml`, cambiar:
```yaml
submit_to_app_store: false  →  true
```

---

## Despliegue en producción (VPS)

### Arquitectura del VPS

- **OS:** Ubuntu
- **Web server:** nginx (reverse proxy + TLS)
- **Backend:** FastAPI + uvicorn bajo systemd
- **Base de datos:** PostgreSQL
- **Cache/bus realtime:** Redis
- **Certificados:** Let's Encrypt via Certbot

### Deploy completo (primera vez)

```bash
# En el VPS
cd /home/teslol/alesport/backend
source venv/bin/activate
pip install -r requirements.txt

# Reiniciar servicio
sudo systemctl restart alesport-backend
sudo systemctl status alesport-backend --no-pager
```

### Checklist de deploy

Antes de cada deploy en producción, verificar:

- [ ] `pip install -r requirements.txt` ejecutado en el entorno activo
- [ ] Soporte WebSocket disponible: `python -c "import uvicorn, websockets, wsproto; print('ok')"`
- [ ] `REDIS_URL` en el `.env` del servidor
- [ ] `sudo systemctl restart alesport-backend` y status `active (running)`
- [ ] nginx recargado: `sudo nginx -t && sudo systemctl reload nginx`
- [ ] WebSocket activo: bloque `location /api/realtime/ws` en nginx con `Upgrade`/`Connection`
- [ ] Prueba funcional: abrir DevTools → Network → WS → debe aparecer `wss://api.verdeguerlabs.es/api/realtime/ws` con código 101

### Rollback realtime (incidencia en producción)

Si el canal WebSocket falla, la app sigue funcionando vía polling. Para restaurar el realtime:

```bash
# Rollback rápido (polling activo, WS desactivado temporalmente)
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl restart alesport-backend

# Recovery realtime (reactivar WS con validación)
cd /home/teslol/alesport/backend
source venv/bin/activate
pip install -r requirements.txt
python -c "import uvicorn, websockets, wsproto; print('ok', uvicorn.__version__)"
sudo systemctl restart alesport-backend
sudo nginx -t
sudo systemctl reload nginx
sudo nginx -T | grep -nE "location /api/realtime/ws|proxy_http_version|Upgrade|Connection"
```

Rehabilitar realtime solo cuando:
- `uvicorn[standard]` instalado en entorno activo
- Bloque WS de nginx cargado con `Upgrade`/`Connection`
- Handshake con `101 Switching Protocols` visible en DevTools

### Nota sobre workers

| Configuración | Modo |
|---|---|
| `REDIS_URL` configurado | Bus Redis Pub/Sub — válido para múltiples workers |
| Sin `REDIS_URL` | Bus en memoria del proceso — solo válido para 1 worker |

Para producción con múltiples réplicas, `REDIS_URL` es obligatorio.

---

## Troubleshooting

### 403 inesperado en endpoints de reservas

Revisar en este orden:

1. Token JWT vigente — hacer logout/login para renovar
2. Rol del usuario en BD: `superadmin`, `admin`, `trainer` o `client`
3. `is_active = true` para el usuario
4. Para reservar como cliente: `membership_active = true`
5. Para `GET /bookings/session/{id}`: ser admin/superadmin o trainer dueño de la sesión

### Muchas peticiones GET repetidas en logs

Comportamiento esperado si hay polling activo en pantallas abiertas. Soluciones:
- Aumentar constantes de refresco en frontend (de 10000 ms a 20000-30000 ms)
- Pasar a refresco manual + evento de visibilidad

### No se ven clientes/alumnos en acciones de sesión

Los alumnos deben cumplir: `role = client` + `is_active = true` + `membership_active = true`. Verificar estos tres campos en la BD.

### WebSocket no conecta (código ≠ 101)

1. Verificar que el bloque `location /api/realtime/ws` está en nginx con `proxy_http_version 1.1` y headers `Upgrade`/`Connection`
2. Verificar que `uvicorn[standard]` está instalado: `pip show uvicorn`
3. Revisar logs: `sudo journalctl -u alesport-backend -n 50`

### Build de Codemagic falla en firma iOS

1. Verificar que el certificado de distribución no ha expirado en App Store Connect
2. Comprobar que el provisioning profile incluye el `bundle_identifier: com.alesport.app`
3. Revisar que la integración `app_store_connect` en Codemagic tiene acceso a la API key de Apple

---

## Convenciones UI

Para mantener consistencia visual en todos los formularios:

- Los mensajes de bloqueo por usuario inactivo o membresía inactiva usan **clases CSS dedicadas** (sin estilos inline)
- Los archivos CSS de formularios principales están ordenados por índice de secciones comentado
- Tipografía y estilos homogéneos en mensajes de estado y carga
- Traducciones de bloqueo centralizadas en `LanguageContext` (ES/EN)
- `refreshProfile()` de `AuthContext` es silencioso por defecto (`showLoading: false`); solo muestra spinner cuando se llama con `{ showLoading: true }` (bootstrap y login)

---

## Contribuir

Ver [CONTRIBUTING.md](CONTRIBUTING.md) para el flujo completo de ramas, PRs y convenciones de código.

**Resumen rápido:**

```bash
# 1. Crear rama desde main
git checkout main
git pull origin main
git checkout -b feat/mi-funcionalidad

# 2. Desarrollar y commitear
git add .
git commit -m "feat: descripción del cambio"

# 3. Verificar tests antes del PR
cd backend && pytest tests/
cd mobile/alesport-app && npm run build

# 4. Push y abrir PR a main
git push origin feat/mi-funcionalidad
```

Convenciones de rama:
- `feat/` — nueva funcionalidad
- `fix/` — corrección de bug
- `chore/` — mantenimiento, dependencias, docs

> Actualiza este README en el mismo PR si cambias reglas de permisos, membresía, refresco automático o cualquier comportamiento documentado aquí.

---

## Licencia y contacto

**Desarrollado por:** Verdeguer Labs

**Web:** https://www.verdeguerlabs.es

**Email:** info@verdeguerlabs.es

**App ID (iOS/Android):** `com.alesport.app`

---

*Este README refleja el estado de la aplicación a abril de 2026.*

