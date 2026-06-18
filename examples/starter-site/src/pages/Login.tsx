import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { brand } from '../config';
import { useAAStar } from '../lib/AAStarProvider';
import { card, input, primaryButton, label } from '../components/ui';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { session, register, login, loading } = useAAStar();
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (session) navigate('/dashboard');
  }, [session, navigate]);

  const submit = async () => {
    setError('');
    try {
      if (mode === 'register') await register(email, username);
      else await login(email);
      navigate('/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '0 auto' }}>
      <div style={card}>
        <h2 style={{ margin: '0 0 4px' }}>{brand.copy.loginTitle}</h2>
        <p style={{ margin: '0 0 20px', color: brand.colors.muted, fontSize: 14 }}>
          {brand.copy.loginSubtitle}
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <Tab active={mode === 'register'} onClick={() => setMode('register')}>Create account</Tab>
          <Tab active={mode === 'login'} onClick={() => setMode('login')}>Sign in</Tab>
        </div>

        <div style={label}>Email</div>
        <input style={input} type="email" value={email} placeholder="you@example.com"
          onChange={(e) => setEmail(e.target.value)} disabled={loading} />

        {mode === 'register' && (
          <>
            <div style={label}>Username (optional)</div>
            <input style={input} type="text" value={username} placeholder="username"
              onChange={(e) => setUsername(e.target.value)} disabled={loading} />
          </>
        )}

        <button style={primaryButton} onClick={submit} disabled={loading || !email}>
          {loading ? 'Working…' : mode === 'register' ? 'Create account' : 'Sign in'}
        </button>

        {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 12 }}>{error}</p>}
      </div>
    </div>
  );
};

const Tab: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({
  active,
  onClick,
  children,
}) => (
  <button
    onClick={onClick}
    style={{
      flex: 1,
      padding: '8px',
      borderRadius: 8,
      border: `1px solid ${active ? brand.colors.primary : brand.colors.border}`,
      background: active ? brand.colors.primary : 'transparent',
      color: active ? brand.colors.primaryText : brand.colors.muted,
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: 600,
    }}
  >
    {children}
  </button>
);
