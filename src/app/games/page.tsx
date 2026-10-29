'use client';
import { games } from '@/lib/catalog';
import { GameCard } from '@/components/cards';
export default function Games() {
  return (
    <div className="page games-page">
      <div className="game-grid game-library">
        {games.map((g) => (
          <GameCard key={g.id} game={g} showDescription={false} showCategory={false} showTag={false} showLaunch={false} />
        ))}
      </div>
    </div>
  );
}
