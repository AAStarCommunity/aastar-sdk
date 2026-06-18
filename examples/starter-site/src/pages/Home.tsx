import React from 'react';
import { useNavigate } from 'react-router-dom';
import { brand } from '../config';
import { useAAStar } from '../lib/AAStarProvider';
import { primaryButton } from '../components/ui';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { session } = useAAStar();

  return (
    <div style={{ textAlign: 'center', padding: '40px 0' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>{brand.logoEmoji}</div>
      <h1 style={{ fontSize: 36, margin: '0 0 12px' }}>{brand.copy.heroTitle}</h1>
      <p style={{ fontSize: 18, color: brand.colors.muted, maxWidth: 560, margin: '0 auto 28px' }}>
        {brand.copy.heroSubtitle}
      </p>
      <button
        style={{ ...primaryButton, width: 'auto', padding: '12px 28px' }}
        onClick={() => navigate(session ? '/dashboard' : '/login')}
      >
        {session ? 'Open dashboard' : brand.copy.ctaPrimary}
      </button>
    </div>
  );
};
