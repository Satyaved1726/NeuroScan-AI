import { createContext, ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AppUser } from '../types';
import { accessTokenIsUsable, clearAuthTokens } from '../services/apiClient';
import {
  fetchCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
} from '../services/authService';

export type User = AppUser;

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string, role?: AppUser['role']) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

let authBootstrapToken: string | null = null;
let authBootstrapPromise: Promise<User | null> | null = null;

function validateStoredAccessToken(token: string): Promise<User | null> {
  if (!accessTokenIsUsable(token)) {
    clearAuthTokens();
    return Promise.resolve(null);
  }

  if (authBootstrapPromise && authBootstrapToken === token) {
    return authBootstrapPromise;
  }

  authBootstrapToken = token;
  authBootstrapPromise = fetchCurrentUser().catch(() => {
    clearAuthTokens();
    return null;
  });

  return authBootstrapPromise;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is logged in on mount
  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('neuroscan_access_token');
        if (token) {
          const userData = await validateStoredAccessToken(token);
          if (isMounted) {
            setUser(userData);
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    checkAuth();

    const handleAuthExpired = () => {
      setUser(null);
      setIsLoading(false);
      navigate('/login', { replace: true });
    };

    window.addEventListener('neuroscan:auth-expired', handleAuthExpired as EventListener);

    return () => {
      isMounted = false;
      window.removeEventListener('neuroscan:auth-expired', handleAuthExpired as EventListener);
    };
  }, [navigate]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { user: userData } = await loginRequest({ email, password });
      setUser(userData);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string, fullName: string, role: AppUser['role'] = 'User') => {
    setIsLoading(true);
    try {
      const { user: userData } = await registerRequest({ email, password, full_name: fullName, role });
      setUser(userData);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await logoutRequest();
    setUser(null);
    navigate('/login', { replace: true });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
