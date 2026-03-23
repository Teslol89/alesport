import { baseApiUrl } from './config';

/**
 * Realiza una petición fetch autenticada usando el token JWT si existe.
 * Si la respuesta es 401, lanza un error especial para manejar logout automático.
 */
export async function fetchWithAuth(input: RequestInfo, init: RequestInit = {}) {
  const token = localStorage.getItem('token');
  const headers = new Headers(init.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const response = await fetch(input, { ...init, headers });
  if (response.status === 401) {
    // Token inválido o expirado
    throw new Error('UNAUTHORIZED');
  }
  return response;
}
