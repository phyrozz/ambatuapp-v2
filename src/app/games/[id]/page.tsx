import { games } from '@/lib/catalog';
import { notFound } from 'next/navigation';
import { GamePlayer } from '@/components/game-player';
export function generateStaticParams() {
  return games.map((g) => ({ id: g.id }));
}
export default async function Game({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const game = games.find((g) => g.id === id);
  if (!game) notFound();
  return <GamePlayer id={game.id} />;
}
