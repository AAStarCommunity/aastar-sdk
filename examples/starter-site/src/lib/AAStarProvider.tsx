import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  type Session,
  registerWithEmail,
  loginWithPasskey,
  restoreSession,
  clearSession,
} from './kms';

interface AAStarContextValue {
  session: Session | null;
  loading: boolean;
  register: (email: string, username: string) => Promise<void>;
  login: (email?: string) => Promise<void>;
  logout: () => void;
}

const AAStarContext = createContext<AAStarContextValue | null>(null);

/**
 * App-wide session context. Wraps the KMS/AirAccount auth so any page can read the
 * current account and trigger register/login/logout.
 */
export const AAStarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSession(restoreSession());
  }, []);

  const register = useCallback(async (email: string, username: string) => {
    setLoading(true);
    try {
      setSession(await registerWithEmail(email, username || email));
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email?: string) => {
    setLoading(true);
    try {
      setSession(await loginWithPasskey(email));
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({ session, loading, register, login, logout }),
    [session, loading, register, login, logout],
  );

  return <AAStarContext.Provider value={value}>{children}</AAStarContext.Provider>;
};

export function useAAStar(): AAStarContextValue {
  const ctx = useContext(AAStarContext);
  if (!ctx) throw new Error('useAAStar must be used within <AAStarProvider>');
  return ctx;
}
