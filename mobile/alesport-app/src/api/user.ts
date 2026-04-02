import { baseApiUrl } from "./config";
import { fetchWithAuth } from "./fetchWithAuth";

export type AssignableTrainer = {
  id: number;
  name: string;
  role: "admin" | "trainer";
};

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

export async function getAssignableTrainers(): Promise<AssignableTrainer[]> {
  const response = await fetchWithAuth(`${baseApiUrl}/users`);
  if (response.status === 403) {
    const meResponse = await fetchWithAuth(`${baseApiUrl}/auth/me`);
    if (!meResponse.ok) {
      throw new Error("No se pudo cargar la lista de entrenadores");
    }
    const me = await meResponse.json();
    const meRole = typeof me?.role === "string" ? me.role : "";
    if ((meRole === "admin" || meRole === "trainer") && me?.id && me?.name) {
      return [{ id: Number(me.id), name: String(me.name).trim(), role: meRole }];
    }
    return [];
  }

  if (!response.ok) {
    throw new Error("No se pudo cargar la lista de entrenadores");
  }

  const users = await response.json();
  if (!Array.isArray(users)) {
    return [];
  }

  const trainerUsers = users
    .filter((user: any) => {
      const role = typeof user?.role === "string" ? user.role : "";
      return (role === "admin" || role === "trainer") && user?.is_active !== false;
    })
    .map((user: any) => ({
      id: Number(user.id),
      name: String(user.name ?? "").trim(),
      role: user.role as "admin" | "trainer",
    }))
    .filter((user: AssignableTrainer) => Number.isFinite(user.id) && user.id > 0 && user.name.length > 0)
    .sort((a: AssignableTrainer, b: AssignableTrainer) => {
      if (a.role !== b.role) {
        return a.role === "admin" ? -1 : 1;
      }
      return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
    });

  return trainerUsers;
}
