export type Character = {
  id: string;
  name: string;
  description: string[];
  image?: string;
  header?: string;
  links: string[];
  soundIds: string[];
};

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function toCharacter(id: string, data: Record<string, unknown>): Character | null {
  if (typeof data.name !== 'string' || !data.name.trim()) return null;
  const rawDescription = data.bio ?? data.description ?? data.paragraphs;
  const description =
    typeof rawDescription === 'string'
      ? rawDescription.split(/\n\s*\n|\r?\n/).filter(Boolean)
      : strings(rawDescription);
  return {
    id,
    name: data.name.trim(),
    description,
    image: typeof data.imageUrl === 'string' ? data.imageUrl : typeof data.image === 'string' ? data.image : undefined,
    header: typeof data.headerUrl === 'string' ? data.headerUrl : undefined,
    links: strings(data.links),
    soundIds: strings(data.soundIds),
  };
}

export async function getCharacters(): Promise<Character[]> {
  const baseUrl = process.env.NEXT_PUBLIC_CHARACTER_API_URL;
  if (!baseUrl) throw new Error('Character API is not configured.');
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/characters`);
  if (!response.ok) throw new Error('Could not load characters.');
  const payload = await response.json() as { characters?: Array<Record<string, unknown>> };
  return (payload.characters ?? [])
    .map((item) => toCharacter(String(item.id ?? ''), item))
    .filter((item): item is Character => item !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getCharacter(id: string): Promise<Character | null> {
  const baseUrl = process.env.NEXT_PUBLIC_CHARACTER_API_URL;
  if (!baseUrl) throw new Error('Character API is not configured.');
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/characters/${encodeURIComponent(id)}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Could not load character.');
  const payload = await response.json() as Record<string, unknown>;
  return toCharacter(String(payload.id ?? id), payload);
}
