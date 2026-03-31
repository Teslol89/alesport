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
