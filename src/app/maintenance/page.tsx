'use client';

import { useI18n } from '@/components/i18n-provider';
import './maintenance.css';

export default function MaintenancePage() {
  const { t } = useI18n();

  return (
    <div className="page maintenance-page">
      <section className="maintenance-card">
        <div className="maintenance-photo">
          <img src="/assets/dreamy_smiling.jpg" alt="" />
        </div>
        <div className="maintenance-copy">
          <h1>{t('maintenance.title')}</h1>
          <p className="maintenance-description">{t('maintenance.description')}</p>
        </div>
      </section>
    </div>
  );
}
