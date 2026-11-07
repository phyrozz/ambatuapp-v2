const base = process.env.NEXT_PUBLIC_CHARACTER_API_URL?.replace(/\/$/, '') ?? '';

export async function memberApi<T>(
  path: string,
  token: string | null,
  signal?: AbortSignal,
  body?: unknown,
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
): Promise<T> {
  if (!base || !token) throw new Error('MEMBER_API_UNAVAILABLE');
  const response = await fetch(`${base}${path}`, {
    method: method ?? (body === undefined ? 'GET' : 'POST'),
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  if (!response.ok) throw new Error('MEMBER_API_FAILED');
  return response.json() as Promise<T>;
}
