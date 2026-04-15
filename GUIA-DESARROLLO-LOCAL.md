# Guía de desarrollo local — Alesport

> ⚠️ La app ya está en producción. Sigue esta guía al pie de la letra para no tocar nunca la base de datos ni la API de producción mientras desarrollas.

---

## Entornos que existen

| Entorno | Backend | Base de datos | Frontend |
|---|---|---|---|
| **Local (tu PC)** | `http://localhost:8000` | `alesportAPP` en tu PostgreSQL local | `http://localhost:8100` |
| **Producción (VPS)** | `https://api.verdeguerlabs.es` | PostgreSQL en el VPS | `https://alesport.verdeguerlabs.es` |

**Regla de oro: nunca mezcles entornos.** Si tu `.env.local` existe y apunta a localhost, estás seguro.

---

## Archivos clave que controlan el entorno

### 1. `alesport/.env` — backend local
```
DATABASE_URL=postgresql://postgres:****@localhost:5432/alesportAPP
```
➡ Apunta a tu BD local. El VPS tiene su propio `.env` con la BD de producción.

### 2. `mobile/alesport-app/.env` — NO tocar
```
VITE_API_BASE_URL=https://api.verdeguerlabs.es/api
```
➡ Este lo usa Codemagic para los builds de producción. No lo modifiques.

### 3. `mobile/alesport-app/.env.local` — tu archivo de desarrollo
```
VITE_API_BASE_URL=http://localhost:8000/api
```
➡ Vite carga este archivo automáticamente en local, sobreescribiendo el `.env`.
➡ Está en `.gitignore` — nunca se sube al repositorio.

---

## Modo 1 — Desarrollo rápido (web en el navegador del PC)

**Cuándo usarlo:** para desarrollar y probar lógica, llamadas a la API, formularios, etc.

### Paso 1 — Arrancar el backend local
```bash
# En la carpeta backend del proyecto
cd C:\Users\Marcos\dev\repositorios\alesport\backend
venv\Scripts\activate
uvicorn app.main:app --reload
```
✅ Backend corriendo en `http://localhost:8000`

### Paso 2 — Arrancar el frontend local
```bash
cd C:\Users\Marcos\dev\repositorios\alesport\mobile\alesport-app
ionic serve --host=0.0.0.0
```
✅ App en `http://localhost:8100`

### Paso 3 — Abrir en el navegador
Abre `http://localhost:8100` en Chrome.

**Limitación:** no se siente nativo (tiene barra del navegador). Para eso usa el Modo 2.

---

## Modo 2 — Prueba nativa en el móvil Android (Live Reload)

**Cuándo usarlo:** para verificar que la UI se ve y se siente bien como app nativa, antes de hacer un build oficial.

> ⚠️ Requiere que el móvil y el PC estén en la misma red WiFi.

### Paso 1 — Arrancar el backend y el frontend (igual que Modo 1)
Deja corriendo `uvicorn` y `ionic serve --host=0.0.0.0`.

### Paso 2 — Añadir server.url en capacitor.config.ts

Edita `mobile/alesport-app/capacitor.config.ts` y añade el bloque `server`:

```typescript
const config: CapacitorConfig = {
  appId: 'com.alesport.app',
  appName: 'Alesport',
  webDir: 'dist',
  server: {
    url: 'http://192.168.1.131:8100',   // ← tu IP local (puede cambiar si cambias de red)
    cleartext: true
  },
  plugins: {
    Keyboard: {
      resize: KeyboardResize.Ionic,
    },
  },
};
```

> ⚠️ La IP `192.168.1.131` puede cambiar. Compruébala siempre con `ipconfig` en PowerShell antes de usarla.

### Paso 3 — Sincronizar con el proyecto Android
```bash
npx cap sync android
```

### Paso 4 — Lanzar en el móvil desde Android Studio
```bash
npx cap open android
```
En Android Studio: conecta el móvil por USB → pulsa ▶ Run.

La app se instala en el móvil y carga el código desde tu PC en tiempo real.
Cualquier cambio que guardes en el código se actualiza automáticamente en el móvil.

### Paso 5 — ⚠️ OBLIGATORIO AL TERMINAR: revertir capacitor.config.ts

Cuando termines las pruebas, **elimina el bloque `server`** del `capacitor.config.ts`:

```typescript
const config: CapacitorConfig = {
  appId: 'com.alesport.app',
  appName: 'Alesport',
  webDir: 'dist',
  plugins: {
    Keyboard: {
      resize: KeyboardResize.Ionic,
    },
  },
};
```

Luego:
```bash
npx cap sync android
```

> ❌ Si haces un build de Codemagic con `server.url` activo, la app de producción intentará cargar desde tu PC local y no funcionará.

---

## Modo 3 — Build de producción (Codemagic)

**Cuándo usarlo:** cuando tienes una feature lista, testeada en local, y quieres subirla a TestFlight / App Store.

### Checklist antes de hacer push y lanzar Codemagic

- [ ] `capacitor.config.ts` NO tiene el bloque `server` (sin `server.url`)
- [ ] `mobile/alesport-app/.env.local` NO está subido al repositorio (comprueba con `git status`)
- [ ] Los tests del backend pasan: `pytest tests/`
- [ ] El build local funciona: `npm run build` (sin errores)
- [ ] Estás en una rama de feature, no en `main` directamente

### Flujo completo
```bash
# 1. Verificar que no hay server.url en capacitor.config.ts
# 2. Build web
npm run build

# 3. Sincronizar Capacitor
npx cap sync

# 4. Commit y push
git add .
git commit -m "feat: descripción del cambio"
git push origin feat/mi-rama

# 5. Abrir PR a main en GitHub
# 6. Merge → Codemagic detecta el push y lanza el build automáticamente
```

---

## Verificación rápida: ¿estoy en local o en producción?

Abre la consola del navegador (F12) en `http://localhost:8100` y ejecuta:

```javascript
import.meta.env.VITE_API_BASE_URL
```

- Si devuelve `http://localhost:8000/api` → estás en **local** ✅
- Si devuelve `https://api.verdeguerlabs.es/api` → estás apuntando a **producción** ⚠️

---

## Resumen de lo que NUNCA debes hacer

| ❌ No hacer | ✅ En su lugar |
|---|---|
| Modificar el `.env` del VPS para probar | Usar `.env.local` en local |
| Dejar `server.url` en `capacitor.config.ts` al hacer push | Revertir antes del commit |
| Hacer `python seed.py` en el VPS | Solo ejecutarlo en local |
| Borrar tablas o datos directamente en la BD del VPS | Hacer siempre en local |
| Pushear a `main` directamente | Crear rama → PR → merge |

---

## Comprobación de IP local (puede cambiar al cambiar de red WiFi)

```powershell
ipconfig | findstr "IPv4"
```

Si tu IP cambia, actualiza el `server.url` en `capacitor.config.ts` antes de hacer `npx cap sync`.

---

## Base de datos local — dos escenarios

### Escenario A — BD local vacía (primer arranque)

Usa `seed.py` para crear los datos mínimos necesarios (borra todo y recrea desde cero):

```bash
cd C:\Users\Marcos\dev\repositorios\alesport\backend
venv\Scripts\activate
python seed.py
```

> ⚠️ Este script hace `DELETE FROM` de todas las tablas antes de insertar. Úsalo solo con la BD local vacía, nunca en producción.

---

### Escenario B — BD local con dump de producción (flujo habitual)

Usa este flujo para tener datos reales en local más los usuarios de prueba para tests.

#### Paso 1 — Hacer el dump en el VPS

Conéctate al VPS por SSH y ejecuta:

```bash
sudo -u postgres pg_dump alesport > /home/teslol/backup_prod.sql
```

#### Paso 2 — Descargar el dump al PC

Descarga `/home/teslol/backup_prod.sql` mediante FileZilla (o `scp`) a tu PC, por ejemplo al escritorio.

#### Paso 3 — Borrar la BD local y restaurar el dump

En PowerShell en tu PC:

```powershell
# 1. Terminar conexiones activas a la BD local
psql -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'alesportAPP';"

# 2. Borrar la BD local
psql -U postgres -c "DROP DATABASE \"alesportAPP\";"

# 3. Crearla de nuevo vacía
psql -U postgres -c "CREATE DATABASE \"alesportAPP\";"

# 4. Restaurar el dump (ajusta la ruta al archivo descargado)
psql -U postgres -d "alesportAPP" -f "C:\Users\Marcos\Desktop\backup_prod.sql"
```

> Los errores `no existe el rol teslol` al restaurar son normales e inofensivos.

#### Paso 4 — Añadir los usuarios de prueba

```bash
cd C:\Users\Marcos\dev\repositorios\alesport\backend
venv\Scripts\activate
python seed_test_users.py
```

Esto añade los 4 usuarios de prueba sin tocar ningún dato de producción:

| Email | Contraseña | Rol |
|---|---|---|
| `trainer@demo.com` | `trainer123` | trainer |
| `cliente@demo.com` | `cliente123` | client |
| `cliente.sinmembresia@demo.com` | `cliente123` | client |
| `cliente.inactivo@demo.com` | `cliente123` | client |

> El script es idempotente: si lo ejecutas dos veces, detecta que ya existen y los salta.

#### Paso 5 — Limpiar el dump del VPS

El archivo contiene datos sensibles. Bórralo del VPS cuando ya no lo necesites:

```bash
rm /home/teslol/backup_prod.sql
```

---

## Resumen de scripts de BD

| Script | Cuándo usarlo |
|---|---|
| `python seed.py` | BD local vacía — crea datos mínimos desde cero |
| `python seed_test_users.py` | Después de restaurar dump — solo añade 4 usuarios de prueba |

---

*Última actualización: abril 2026*
