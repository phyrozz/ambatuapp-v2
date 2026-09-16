'use client';
import { games } from '@/lib/catalog';
import { GameCard } from '@/components/cards';
import { useI18n } from '@/components/i18n-provider';
export default function Games() {
  const { t } = useI18n();
  return (
    <div className="page">
      <div className="page-heading">
        <p className="eyebrow">{t('games.eyebrow')}</p>
        <h1>{t('games.title')}</h1>
        <p>{t('games.description')}</p>
      </div>
      <div className="game-grid game-library">
        {games.map((g) => (
          <GameCard key={g.id} game={g} />
        ))}
      </div>
      <div className="note-panel">
        {t('games.offline')}
      </div>
    </div>
  );
}
