/**
 * Registro del token FCM de Firebase Cloud Messaging.
 * Se llama cuando el usuario está autenticado para asociar su dispositivo
 * al backend y recibir notificaciones push.
 *
 * Requiere instalar: npm install @capacitor-firebase/messaging
 */

import { Capacitor } from '@capacitor/core';
import { saveFcmToken } from '../api/user';

export const PUSH_OPEN_SESSION_EVENT = 'alesport:push-open-session';
const PENDING_PUSH_SESSION_KEY = 'alesport-pending-push-session';

let listenersRegistered = false;

type PushSessionPayload = {
    type?: string;
    session_id?: string;
    booking_id?: string;
    session_date?: string;
};

function normalizePushPayload(raw: unknown): PushSessionPayload | null {
    if (!raw || typeof raw !== 'object') {
        return null;
    }

    const payload = raw as Record<string, unknown>;
    const sessionId = payload.session_id;
    if (typeof sessionId !== 'string' && typeof sessionId !== 'number') {
        return null;
    }

    return {
        type: typeof payload.type === 'string' ? payload.type : undefined,
        session_id: String(sessionId),
        booking_id: payload.booking_id != null ? String(payload.booking_id) : undefined,
        session_date: typeof payload.session_date === 'string' ? payload.session_date : undefined,
    };
}

function persistPendingPushNavigation(payload: PushSessionPayload): void {
    localStorage.setItem(PENDING_PUSH_SESSION_KEY, JSON.stringify(payload));

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(PUSH_OPEN_SESSION_EVENT, { detail: payload }));
    }
}

export function readPendingPushNavigation(): PushSessionPayload | null {
    const raw = localStorage.getItem(PENDING_PUSH_SESSION_KEY);
    if (!raw) {
        return null;
    }

    try {
        return JSON.parse(raw) as PushSessionPayload;
    } catch {
        localStorage.removeItem(PENDING_PUSH_SESSION_KEY);
        return null;
    }
}

export function clearPendingPushNavigation(): void {
    localStorage.removeItem(PENDING_PUSH_SESSION_KEY);
}

async function ensureNotificationListeners(): Promise<void> {
    if (!Capacitor.isNativePlatform() || listenersRegistered) {
        return;
    }

    try {
        const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');

        await FirebaseMessaging.addListener('notificationActionPerformed', (event: any) => {
            const payload = normalizePushPayload(event?.notification?.data ?? event?.notification);
            if (payload?.session_id) {
                persistPendingPushNavigation(payload);
            }
        });

        listenersRegistered = true;
    } catch (err) {
        console.warn('[FCM] Error registrando listeners de navegación:', err);
    }
}

export async function registerFcmToken(): Promise<void> {
    // Solo funciona en dispositivos nativos (Android/iOS)
    if (!Capacitor.isNativePlatform()) {
        return;
    }

    try {
        // Importación dinámica para evitar errores en web
        const { FirebaseMessaging, Importance, Visibility } = await import('@capacitor-firebase/messaging');

        // Canal Android en alta importancia para mostrar heads-up (desplegable)
        await FirebaseMessaging.createChannel({
            id: 'alesport_alerts',
            name: 'Alertas de clases',
            description: 'Cambios de horario y avisos importantes de clases',
            importance: Importance.High,
            visibility: Visibility.Public,
            vibration: true,
        });

        // Pedir permiso de notificaciones al usuario
        const { receive } = await FirebaseMessaging.requestPermissions();
        if (receive !== 'granted') {
            console.warn('[FCM] Permiso de notificaciones denegado');
            return;
        }

        await ensureNotificationListeners();

        // Obtener el token del dispositivo
        const { token } = await FirebaseMessaging.getToken();
        if (!token) {
            console.warn('[FCM] No se pudo obtener el token FCM');
            return;
        }

        // Guardar el token en el backend
        await saveFcmToken(token);
        console.log('[FCM] Token registrado correctamente');

    } catch (err) {
        // No bloqueamos el flujo de la app si FCM falla
        console.warn('[FCM] Error registrando token:', err);
    }
}
