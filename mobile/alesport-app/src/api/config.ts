// Usa la variable de entorno VITE_API_BASE_URL si está definida, si no usa la de producción
export const baseApiUrl = import.meta.env.VITE_API_BASE_URL || 'https://www.verdeguerlabs.es/api';

