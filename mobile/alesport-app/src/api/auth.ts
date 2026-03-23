import { baseApiUrl } from './config';

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

