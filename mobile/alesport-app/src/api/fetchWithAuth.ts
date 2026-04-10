import { baseApiUrl } from './config';

/**
 * Realiza una petición fetch autenticada usando el token JWT si existe.
 * Si la respuesta es 401, lanza un error especial para manejar logout automático.
 */
export async function fetchWithAuth(input: RequestInfo, init: RequestInit = {}) {
  const token = localStorage.getItem('token');
  const headers = new Headers(init.headers || {});
  const method = (init.method || 'GET').toUpperCase();
  const cacheMode = init.cache ?? ((method === 'GET' || method === 'HEAD') ? 'no-store' : undefined);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(input, {
    ...init,
    headers,
    cache: cacheMode,
  });

  if (response.status === 401) {
    // Token inválido o expirado: limpiar sesión local y notificar a la app.
    localStorage.removeItem('token');
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    throw new Error('UNAUTHORIZED');
  }
  return response;
}
