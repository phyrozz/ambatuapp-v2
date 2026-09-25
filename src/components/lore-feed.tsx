'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowBigDown, ArrowBigUp, ArrowRight, BookOpen, Languages, MessageCircle, Search, SlidersHorizontal, X } from 'lucide-react';
import { ApiLoading } from './api-loading';
import { useI18n } from './i18n-provider';
import { AppSelect, languageFlag } from './app-select';

type Lore = { id: string; title: string; text: string; tags: string[]; imageUrls: string[]; upvotes: number; downvotes: number; commentCount: number };
type Facets = { tags: string[]; languages: { locale: string; label: string }[] };
const base = () => process.env.NEXT_PUBLIC_CHARACTER_API_URL?.replace(/\/$/, '') ?? '';

export function LoreFeed() {
  const { t } = useI18n();
  const [lores, setLores] = useState<Lore[]>([]), [facets, setFacets] = useState<Facets>({ tags: [], languages: [] });
  const [query, setQuery] = useState(''), [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]), [language, setLanguage] = useState('');
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  useEffect(() => { const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300); return () => clearTimeout(timer); }, [query]);
  const requestUrl = useMemo(() => { const params = new URLSearchParams(); if (debouncedQuery) params.set('q', debouncedQuery); selectedTags.forEach((tag) => params.append('tag', tag)); if (language) params.set('language', language); return `${base()}/lores${params.size ? `?${params}` : ''}`; }, [debouncedQuery, selectedTags, language]);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!base()) { setError(t('lore.notConfigured')); setLoading(false); return; }
    const controller = new AbortController(); setLoading(true); setError('');
    fetch(requestUrl, { cache: 'no-store', signal: controller.signal }).then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error || t('lore.loadError')); return data; }).then((data) => { setLores(data.lores ?? []); setFacets(data.facets ?? { tags: [], languages: [] }); }).catch((reason) => { if (reason.name !== 'AbortError') setError(reason instanceof Error ? reason.message : t('lore.loadError')); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [requestUrl, t]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const filtered = Boolean(query || selectedTags.length || language);
  function toggleTag(tag: string) { setSelectedTags((items) => items.includes(tag) ? items.filter((item) => item !== tag) : [...items, tag]); }
  function clear() { setQuery(''); setSelectedTags([]); setLanguage(''); }
  return <section className="lore-browser"><div className="lore-filters">
    <label className="lore-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('lore.searchPlaceholder')} />{query && <button onClick={() => setQuery('')} aria-label={t('lore.clearSearch')}><X size={15} /></button>}</label>
    <div className="lore-language-filter"><Languages size={17} /><AppSelect value={language} onChange={setLanguage} ariaLabel={t('lore.allLanguages')} options={[{ value: '', label: t('lore.allLanguages'), icon: 'world' }, { value: 'original', label: t('lore.originalEdition'), icon: 'book' }, ...facets.languages.map((item) => ({ value: item.locale, label: item.label, icon: languageFlag(item.locale) }))]} /></div>
    {facets.tags.length > 0 && <div className="lore-tag-filter"><span><SlidersHorizontal size={15} />{t('lore.filterTags')}</span><div>{facets.tags.map((tag) => <button className={selectedTags.includes(tag) ? 'active' : ''} onClick={() => toggleTag(tag)} key={tag}>{tag}</button>)}</div></div>}
    <div className="lore-results-meta"><span>{loading ? t('lore.searching') : t(lores.length === 1 ? 'lore.storyCount' : 'lore.storiesCount', { count: lores.length })}</span>{filtered && <button onClick={clear}><X size={14} />{t('lore.clearFilters')}</button>}</div>
  </div>{loading ? <ApiLoading label={t('lore.searchingArchive')} /> : error ? <Empty title={t('lore.archiveUnavailable')} description={error} /> : !lores.length ? <Empty title={t('lore.none')} description={t('lore.noneHint')} /> : <div className="lore-feed">{lores.map((lore) => <LoreCard lore={lore} key={lore.id} />)}</div>}</section>;
}

function LoreCard({ lore }: { lore: Lore }) {
  const { t } = useI18n(); const excerpt = lore.text.length > 320 ? `${lore.text.slice(0, 320).trimEnd()}…` : lore.text;
  return <article className="lore-card">{lore.imageUrls[0] && <Link className="lore-cover-link" href={`/lores/${lore.id}/`}><img className="lore-cover" src={lore.imageUrls[0]} alt="" /></Link>}<div className="lore-card-copy"><div className="lore-tags">{lore.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><h2><Link href={`/lores/${lore.id}/`}>{lore.title}</Link></h2><p className="lore-excerpt">{excerpt}</p><div className="lore-card-footer"><span className="lore-vote-count" aria-label={`${t('lore.upvote')}: ${lore.upvotes}`}><ArrowBigUp size={17} />{lore.upvotes}</span><span className="lore-vote-count" aria-label={`${t('lore.downvote')}: ${lore.downvotes}`}><ArrowBigDown size={17} />{lore.downvotes}</span><span aria-label={`${t('lore.comments')}: ${lore.commentCount}`}><MessageCircle size={15} />{lore.commentCount}</span><Link className="lore-read" href={`/lores/${lore.id}/`}>{t('lore.readStory')} <ArrowRight size={16} /></Link></div></div></article>;
}
function Empty({ title, description }: { title: string; description: string }) { return <div className="lore-empty"><BookOpen size={28} /><h2>{title}</h2><p>{description}</p></div>; }
