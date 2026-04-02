import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useHistory } from "react-router-dom";
import { registerFcmToken } from "../services/fcm";

interface AuthContextType {
  token: string | null;
  setToken: (token: string | null) => void;
  isAuthenticated: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [token, setTokenState] = useState<string | null>(null);
  const history = useHistory();

  useEffect(() => {
    setTokenState(localStorage.getItem('token'));
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      setTokenState(null);
      history.replace('/login');
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized as EventListener);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized as EventListener);
    };
  }, [history]);

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
      // Registrar token FCM cuando el usuario inicia sesión
      registerFcmToken();
    } else {
      localStorage.removeItem('token');
    }
  }, [token]);

  const setToken = (t: string | null) => {
    setTokenState(t);
  };

  const logout = () => {
    setTokenState(null);
    localStorage.removeItem('token');
    history.replace("/login");
  };

  return (
    <AuthContext.Provider value={{ token, setToken, isAuthenticated: !!token, logout }}>
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
