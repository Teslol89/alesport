/**
 * Registro del token FCM de Firebase Cloud Messaging.
 * Se llama cuando el usuario está autenticado para asociar su dispositivo
 * al backend y recibir notificaciones push.
 *
 * Requiere instalar: npm install @capacitor-firebase/messaging
 */

import { Capacitor } from '@capacitor/core';
import { saveFcmToken } from '../api/user';

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
