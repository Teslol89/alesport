import { fetchWithAuth } from './fetchWithAuth';

const baseApiUrl = import.meta.env.VITE_API_BASE_URL || 'https://api.verdeguerlabs.es/api';

type WeeklyScheduleCreatePayload = {
  trainer_id: number;
  day_of_week: number; // 0=lunes ... 6=domingo
  start_time: string;
  end_time: string;
  capacity: number;
  class_name: string;
  notes?: string;
  fixed_student_ids?: number[];
  weeks_ahead: number;
  start_date?: string;
};

async function getResponseErrorDetail(response: Response, fallbackMessage: string) {
  try {
    const data = await response.json();
    if (typeof data?.detail === 'string' && data.detail.trim()) {
      return data.detail;
    }
  } catch {
    // Ignorar y usar fallback.
  }
  return fallbackMessage;
}

export async function createWeeklySchedule(payload: WeeklyScheduleCreatePayload) {
  const response = await fetchWithAuth(`${baseApiUrl}/schedule/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorDetail(response, 'Error al crear horario semanal'));
  }

  return response.json();
}
