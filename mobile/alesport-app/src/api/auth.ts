// Registro de usuario real
export async function registerUser(name: string, email: string, password: string) {
    const response = await fetch(`${baseApiUrl}/auth/register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, email, password })
    });
    if (!response.ok) {
        // Intenta extraer mensaje de error del backend
        let errorMsg = 'No se pudo registrar el usuario.';
        try {
            const data = await response.json();
            if (data && data.detail) errorMsg = data.detail;
        } catch { }
        throw new Error(errorMsg);
    }
    return response.json();
}
import { baseApiUrl } from './config';

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

export async function loginUser(email: string, password: string) {
    const response = await fetch(`${baseApiUrl}/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
    });
    // Manejar errores de autenticación
    if (!response.ok) {
        throw new Error('Credenciales incorrectas.');
    }
    // Devuelve el token de autenticación
    return response.json();
}

