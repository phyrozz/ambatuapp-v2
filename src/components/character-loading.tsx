export function CharacterLoading({
  label,
  variant,
}: {
  label: string;
  variant: 'grid' | 'detail';
}) {
  if (variant === 'detail') {
    return (
      <div className="character-detail-loading" role="status" aria-label={label}>
        <span className="character-detail-loading-cover" aria-hidden="true" />
        <span className="character-detail-loading-profile" aria-hidden="true">
          <i />
          <span>
            <i />
            <i />
          </span>
        </span>
        <span className="character-detail-loading-copy" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
      </div>
    );
  }

  return (
    <div className="character-loading-grid" role="status" aria-label={label}>
      {Array.from({ length: 8 }, (_, index) => (
        <span className="character-loading-card" key={index} aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      ))}
    </div>
  );
}
