import { baseApiUrl } from "./config";
import { fetchWithAuth } from "./fetchWithAuth";

// Ejemplo: obtener datos del usuario autenticado
export async function getUserProfile(logout: () => void) {
  try {
    const response = await fetchWithAuth(`${baseApiUrl}/auth/me`);
    return await response.json();
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      // Token expirado o inválido: cerrar sesión automáticamente
      logout();
    }
    throw err;
  }
}

export async function saveFcmToken(token: string): Promise<void> {
  await fetchWithAuth(`${baseApiUrl}/users/me/fcm-token`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fcm_token: token }),
  });
}
