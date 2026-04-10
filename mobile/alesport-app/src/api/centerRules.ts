import { baseApiUrl } from './config';
import { fetchWithAuth } from './fetchWithAuth';

export async function getCenterRules(): Promise<string[]> {
  const response = await fetchWithAuth(`${baseApiUrl}/center-rules/`);

  if (!response.ok) {
    throw new Error('No se pudieron cargar las normas del centro');
  }

  const data = await response.json();
  return Array.isArray(data?.rules)
    ? data.rules.filter((rule: unknown): rule is string => typeof rule === 'string')
    : [];
}

export async function updateCenterRules(rules: string[]): Promise<string[]> {
  const response = await fetchWithAuth(`${baseApiUrl}/center-rules/`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rules }),
  });

  if (!response.ok) {
    try {
      const data = await response.json();
      if (typeof data?.detail === 'string' && data.detail.trim()) {
        throw new Error(data.detail);
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
    }

    throw new Error('No se pudieron guardar las normas del centro');
  }

  const data = await response.json();
  return Array.isArray(data?.rules)
    ? data.rules.filter((rule: unknown): rule is string => typeof rule === 'string')
    : [];
}
