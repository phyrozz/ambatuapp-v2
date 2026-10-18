'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useRef, useState } from 'react';
import { useI18n } from './i18n-provider';
import './my-dreamy-tour.css';

export type MyDreamyTourTab = 'videos' | 'characters' | 'lores' | 'sounds' | 'profile' | 'activity' | 'insights';

const steps: Array<{
  tab?: MyDreamyTourTab;
  target: string;
  titleKey: string;
  descriptionKey: string;
}> = [
  { target: '#dreamy-tabs', titleKey: 'tour.welcomeTitle', descriptionKey: 'tour.welcomeDescription' },
  {
    tab: 'videos',
    target: '#my-videos .creator-clips-section > header',
    titleKey: 'profile.tabVideos',
    descriptionKey: 'tour.videosDescription',
  },
  {
    tab: 'characters',
    target: '#my-characters .my-contributions-heading',
    titleKey: 'profile.tabCharacters',
    descriptionKey: 'tour.charactersDescription',
  },
  {
    tab: 'lores',
    target: '#my-lores .my-contributions-heading',
    titleKey: 'profile.tabLore',
    descriptionKey: 'tour.loresDescription',
  },
  {
    tab: 'sounds',
    target: '#my-sounds .my-contributions-heading',
    titleKey: 'profile.tabSoundboard',
    descriptionKey: 'tour.soundsDescription',
  },
  {
    tab: 'profile',
    target: '#my-profile-editor .dreamy-section-heading',
    titleKey: 'profile.tabEdit',
    descriptionKey: 'tour.profileDescription',
  },
  {
    tab: 'activity',
    target: '#my-activity .dreamy-section-heading',
    titleKey: 'profile.tabActivity',
    descriptionKey: 'tour.activityDescription',
  },
  {
    tab: 'insights',
    target: '#my-insights .creator-insights-heading',
    titleKey: 'profile.tabInsights',
    descriptionKey: 'tour.insightsDescription',
  },
];

type TourRect = { top: number; right: number; bottom: number; left: number };
type TourPosition = { top: number; left: number };

function sameRect(a: TourRect | null, b: TourRect) {
  return a?.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left;
}

function samePosition(a: TourPosition | null, b: TourPosition) {
  return a?.top === b.top && a.left === b.left;
}

function storageKey(userId: string) {
  return `ambatuapp-mydreamy-tour:${userId}`;
}

export function MyDreamyTour({
  userId,
  onSelectTab,
}: {
  userId: string;
  onSelectTab: (tab: MyDreamyTourTab) => void;
}) {
  const { t } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<TourRect | null>(null);
  const [cardPosition, setCardPosition] = useState<TourPosition | null>(null);
  const [compactViewport, setCompactViewport] = useState(false);
  const current = steps[step];

  useEffect(() => {
    const media = window.matchMedia('(max-width: 600px)');
    const update = () => setCompactViewport(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey(userId)) !== 'completed') setOpen(true);
    } catch {
      setOpen(true);
    }
  }, [userId]);

  useEffect(() => {
    const element = dialog.current;
    if (open && element && !element.open) element.showModal();
    return () => {
      if (element?.open) element.close();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const selector = compactViewport && current.tab ? `#dreamy-tab-${current.tab}` : current.target;
    const target =
      document.querySelector<HTMLElement>(selector) ??
      (current.tab ? document.getElementById(`dreamy-tab-${current.tab}`) : null);
    if (!target) {
      setTargetRect(null);
      setCardPosition(null);
      return;
    }

    target.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
    target.classList.add('my-dreamy-tour-highlight');

    const updatePosition = () => {
      const targetBox = target.getBoundingClientRect();
      const nextRect = {
        top: Math.round(targetBox.top),
        right: Math.round(targetBox.right),
        bottom: Math.round(targetBox.bottom),
        left: Math.round(targetBox.left),
      };
      setTargetRect((previous) => (sameRect(previous, nextRect) ? previous : nextRect));

      const cardBox = card.current?.getBoundingClientRect();
      if (!cardBox) return;
      const margin = 14;
      const gap = 14;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const left = Math.min(
        Math.max(targetBox.left + targetBox.width / 2 - cardBox.width / 2, margin),
        viewportWidth - cardBox.width - margin,
      );
      const below = targetBox.bottom + gap;
      const above = targetBox.top - cardBox.height - gap;
      const top =
        compactViewport
          ? above >= 64
            ? above
            : Math.min(Math.max(below, 64), viewportHeight - cardBox.height - margin)
          : below + cardBox.height <= viewportHeight - margin
            ? below
            : above >= margin
              ? above
              : Math.min(Math.max(below, margin), viewportHeight - cardBox.height - margin);
      const nextPosition = { top: Math.round(top), left: Math.round(left) };
      setCardPosition((previous) =>
        samePosition(previous, nextPosition) ? previous : nextPosition,
      );
    };

    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updatePosition);
    resizeObserver?.observe(target);
    if (card.current) resizeObserver?.observe(card.current);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    const frame = window.requestAnimationFrame(updatePosition);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      resizeObserver?.disconnect();
      target.classList.remove('my-dreamy-tour-highlight');
    };
  }, [compactViewport, current.tab, current.target, open, step]);

  function finish() {
    try {
      localStorage.setItem(storageKey(userId), 'completed');
    } catch {
      // The tour remains dismissed for this page session.
    }
    setOpen(false);
  }

  function goTo(next: number) {
    setStep(next);
    const tab = steps[next]?.tab;
    if (tab) onSelectTab(tab);
  }

  if (!current) return null;

  const viewportWidth = typeof window === 'undefined' ? 0 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 0 : window.innerHeight;
  const spotlight = targetRect
    ? {
        top: Math.max(0, targetRect.top - 10),
        right: Math.min(viewportWidth, targetRect.right + 10),
        bottom: Math.min(viewportHeight, targetRect.bottom + 10),
        left: Math.max(0, targetRect.left - 10),
      }
    : null;

  return (
    <dialog
      ref={dialog}
      className="my-dreamy-tour-dialog"
      aria-labelledby="my-dreamy-tour-title"
      aria-describedby="my-dreamy-tour-description"
      onCancel={(event) => {
        event.preventDefault();
        finish();
      }}
    >
      <div className="my-dreamy-tour-shades" aria-hidden="true">
        {spotlight ? (
          <>
            <span className="my-dreamy-tour-shade" style={{ top: 0, left: 0, right: 0, height: spotlight.top }} />
            <span
              className="my-dreamy-tour-shade"
              style={{ top: spotlight.bottom, left: 0, right: 0, bottom: 0 }}
            />
            <span
              className="my-dreamy-tour-shade"
              style={{ top: spotlight.top, left: 0, width: spotlight.left, bottom: viewportHeight - spotlight.bottom }}
            />
            <span
              className="my-dreamy-tour-shade"
              style={{ top: spotlight.top, left: spotlight.right, right: 0, bottom: viewportHeight - spotlight.bottom }}
            />
          </>
        ) : (
          <span className="my-dreamy-tour-shade my-dreamy-tour-shade-full" />
        )}
      </div>
      <div
        ref={card}
        className={`my-dreamy-tour-card${cardPosition ? ' my-dreamy-tour-card-positioned' : ''}`}
        style={cardPosition ? { top: cardPosition.top, left: cardPosition.left } : undefined}
      >
        <p className="my-dreamy-tour-step" aria-live="polite">
          {t('tour.step', { current: step + 1, total: steps.length })}
        </p>
        <h2 id="my-dreamy-tour-title">{t(current.titleKey)}</h2>
        <p className="my-dreamy-tour-description" id="my-dreamy-tour-description">
          {t(current.descriptionKey)}
        </p>
        <div className="my-dreamy-tour-progress" aria-hidden="true">
          {steps.map((item, index) => (
            <span key={item.descriptionKey} className={index <= step ? 'active' : ''} />
          ))}
        </div>
        <footer className="my-dreamy-tour-actions">
          <button className="my-dreamy-tour-skip" type="button" onClick={finish}>
            {t('tour.skip')}
          </button>
          <div>
            {step > 0 && (
              <button className="button secondary compact" type="button" onClick={() => goTo(step - 1)}>
                {t('tour.back')}
              </button>
            )}
            {step < steps.length - 1 ? (
              <button className="button dark compact" type="button" onClick={() => goTo(step + 1)}>
                {t('tour.next')}
              </button>
            ) : (
              <button className="button dark compact" type="button" onClick={finish}>
                {t('tour.finish')}
              </button>
            )}
          </div>
        </footer>
      </div>
    </dialog>
  );
}
