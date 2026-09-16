import { games } from '@/lib/catalog';
import { GameCard } from '@/components/cards';
export const metadata = { title: 'Mini-games' };
export default function Games() {
  return (
    <div className="page">
      <div className="page-heading">
        <p className="eyebrow">THE ARCADE IS OPEN</p>
        <h1>One more round?</h1>
        <p>Four little games. Endless “okay, last try” energy.</p>
      </div>
      <div className="game-grid game-library">
        {games.map((g) => (
          <GameCard key={g.id} game={g} />
        ))}
      </div>
      <div className="note-panel">
        ✳ All games work offline in the mobile app. Your personal bests stay on this device.
      </div>
    </div>
  );
}
