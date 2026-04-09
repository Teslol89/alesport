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
const NOTIFICATIONS_ENABLED_KEY = 'alesport-notifications-enabled';

type NotificationPermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported';

let listenersRegistered = false;

type PushSessionPayload = {
    type?: string;
    session_id?: string;
    booking_id?: string;
    session_date?: string;
};

function readStoredNotificationsPreference(): boolean {
    return localStorage.getItem(NOTIFICATIONS_ENABLED_KEY) !== 'false';
}

function writeStoredNotificationsPreference(enabled: boolean): void {
    localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, String(enabled));
}

async function getNotificationPermissionState(): Promise<NotificationPermissionState> {
    if (!Capacitor.isNativePlatform()) {
        return 'unsupported';
    }

    try {
        const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
        if (typeof FirebaseMessaging.checkPermissions === 'function') {
            const { receive } = await FirebaseMessaging.checkPermissions();
            if (receive === 'granted') {
                return 'granted';
            }
            if (receive === 'denied') {
                return 'denied';
            }
            return 'prompt';
        }
    } catch (err) {
        console.warn('[FCM] No se pudo consultar el estado del permiso:', err);
    }

    return 'prompt';
}

export async function getNotificationsEnabled(): Promise<boolean> {
    const preferred = readStoredNotificationsPreference();

    if (!Capacitor.isNativePlatform()) {
        return preferred;
    }

    const permissionState = await getNotificationPermissionState();
    if (permissionState === 'granted') {
        return preferred;
    }

    if (permissionState === 'denied') {
        writeStoredNotificationsPreference(false);
        try {
            await saveFcmToken('');
        } catch {
            // Ignorar si el backend no está disponible en ese momento.
        }
        return false;
    }

    return preferred;
}

export async function setNotificationsEnabled(enabled: boolean): Promise<boolean> {
    writeStoredNotificationsPreference(enabled);

    if (!Capacitor.isNativePlatform()) {
        return enabled;
    }

    if (!enabled) {
        try {
            const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
            const maybeDeleteToken = (FirebaseMessaging as unknown as { deleteToken?: () => Promise<void> }).deleteToken;
            if (typeof maybeDeleteToken === 'function') {
                await maybeDeleteToken();
            }
        } catch {
            // Si el plugin no soporta borrar el token, seguimos igualmente.
        }

        try {
            await saveFcmToken('');
        } catch (err) {
            console.warn('[FCM] No se pudo limpiar el token FCM en backend:', err);
        }

        return false;
    }

    return registerFcmToken();
}

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

export async function registerFcmToken(): Promise<boolean> {
    if (!readStoredNotificationsPreference()) {
        return false;
    }

    // Solo funciona en dispositivos nativos (Android/iOS)
    if (!Capacitor.isNativePlatform()) {
        return true;
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
            writeStoredNotificationsPreference(false);
            try {
                await saveFcmToken('');
            } catch {
                // Ignorar limpieza fallida del token.
            }
            console.warn('[FCM] Permiso de notificaciones denegado');
            return false;
        }

        await ensureNotificationListeners();

        // Obtener el token del dispositivo
        const { token } = await FirebaseMessaging.getToken();
        if (!token) {
            console.warn('[FCM] No se pudo obtener el token FCM');
            return false;
        }

        // Guardar el token en el backend
        await saveFcmToken(token);
        writeStoredNotificationsPreference(true);
        console.log('[FCM] Token registrado correctamente');
        return true;

    } catch (err) {
        // No bloqueamos el flujo de la app si FCM falla
        console.warn('[FCM] Error registrando token:', err);
        return false;
    }
}
