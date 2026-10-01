import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import * as SecureStore from "expo-secure-store";
import { setAuthToken, setUnauthorizedHandler } from "../services/api";

const KEYS = {
  token:    "auth_token",
  username: "auth_username",
  clientId: "auth_clientId",
  role:     "auth_role",
};

interface AuthContextValue {
  token:    string | null;
  username: string | null;
  clientId: number | null;
  role:     string | null;
  isAdmin:  boolean;
  isClient: boolean;
  loading:  boolean;
  login:    (token: string, username: string, clientId: number, role: string) => void;
  logout:   () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token,    setToken]    = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [clientId, setClientId] = useState<number | null>(null);
  const [role,     setRole]     = useState<string | null>(null);
  const [loading,  setLoading]  = useState(true);

  // Restore session on app start
  useEffect(() => {
    (async () => {
      try {
        const [t, u, c, r] = await Promise.all([
          SecureStore.getItemAsync(KEYS.token),
          SecureStore.getItemAsync(KEYS.username),
          SecureStore.getItemAsync(KEYS.clientId),
          SecureStore.getItemAsync(KEYS.role),
        ]);
        if (t && u && c && r) {
          setToken(t);
          setUsername(u);
          setClientId(Number(c));
          setRole(r);
          setAuthToken(t);
        }
      } catch (_) {
        // If secure store fails, start unauthenticated
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = (newToken: string, name: string, id: number, userRole: string) => {
    setToken(newToken);
    setUsername(name);
    setClientId(id);
    setRole(userRole);
    setAuthToken(newToken);
    SecureStore.setItemAsync(KEYS.token,    newToken);
    SecureStore.setItemAsync(KEYS.username, name);
    SecureStore.setItemAsync(KEYS.clientId, String(id));
    SecureStore.setItemAsync(KEYS.role,     userRole);
  };

  const logout = () => {
    setToken(null);
    setUsername(null);
    setClientId(null);
    setRole(null);
    setAuthToken(null);
    SecureStore.deleteItemAsync(KEYS.token);
    SecureStore.deleteItemAsync(KEYS.username);
    SecureStore.deleteItemAsync(KEYS.clientId);
    SecureStore.deleteItemAsync(KEYS.role);
    
    // Clear notification preference on logout so new user sees the prompt
    if (clientId) {
      const notifKey = `notif_preference_${clientId}`;
      SecureStore.deleteItemAsync(notifKey).catch(err => 
        console.error('[Auth] Error clearing notification preference:', err)
      );
    }
  };

  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, []);

  const isAdmin  = role?.toLowerCase() === "admin" || role?.toLowerCase() === "superadmin";
  const isClient = role?.toLowerCase() === "client";

  return (
    <AuthContext.Provider value={{
      token, username, clientId, role,
      isAdmin, isClient, loading,
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
