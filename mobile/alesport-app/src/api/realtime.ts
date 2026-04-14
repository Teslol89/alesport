import { baseApiUrl } from './config';
import { fetchWithAuth } from './fetchWithAuth';

type RealtimeWsTicketResponse = {
  ticket?: string;
};

export async function getRealtimeWsTicket(): Promise<string> {
  const response = await fetchWithAuth(`${baseApiUrl}/realtime/ws-ticket`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('No se pudo obtener ticket realtime');
  }

  const data = await response.json() as RealtimeWsTicketResponse;
  if (!data.ticket || typeof data.ticket !== 'string') {
    throw new Error('Ticket realtime inválido');
  }

  return data.ticket;
}
