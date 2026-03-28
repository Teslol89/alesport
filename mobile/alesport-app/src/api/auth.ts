import { baseApiUrl } from './config';

// Registro de usuario
export async function registerUser(name: string, email: string, password: string) {
    const response = await fetch(`${baseApiUrl}/auth/register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, email, password })
    });

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
            throw new Error(data.detail);
        }

        // Error genérico fallback
        throw new Error('No se pudo registrar el usuario.');
    }

    return response.json();
}

// Login normal
export async function loginUser(email: string, password: string) {
    const response = await fetch(`${baseApiUrl}/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
        let data: any = null;

        try {
            data = await response.json();
        } catch { }

        if (data?.detail) {
            throw new Error(data.detail);
        }

        throw new Error('Credenciales incorrectas.');
    }

    return response.json();
}

// Login con Google
export async function loginWithGoogle(idToken: string) {
    const response = await fetch(`${baseApiUrl}/auth/google-login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id_token: idToken })
    });

    if (!response.ok) {
        throw new Error('No se pudo iniciar sesión con Google.');
    }

    return response.json();
}