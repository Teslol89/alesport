import { baseApiUrl } from './config';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(
    url: string,
    init: RequestInit,
    maxAttempts = 2
): Promise<Response> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fetch(url, init);
        } catch (error) {
            lastError = error;
            if (attempt < maxAttempts) {
                await sleep(700);
            }
        }
    }

    throw lastError;
}

// Registro de usuario
export async function registerUser(name: string, email: string, password: string) {
    let response: Response;
    try {
        response = await fetchWithRetry(`${baseApiUrl}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, password })
        }, 2);
    } catch {
        throw new Error('No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.');
    }

    if (!response.ok) {
        let data: any = null;

        // Intentar leer respuesta JSON
        try {
            data = await response.json();
        } catch (e) {
            // Si falla, seguimos
        }

        // Error de validación (FastAPI 422)
        if (response.status === 422 && data?.detail) {
            const error = new Error('Validation error');
            (error as any).apiDetail = data.detail;
            throw error;
        }

        // Error normal del backend
        if (data?.detail) {
            if (response.status === 404) {
                throw new Error(
                    `No se encontró el endpoint de registro en la API. URL consultada: ${response.url}`
                );
            }
            throw new Error(data.detail);
        }

        // Error genérico fallback
        throw new Error(`No se pudo registrar el usuario. Código: ${response.status}`);
    }

    return response.json();
}

// Login normal
export async function loginUser(email: string, password: string) {
    let response: Response;
    try {
        response = await fetchWithRetry(`${baseApiUrl}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        }, 2);
    } catch {
        throw new Error('No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.');
    }

    if (!response.ok) {
        let data: any = null;

        try {
            data = await response.json();
        } catch { }

        if (data?.detail) {
            if (response.status === 404) {
                throw new Error(
                    `No se encontró el endpoint de login en la API. URL consultada: ${response.url}`
                );
            }
            throw new Error(data.detail);
        }

        throw new Error('Credenciales incorrectas.');
    }

    return response.json();
}

// Consulta si existe un usuario pendiente (no verificado) por email
export async function getPendingUser(email: string) {
    const response = await fetch(`${baseApiUrl}/users/pending/${encodeURIComponent(email)}`);
    if (!response.ok) {
        if (response.status === 404) return null;
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || 'No se pudo consultar el usuario pendiente.');
    }
    return response.json();
}

// Elimina un usuario pendiente (no verificado) por email
export async function deletePendingUser(email: string) {
    const response = await fetch(`${baseApiUrl}/users/pending/${encodeURIComponent(email)}`, {
        method: 'DELETE',
    });
    if (!response.ok) {
        // Si 404, ya no existe, lo tratamos como éxito para el flujo
        if (response.status === 404) return;
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || 'No se pudo eliminar el usuario pendiente.');
    }
    return;
}