import React, { createContext, useContext, useState } from 'react';

export interface User {
  username: string;
  email: string;
  avatar_url: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (user: User, token?: string) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('quant_token'));
  const [user, setUser] = useState<User | null>(() => {
    const storedUser = localStorage.getItem('quant_user');
    if (storedUser) {
      try {
        return JSON.parse(storedUser);
      } catch (e) {
        console.error('Failed to parse user', e);
      }
    }
    return null;
  });

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('quant_token', newToken);
    localStorage.setItem('quant_user', JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('quant_token');
    localStorage.removeItem('quant_user');
  };

  const updateUser = (newUser: User, newToken?: string) => {
    setUser(newUser);
    localStorage.setItem('quant_user', JSON.stringify(newUser));
    if (newToken) {
      setToken(newToken);
      localStorage.setItem('quant_token', newToken);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
