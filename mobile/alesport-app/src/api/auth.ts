import { baseApiUrl } from './config';

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

