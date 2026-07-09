import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import type { AuthContext } from "@/lib/auth";

interface AuthState extends AuthContext {
  token: string;
}

interface AuthContextType {
  auth: AuthState | null;
  isLoading: boolean;
  login: (token: string) => Promise<void>;
  linkSocialId: (socialId: string, address: string) => Promise<void>;
  logout: () => void;
}

const AuthCtx = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(async (token: string) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!res.ok) {
        throw new Error("Login failed");
      }

      const data = await res.json();

      // Store auth state
      setAuth({
        token,
        userId: BigInt(data.userId),
        socialId: data.socialId,
        magicIssuer: data.magicIssuer,
        address: "",
      });

      // Store token in localStorage for persistence
      localStorage.setItem("auth_token", token);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const linkSocialId = useCallback(
    async (socialId: string, address: string) => {
      if (!auth) {
        throw new Error("Not authenticated");
      }

      setIsLoading(true);
      try {
        const res = await fetch("/api/auth/link-social", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${auth.token}`,
          },
          body: JSON.stringify({ socialId, address }),
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || "Failed to link social ID");
        }

        // Update auth state with social ID
        setAuth((prev) =>
          prev ? { ...prev, socialId } : null
        );
      } finally {
        setIsLoading(false);
      }
    },
    [auth]
  );

  const logout = useCallback(() => {
    setAuth(null);
    localStorage.removeItem("auth_token");
  }, []);

  return (
    <AuthCtx.Provider value={{ auth, isLoading, login, linkSocialId, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
