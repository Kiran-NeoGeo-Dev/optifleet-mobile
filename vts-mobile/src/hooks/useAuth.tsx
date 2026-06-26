import { createContext, useContext, useState, ReactNode } from "react";
import { setAuthToken } from "../services/api";

interface AuthContextValue {
  token:    string | null;
  username: string | null;
  clientId: number | null;
  role:     string | null;
  isAdmin:  boolean;
  isClient: boolean;
  login:    (token: string, username: string, clientId: number, role: string) => void;
  logout:   () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token,    setToken]    = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [clientId, setClientId] = useState<number | null>(null);
  const [role,     setRole]     = useState<string | null>(null);

  const login = (newToken: string, name: string, id: number, userRole: string) => {
    setToken(newToken);
    setUsername(name);
    setClientId(id);
    setRole(userRole);
    setAuthToken(newToken);
  };

  const logout = () => {
    setToken(null);
    setUsername(null);
    setClientId(null);
    setRole(null);
    setAuthToken(null);
  };

  const isAdmin  = role?.toLowerCase() === "admin" || role?.toLowerCase() === "superadmin";
  const isClient = role?.toLowerCase() === "client";

  return (
    <AuthContext.Provider value={{
      token, username, clientId, role,
      isAdmin,
      isClient,
      login, logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
