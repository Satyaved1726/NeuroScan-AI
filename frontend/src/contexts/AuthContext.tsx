import { createContext, ReactNode, useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AppUser } from '../types';
import { accessTokenIsUsable, clearAuthTokens } from '../services/apiClient';
import {
  fetchCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
} from '../services/authService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Session, User as SupabaseAuthUser } from '@supabase/supabase-js';

export type User = AppUser;

interface AuthContextType {
  user: User | null;
  supabaseUser: SupabaseAuthUser | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<{ needsEmailVerification: boolean }>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapSupabaseUserToAppUser(sbUser: SupabaseAuthUser, profileOverride?: Partial<AppUser>): AppUser {
  const metadata = sbUser.user_metadata || {};
  return {
    id: sbUser.id,
    name: profileOverride?.name || metadata.full_name || sbUser.email?.split('@')[0] || 'User',
    email: sbUser.email || '',
    role: profileOverride?.role || (metadata.role as AppUser['role']) || 'User',
    joinDate: profileOverride?.joinDate || sbUser.created_at || new Date().toISOString(),
    totalScans: profileOverride?.totalScans || 0,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseAuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isResolvingRef = useRef(false);

  // Synchronize authoritative user profile from backend
  const syncProfile = useCallback(async (currentSbUser: SupabaseAuthUser): Promise<User> => {
    try {
      const backendUser = await fetchCurrentUser();
      // Enforce the backend's authoritative role and profile
      return {
        ...backendUser,
        id: currentSbUser.id,
        email: currentSbUser.email || backendUser.email,
      };
    } catch {
      // Backend may still be using legacy token verification or sleeping
      return mapSupabaseUserToAppUser(currentSbUser);
    }
  }, []);

  // Initialize session and subscribe to Supabase auth state changes
  useEffect(() => {
    let isMounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    async function initAuth() {
      try {
        if (isSupabaseConfigured) {
          const { data: { session: initialSession }, error } = await supabase.auth.getSession();
          if (error) {
            console.error('[NeuroScan Auth] Failed to get session:', error.message);
          }

          if (initialSession?.user && isMounted) {
            setSession(initialSession);
            setSupabaseUser(initialSession.user);
            const appUser = await syncProfile(initialSession.user);
            if (isMounted) {
              setUser(appUser);
            }
          }
        }

        // If no active Supabase session was found, attempt legacy token restoration
        const token = localStorage.getItem('neuroscan_access_token');
        if (token && accessTokenIsUsable(token) && isMounted) {
          try {
            const legacyUser = await fetchCurrentUser();
            if (isMounted) {
              setUser(legacyUser);
            }
          } catch {
            clearAuthTokens();
          }
        }
      } catch (err) {
        console.error('[NeuroScan Auth] Unexpected session restoration error:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initAuth();

    if (isSupabaseConfigured) {
      // Listen to Supabase auth events (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED, PASSWORD_RECOVERY)
      const { data } = supabase.auth.onAuthStateChange(
        async (event, newSession) => {
          if (!isMounted) return;

          setSession(newSession);
          setSupabaseUser(newSession?.user ?? null);

          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
            if (newSession?.user && !isResolvingRef.current) {
              isResolvingRef.current = true;
              try {
                const appUser = await syncProfile(newSession.user);
                if (isMounted) {
                  setUser(appUser);
                }
              } finally {
                isResolvingRef.current = false;
              }
            }
            if (isMounted) setIsLoading(false);
          } else if (event === 'SIGNED_OUT') {
            clearAuthTokens();
            if (isMounted) {
              setUser(null);
              setSupabaseUser(null);
              setSession(null);
              setIsLoading(false);
            }
          } else if (event === 'PASSWORD_RECOVERY') {
            navigate('/reset-password');
          }
        }
      );
      subscription = data.subscription;
    }

    const handleAuthExpired = () => {
      logout();
    };

    window.addEventListener('neuroscan:auth-expired', handleAuthExpired as EventListener);

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
      window.removeEventListener('neuroscan:auth-expired', handleAuthExpired as EventListener);
    };
  }, [syncProfile, navigate]);

  const refreshProfile = useCallback(async () => {
    if (supabaseUser) {
      const refreshed = await syncProfile(supabaseUser);
      setUser(refreshed);
    }
  }, [supabaseUser, syncProfile]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          throw error;
        }

        if (data.user) {
          setSupabaseUser(data.user);
          setSession(data.session);
          const resolvedUser = await syncProfile(data.user);
          setUser(resolvedUser);
        }
      } else {
        const { user: userData } = await loginRequest({ email, password });
        setUser(userData);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string, fullName: string) => {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured) {
        const redirectOrigin = typeof window !== 'undefined' ? window.location.origin : '';
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              role: 'User', // Public registration strictly assigns 'User'
            },
            emailRedirectTo: `${redirectOrigin}/login`,
          },
        });

        if (error) {
          throw error;
        }

        const needsVerification = !data.session;
        if (data.user) {
          setSupabaseUser(data.user);
          setSession(data.session);
          if (data.session) {
            const resolvedUser = await syncProfile(data.user);
            setUser(resolvedUser);
          }
        }
        return { needsEmailVerification: needsVerification };
      } else {
        const { user: userData } = await registerRequest({
          email,
          password,
          full_name: fullName,
          role: 'User',
        });
        setUser(userData);
        return { needsEmailVerification: false };
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured) {
        await supabase.auth.signOut();
      } else {
        await logoutRequest();
      }
    } catch (err) {
      console.warn('[NeuroScan Auth] Supabase signOut warning:', err);
    } finally {
      clearAuthTokens();
      setUser(null);
      setSupabaseUser(null);
      setSession(null);
      setIsLoading(false);
      navigate('/login', { replace: true });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        supabaseUser,
        session,
        isAuthenticated: !!user && (isSupabaseConfigured ? !!session : true),
        isLoading,
        login,
        register,
        logout,
        setUser,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
