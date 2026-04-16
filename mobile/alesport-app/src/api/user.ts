import { baseApiUrl } from "./config";
import { fetchWithAuth } from "./fetchWithAuth";

export type AssignableTrainer = {
  id: number;
  name: string;
  role: "admin" | "trainer";
};

export type FixedStudentCandidate = {
  id: number;
  name: string;
  email: string;
};

export type UserProfile = {
  id: number;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  membership_active: boolean;
  monthly_booking_quota?: number | null;
  phone?: string | null;
  avatar_url?: string | null;
};

type AdminUserUpdatePayload = {
  is_active?: boolean;
  membership_active?: boolean;
  monthly_booking_quota?: number | null;
};

type UserProfileUpdatePayload = {
  name?: string;
  phone?: string | null;
  avatar_url?: string | null;
};

// Ejemplo: obtener datos del usuario autenticado
export async function getUserProfile(logout: () => void): Promise<UserProfile> {
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

export async function updateUserProfile(payload: UserProfileUpdatePayload): Promise<UserProfile> {
  const response = await fetchWithAuth(`${baseApiUrl}/users/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    try {
      const data = await response.json();
      if (typeof data?.detail === "string" && data.detail.trim().length > 0) {
        throw new Error(data.detail);
      }
      if (Array.isArray(data?.detail) && typeof data.detail[0]?.msg === "string") {
        throw new Error(data.detail[0].msg);
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
    }

    throw new Error("No se pudo actualizar el perfil");
  }

  return await response.json();
}

export async function saveFcmToken(token: string): Promise<void> {
  await fetchWithAuth(`${baseApiUrl}/users/me/fcm-token`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fcm_token: token }),
  });
}

export async function getEligibleFixedStudents(): Promise<FixedStudentCandidate[]> {
  const response = await fetchWithAuth(`${baseApiUrl}/users/eligible-fixed-students`);

  if (!response.ok) {
    throw new Error("No se pudo cargar la lista de alumnos activos");
  }

  const users = await response.json();
  if (!Array.isArray(users)) {
    return [];
  }

  return users
    .map((user: any) => ({
      id: Number(user.id),
      name: String(user.name ?? "").trim(),
      email: String(user.email ?? "").trim(),
    }))
    .filter((user: FixedStudentCandidate) => Number.isFinite(user.id) && user.id > 0 && user.name.length > 0);
}

export async function getAssignableTrainers(): Promise<AssignableTrainer[]> {
  const response = await fetchWithAuth(`${baseApiUrl}/users/assignable-trainers`);

  if (response.status === 403) {
    const meResponse = await fetchWithAuth(`${baseApiUrl}/auth/me`);
    if (!meResponse.ok) {
      throw new Error("No se pudo cargar la lista de entrenadores");
    }
    const me = await meResponse.json();
    const meRole = typeof me?.role === "string" ? me.role : "";
    const meCanTeach = meRole === "trainer" || meRole === "admin";
    if (meCanTeach && me?.id && me?.name) {
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

  return users
    .map((user: any) => ({
      id: Number(user.id),
      name: String(user.name ?? "").trim(),
      role: user.role as "admin" | "trainer",
    }))
    .filter((user: AssignableTrainer) => Number.isFinite(user.id) && user.id > 0 && user.name.length > 0);
}

export async function getUsersForAdmin(): Promise<UserProfile[]> {
  const response = await fetchWithAuth(`${baseApiUrl}/users/`);

  if (!response.ok) {
    throw new Error("No se pudo cargar la lista de usuarios");
  }

  const users = await response.json();
  if (!Array.isArray(users)) {
    return [];
  }

  return users.map((user: any) => ({
    id: Number(user.id),
    name: String(user.name ?? "").trim(),
    email: String(user.email ?? "").trim(),
    role: String(user.role ?? "").trim(),
    is_active: Boolean(user.is_active),
    membership_active: Boolean(user.membership_active),
    monthly_booking_quota:
      typeof user.monthly_booking_quota === "number" ? user.monthly_booking_quota : null,
    phone: typeof user.phone === "string" ? user.phone : null,
    avatar_url: typeof user.avatar_url === "string" ? user.avatar_url : null,
  }));
}

export async function updateUserAdminSettings(userId: number, payload: AdminUserUpdatePayload): Promise<UserProfile> {
  const response = await fetchWithAuth(`${baseApiUrl}/users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    try {
      const data = await response.json();
      if (typeof data?.detail === "string" && data.detail.trim().length > 0) {
        throw new Error(data.detail);
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
    }

    throw new Error("No se pudieron guardar los cambios del usuario");
  }

  return await response.json();
}

export async function deleteMyAccount(): Promise<void> {
  const response = await fetchWithAuth(`${baseApiUrl}/users/me`, {
    method: "DELETE",
  });
  if (!response.ok && response.status !== 204) {
    throw new Error("No se pudo eliminar la cuenta");
  }
}
