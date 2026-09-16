import { CharacterDetail } from '@/components/character-detail';

export default async function Character({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CharacterDetail id={id} />;
}
