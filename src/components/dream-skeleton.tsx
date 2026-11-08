'use client';

import { useI18n } from './i18n-provider';

function DreamCardSkeleton() {
  return (
    <div className="dream-skeleton-card">
      <div className="dream-skeleton-header">
        <span className="dream-skeleton-shape dream-skeleton-avatar" />
        <span className="dream-skeleton-header-lines">
          <span className="dream-skeleton-shape dream-skeleton-name" />
          <span className="dream-skeleton-shape dream-skeleton-date" />
        </span>
      </div>
      <span className="dream-skeleton-shape dream-skeleton-audience" />
      <span className="dream-skeleton-shape dream-skeleton-line" />
      <span className="dream-skeleton-shape dream-skeleton-line short" />
      <span className="dream-skeleton-shape dream-skeleton-media" />
      <div className="dream-skeleton-actions">
        <span className="dream-skeleton-shape" />
        <span className="dream-skeleton-shape" />
        <span className="dream-skeleton-shape" />
      </div>
    </div>
  );
}

export function DreamSkeleton({ variant }: { variant: 'page' | 'post' | 'feed' | 'editor' }) {
  const { t } = useI18n();
  return (
    <div className={`dream-skeleton dream-skeleton-${variant}`} role="status">
      <span className="sr-only">{t('common.loading')}</span>
      <div aria-hidden="true">
        {variant === 'page' && (
          <>
            <div className="dream-skeleton-composer">
              <span className="dream-skeleton-shape dream-skeleton-avatar" />
              <span className="dream-skeleton-shape dream-skeleton-prompt" />
            </div>
            <span className="dream-skeleton-shape dream-skeleton-title" />
          </>
        )}
        {variant === 'editor' ? (
          <div className="dream-skeleton-editor-form">
            <span className="dream-skeleton-shape dream-skeleton-editor" />
            <span className="dream-skeleton-shape dream-skeleton-editor-count" />
            <div className="dream-skeleton-editor-attachments">
              <span className="dream-skeleton-shape dream-skeleton-add-media" />
              <span className="dream-skeleton-shape dream-skeleton-attachment-thumb" />
              <span className="dream-skeleton-shape dream-skeleton-attachment-thumb" />
            </div>
            <span className="dream-skeleton-shape dream-skeleton-editor-label" />
            <span className="dream-skeleton-shape dream-skeleton-editor-select" />
            <div className="dream-skeleton-editor-actions">
              <span className="dream-skeleton-shape" />
              <span className="dream-skeleton-shape" />
              <span className="dream-skeleton-shape" />
            </div>
          </div>
        ) : (
          <DreamCardSkeleton />
        )}
      </div>
    </div>
  );
}
