'use client';

import { BookOpen, Eye, FilePenLine, Headphones, MessageCircle, ThumbsDown, ThumbsUp, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from './auth-provider';
import { useI18n } from './i18n-provider';
import { LoadingIndicator } from './loading-indicator';

type Insights = {
  views: number;
  loreViews: number;
  characterViews: number;
  soundPlays: number;
  soundListeners: number;
  upvotes: number;
  downvotes: number;
  comments: number;
  published: number;
  drafts: number;
};

const metrics = [
  { key: 'views', label: 'insights.views', icon: Eye },
  { key: 'loreViews', label: 'insights.loreViews', icon: BookOpen },
  { key: 'characterViews', label: 'insights.characterViews', icon: Users },
  { key: 'soundPlays', label: 'insights.soundPlays', icon: Headphones },
  { key: 'soundListeners', label: 'insights.soundListeners', icon: Users },
  { key: 'upvotes', label: 'insights.upvotes', icon: ThumbsUp },
  { key: 'downvotes', label: 'insights.downvotes', icon: ThumbsDown },
  { key: 'comments', label: 'insights.comments', icon: MessageCircle },
  { key: 'published', label: 'insights.published', icon: Eye },
  { key: 'drafts', label: 'insights.drafts', icon: FilePenLine },
] as const;

function apiUrl() {
  const base = process.env.NEXT_PUBLIC_CHARACTER_API_URL?.replace(/\/$/, '') ?? `${window.location.origin}/api/public`;
  return `${base}/contributions/insights`;
}

export function CreatorInsights({ active, userId }: { active: boolean; userId: string }) {
  const { t, locale } = useI18n();
  const { getIdToken } = useAuth();
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!active || !userId) return;
    const controller = new AbortController();
    let mounted = true;
    void (async () => {
      setLoading(true);
      setError(false);
      try {
        const token = await getIdToken();
        if (!token) throw new Error('401');
        const response = await fetch(apiUrl(), {
          cache: 'no-store',
          headers: { authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(String(response.status));
        const data = await response.json() as Partial<Insights>;
        if (!mounted) return;
        setInsights({
          views: Number.isSafeInteger(data.views) && (data.views ?? 0) >= 0 ? data.views! : 0,
          loreViews: Number.isSafeInteger(data.loreViews) && (data.loreViews ?? 0) >= 0 ? data.loreViews! : 0,
          characterViews: Number.isSafeInteger(data.characterViews) && (data.characterViews ?? 0) >= 0 ? data.characterViews! : 0,
          soundPlays: Number.isSafeInteger(data.soundPlays) && (data.soundPlays ?? 0) >= 0 ? data.soundPlays! : 0,
          soundListeners: Number.isSafeInteger(data.soundListeners) && (data.soundListeners ?? 0) >= 0 ? data.soundListeners! : 0,
          upvotes: Number.isSafeInteger(data.upvotes) && (data.upvotes ?? 0) >= 0 ? data.upvotes! : 0,
          downvotes: Number.isSafeInteger(data.downvotes) && (data.downvotes ?? 0) >= 0 ? data.downvotes! : 0,
          comments: Number.isSafeInteger(data.comments) && (data.comments ?? 0) >= 0 ? data.comments! : 0,
          published: Number.isSafeInteger(data.published) && (data.published ?? 0) >= 0 ? data.published! : 0,
          drafts: Number.isSafeInteger(data.drafts) && (data.drafts ?? 0) >= 0 ? data.drafts! : 0,
        });
      } catch {
        if (!controller.signal.aborted && mounted) setError(true);
      } finally {
        if (!controller.signal.aborted && mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [active, attempt, getIdToken, userId]);

  return (
    <div className="creator-insights">
      <header className="creator-insights-heading">
        <div>
          <p className="eyebrow">{t('profile.tabInsights')}</p>
          <h2>{t('insights.title')}</h2>
          <p>{t('insights.description')}</p>
        </div>
      </header>
      <p className="dreamy-section-hint creator-insights-note">{t('insights.viewDefinition')}</p>
      {error && (
        <div className="my-contributions-error" role="alert">
          <p>{t('insights.loadError')}</p>
          <button className="button secondary compact" type="button" onClick={() => setAttempt((value) => value + 1)}>
            {t('common.retry')}
          </button>
        </div>
      )}
      {loading && <LoadingIndicator label={t('insights.loading')} />}
      {insights && !loading && (
        <dl className="creator-insights-grid" aria-busy={loading}>
          {metrics.map(({ key, label, icon: Icon }) => (
            <div key={key}>
              <dt><Icon size={19} aria-hidden="true" />{t(label)}</dt>
              <dd>{insights[key].toLocaleString(locale)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
