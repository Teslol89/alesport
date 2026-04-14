import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { useHistory } from "react-router-dom";
import { getUserProfile, type UserProfile } from "../api/user";
import { registerFcmToken } from "../services/fcm";

interface AuthContextType {
  token: string | null;
  user: UserProfile | null;
  role: string | null;
  setToken: (token: string | null) => void;
  isAuthenticated: boolean;
  isLoadingProfile: boolean;
  refreshProfile: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

const readStoredUser = (): UserProfile | null => {
  const raw = localStorage.getItem('userProfile');
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    localStorage.removeItem('userProfile');
    return null;
  }
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const history = useHistory();
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem('token'));
  const [user, setUser] = useState<UserProfile | null>(() => readStoredUser());
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(() => !!localStorage.getItem('token'));

  const clearAuthState = useCallback(() => {
    setTokenState(null);
    setUser(null);
    setIsLoadingProfile(false);
    localStorage.removeItem('token');
    localStorage.removeItem('userProfile');
  }, []);

  const handleUnauthorized = useCallback(() => {
    clearAuthState();
    history.replace('/login');
  }, [clearAuthState, history]);

  const refreshProfile = useCallback(async () => {
    if (!token) {
      setUser(null);
      setIsLoadingProfile(false);
      return;
    }

    setIsLoadingProfile(true);
    try {
      const profile = await getUserProfile(handleUnauthorized);
      setUser(profile);
      localStorage.setItem('userProfile', JSON.stringify(profile));
    } catch (error) {
      if (!(error instanceof Error && error.message === 'UNAUTHORIZED')) {
        console.error('[AuthContext] No se pudo cargar el perfil:', error);
      }
    } finally {
      setIsLoadingProfile(false);
    }
  }, [handleUnauthorized, token]);

  useEffect(() => {
    window.addEventListener('auth:unauthorized', handleUnauthorized as EventListener);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized as EventListener);
    };
  }, [handleUnauthorized]);

  useEffect(() => {
    if (!token) {
      localStorage.removeItem('token');
      localStorage.removeItem('userProfile');
      setUser(null);
      setIsLoadingProfile(false);
      return;
    }

    localStorage.setItem('token', token);
    registerFcmToken();
    void refreshProfile();
  }, [refreshProfile, token]);

  const setToken = useCallback((nextToken: string | null) => {
    if (!nextToken) {
      clearAuthState();
      return;
    }

    setTokenState(nextToken);
    setIsLoadingProfile(true);
  }, [clearAuthState]);

  const logout = useCallback(() => {
    clearAuthState();
    history.replace('/login');
  }, [clearAuthState, history]);

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        role: user?.role || null,
        setToken,
        isAuthenticated: !!token,
        isLoadingProfile,
        refreshProfile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
