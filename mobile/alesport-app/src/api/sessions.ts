import { fetchWithAuth } from "./fetchWithAuth";

const baseApiUrl = import.meta.env.VITE_API_URL || "https://verdeguerlabs.es/api";

export async function getSessionsByDateRange(startDate: string, endDate: string) {
  const url = `${baseApiUrl}/sessions/?start_date=${startDate}&end_date=${endDate}`;
  const response = await fetchWithAuth(url);
  if (!response.ok) {
    throw new Error("Error al obtener sesiones");
  }
  return response.json();
}

// PATCH para actualizar hora de una sesión
export async function patchSessionHour(sessionId: number, start_time: string, end_time: string) {
  const url = `${baseApiUrl}/sessions/${sessionId}`;
  const body = JSON.stringify({ start_time, end_time });
  const response = await fetchWithAuth(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (!response.ok) {
    throw new Error('Error al actualizar la hora de la sesión');
  }
  return response.json();
}
