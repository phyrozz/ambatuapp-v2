import './loading-indicator.css';

type LoadingIndicatorProps = {
  label: string;
  compact?: boolean;
  className?: string;
};

export function LoadingIndicator({ label, compact = false, className = '' }: LoadingIndicatorProps) {
  return (
    <span className={`loading-indicator ${compact ? 'loading-indicator-compact' : ''} ${className}`} role="status" aria-live="polite">
      <span className="loading-indicator-mark" aria-hidden="true" />
      <span className="loading-indicator-label">{label}</span>
    </span>
  );
}
