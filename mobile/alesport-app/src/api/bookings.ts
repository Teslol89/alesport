import { baseApiUrl } from './config';
import { fetchWithAuth } from './fetchWithAuth';

export type BookingItem = {
  id: number;
  user_id: number;
  session_id: number;
  status: 'active' | 'cancelled' | string;
  created_at: string;
  user_name?: string | null;
  user_email?: string | null;
};

export async function getBookingsBySession(sessionId: number): Promise<BookingItem[]> {
  const response = await fetchWithAuth(`${baseApiUrl}/bookings/session/${sessionId}`);
  if (!response.ok) {
    throw new Error('No se pudieron cargar las reservas de la sesion');
  }
  return response.json();
}

export async function getAllBookings(): Promise<BookingItem[]> {
  const response = await fetchWithAuth(`${baseApiUrl}/bookings/`);
  if (!response.ok) {
    throw new Error('No se pudieron cargar todas las reservas');
  }
  return response.json();
}

export async function cancelBooking(bookingId: number): Promise<BookingItem> {
  const response = await fetchWithAuth(`${baseApiUrl}/bookings/${bookingId}/cancel`, {
    method: 'PATCH',
  });
  if (!response.ok) {
    throw new Error('No se pudo cancelar la reserva');
  }
  return response.json();
}

export async function reactivateBooking(bookingId: number): Promise<BookingItem> {
  const response = await fetchWithAuth(`${baseApiUrl}/bookings/${bookingId}/reactivate`, {
    method: 'PATCH',
  });
  if (!response.ok) {
    throw new Error('No se pudo reactivar la reserva');
  }
  return response.json();
}
