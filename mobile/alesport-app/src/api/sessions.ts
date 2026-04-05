/* Importante: Este módulo se centra exclusivamente en la gestión de sesiones,
  incluyendo creación, actualización, cancelación y consulta por rango de fechas.
  No incluye funciones relacionadas con reservas o usuarios, que deben gestionarse
  en módulos separados para mantener una arquitectura limpia y modular. */
import { fetchWithAuth } from "./fetchWithAuth";

/* API para gestionar sesiones: creación, actualización, cancelación y consulta por rango de fechas. */
const baseApiUrl = import.meta.env.VITE_API_URL || "https://verdeguerlabs.es/api";

/* POST para crear varias sesiones recurrentes de forma transaccional */
export async function createRecurringSessions(sessions: Array<{
  session_date: string;
  start_time: string;
  end_time: string;
  capacity: number;
  class_name: string;
  notes?: string;
  trainer_id?: number;
}>) {
  const url = `${baseApiUrl}/sessions/recurring`;
  const response = await fetchWithAuth(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessions }),
  });
  if (!response.ok) {
    throw new Error(await getResponseErrorDetail(response, 'Error al crear sesiones recurrentes'));
  }
  return response.json();
}

/* GET para obtener el detalle de error de una respuesta */
export async function getResponseErrorDetail(response: Response, fallbackMessage: string) {
  try {
    const data = await response.json();
    if (typeof data?.detail === 'string' && data.detail.trim()) {
      return data.detail;
    }
  } catch {
    // Ignorar errores al parsear para usar el mensaje fallback.
  }
  return fallbackMessage;
}

/* POST para crear una sesión única */
export async function createSingleSession(payload: {
  session_date: string;
  start_time: string;
  end_time: string;
  capacity: number;
  class_name: string;
  notes?: string;
  trainer_id?: number;
}) {
  const url = `${baseApiUrl}/sessions/`;
  const response = await fetchWithAuth(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await getResponseErrorDetail(response, 'Error al crear la sesión'));
  }
  return response.json();
}

/* GET para obtener sesiones por rango de fechas (formato YYYY-MM-DD) */
export async function getSessionsByDateRange(startDate: string, endDate: string) {
  const url = `${baseApiUrl}/sessions/?start_date=${startDate}&end_date=${endDate}`;
  const response = await fetchWithAuth(url);
  if (!response.ok) {
    throw new Error("Error al obtener sesiones");
  }
  return response.json();
}

/* PATCH para actualizar hora de una sesión */
export async function patchSessionHour(sessionId: number, start_time: string, end_time: string) {
  const url = `${baseApiUrl}/sessions/${sessionId}`;
  const body = JSON.stringify({ start_time, end_time });
  const response = await fetchWithAuth(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (!response.ok) {
    throw new Error(await getResponseErrorDetail(response, 'Error al actualizar la hora de la sesión'));
  }
  return response.json();
}

/* PATCH para actualizar capacidad, nombre de clase, notas o entrenador de una sesión */
export async function updateSession(sessionId: number, payload: {
  start_time?: string;
  end_time?: string;
  capacity?: number;
  class_name?: string;
  notes?: string;
}) {
  const url = `${baseApiUrl}/sessions/${sessionId}`;
  const response = await fetchWithAuth(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await getResponseErrorDetail(response, 'Error al actualizar la sesión'));
  }
  return response.json();
}

/* DELETE para cancelar una sesión (soft delete: cambia status a 'cancelled') */
export async function cancelSession(sessionId: number) {
  const url = `${baseApiUrl}/sessions/${sessionId}`;
  const response = await fetchWithAuth(url, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    throw new Error(await getResponseErrorDetail(response, 'Error al cancelar la sesión'));
  }
  return response.json();
}

// POST para copiar el horario de una semana a otra
export async function copyWeekSessions({
  source_week_start_date,
  target_week_start_date,
  trainer_id
}: {
  source_week_start_date: string;
  target_week_start_date: string;
  trainer_id?: number;
}) {
  const url = `${baseApiUrl}/sessions/copy-week`;
  const response = await fetchWithAuth(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_week_start_date, target_week_start_date, trainer_id }),
  });
  if (!response.ok) {
    throw new Error(await getResponseErrorDetail(response, 'Error al copiar el horario de la semana'));
  }
  return response.json();
}
