import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { brand } from '../config';
import { useAAStar } from '../lib/AAStarProvider';

const { colors } = brand;

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, logout } = useAAStar();
  const loc = useLocation();

  return (
    <div style={{ minHeight: '100vh', background: colors.bg, color: colors.text, fontFamily: 'system-ui, sans-serif' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 24px',
          background: colors.surface,
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <Link to="/" style={{ textDecoration: 'none', color: colors.text, fontWeight: 700, fontSize: 18 }}>
          <span style={{ marginRight: 8 }}>{brand.logoEmoji}</span>
          {brand.name}
        </Link>
        <nav style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <Link to="/" style={navStyle(loc.pathname === '/')}>Home</Link>
          {session ? (
            <>
              <Link to="/dashboard" style={navStyle(loc.pathname === '/dashboard')}>Dashboard</Link>
              <button onClick={logout} style={ghostBtn}>Sign out</button>
            </>
          ) : (
            <Link to="/login" style={navStyle(loc.pathname === '/login')}>Sign in</Link>
          )}
        </nav>
      </header>
      <main style={{ maxWidth: 880, margin: '0 auto', padding: '40px 24px' }}>{children}</main>
      <footer style={{ textAlign: 'center', padding: 24, color: colors.muted, fontSize: 13 }}>
        {brand.name} · {brand.tagline}
      </footer>
    </div>
  );
};

function navStyle(active: boolean): React.CSSProperties {
  return {
    textDecoration: 'none',
    color: active ? colors.primary : colors.muted,
    fontWeight: active ? 600 : 500,
    fontSize: 14,
  };
}

const ghostBtn: React.CSSProperties = {
  background: 'transparent',
  border: `1px solid ${colors.border}`,
  borderRadius: 8,
  padding: '6px 12px',
  cursor: 'pointer',
  color: colors.muted,
  fontSize: 14,
};
