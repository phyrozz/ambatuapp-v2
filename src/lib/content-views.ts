type ViewKind = 'lore' | 'character';

const storageKey = 'ambatuapp-content-viewer';
let fallbackViewerId = '';

export function contentViewerId() {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(saved)) return saved;
    const id = crypto.randomUUID();
    localStorage.setItem(storageKey, id);
    return id;
  } catch {
    fallbackViewerId ||= crypto.randomUUID();
    return fallbackViewerId;
  }
}

export async function recordContentView(kind: ViewKind, id: string, token: string | null) {
  try {
    const base = process.env.NEXT_PUBLIC_CHARACTER_API_URL?.replace(/\/$/, '') ?? `${window.location.origin}/api/public`;
    await fetch(`${base}/contributions/views`, {
      method: 'POST',
      cache: 'no-store',
      keepalive: true,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ kind, id, visitorId: contentViewerId() }),
    });
  } catch {
    // View recording is best-effort and must not interrupt reading.
  }
}
