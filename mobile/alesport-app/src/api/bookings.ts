import { baseApiUrl } from './config';
import { fetchWithAuth } from './fetchWithAuth';

export type BookingItem = {
  id: number;
  user_id: number;
  session_id: number;
  status: 'active' | 'cancelled' | string;
  created_at: string;
  session_start_time?: string | null;
  user_name?: string | null;
  user_email?: string | null;
};

async function getResponseErrorDetail(response: Response, fallbackMessage: string): Promise<string> {
  const data = await response.json().catch(() => ({}));
  return data?.detail || fallbackMessage;
}

export async function getBookingsBySession(sessionId: number): Promise<BookingItem[]> {
  const response = await fetchWithAuth(`${baseApiUrl}/bookings/session/${sessionId}`);
  if (!response.ok) {
    throw new Error(await getResponseErrorDetail(response, 'No se pudieron cargar las reservas de la sesión'));
  }
  return response.json();
}

export async function getAllBookings(): Promise<BookingItem[]> {
  const response = await fetchWithAuth(`${baseApiUrl}/bookings/`);
  if (!response.ok) {
    throw new Error(await getResponseErrorDetail(response, 'No se pudieron cargar todas las reservas'));
  }
  return response.json();
}

export async function getBookingsByUser(userId: number): Promise<BookingItem[]> {
  const response = await fetchWithAuth(`${baseApiUrl}/bookings/user/${userId}`);
  if (!response.ok) {
    throw new Error(await getResponseErrorDetail(response, 'No se pudieron cargar tus reservas'));
  }
  return response.json();
}

export async function createBooking(sessionId: number): Promise<BookingItem> {
  const response = await fetchWithAuth(`${baseApiUrl}/bookings/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId }),
  });
  if (!response.ok) {
    throw new Error(await getResponseErrorDetail(response, 'No se pudo crear la reserva'));
  }
  return response.json();
}

export async function cancelBooking(bookingId: number): Promise<BookingItem> {
  const response = await fetchWithAuth(`${baseApiUrl}/bookings/${bookingId}/cancel`, {
    method: 'PATCH',
  });
  if (!response.ok) {
    throw new Error(await getResponseErrorDetail(response, 'No se pudo cancelar la reserva'));
  }
  return response.json();
}

export async function reactivateBooking(bookingId: number): Promise<BookingItem> {
  const response = await fetchWithAuth(`${baseApiUrl}/bookings/${bookingId}/reactivate`, {
    method: 'PATCH',
  });
  if (!response.ok) {
    throw new Error(await getResponseErrorDetail(response, 'No se pudo reactivar la reserva'));
  }
  return response.json();
}
