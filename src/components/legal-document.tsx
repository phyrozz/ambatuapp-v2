'use client';

import { useI18n } from './i18n-provider';

type DocumentKind = 'privacy' | 'terms';

const sections: Record<DocumentKind, string[]> = {
  privacy: ['signIn', 'profile', 'visibility', 'local', 'providers', 'ads', 'retention', 'choices', 'changes'],
  terms: ['accounts', 'conduct', 'content', 'moderation', 'thirdParty', 'availability', 'law', 'changes'],
};

export function LegalDocument({ kind }: { kind: DocumentKind }) {
  const { t } = useI18n();
  const operator = t('legal.operatorName');
  const email = t('legal.contactEmail');

  return (
    <div className="page legal-page">
      <header className="page-heading legal-heading">
        <p className="eyebrow">{t('legal.eyebrow')}</p>
        <h1>{t(`${kind}.title`)}</h1>
        <p>{t(`${kind}.intro`, { operator })}</p>
        <small>{t('legal.effectiveDate')}</small>
      </header>
      <div className="legal-content">
        {sections[kind].map((section) => (
          <section key={section} className="legal-section">
            <h2>{t(`${kind}.${section}Title`)}</h2>
            <p>{t(`${kind}.${section}Body`)}</p>
          </section>
        ))}
        <section className="legal-section legal-contact">
          <h2>{t('legal.contactTitle')}</h2>
          <p>{t('legal.operatorLabel')}: {operator}</p>
          <p>{t('legal.emailLabel')}: <a href={`mailto:${email}`}>{email}</a></p>
        </section>
      </div>
    </div>
  );
}
