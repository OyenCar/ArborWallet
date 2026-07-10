// src/app/context/UserContext.tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { magicEnabled, useMagic } from "./MagicProvider";
import { mockUsers } from "@/lib/mock/data";
import type { Role, User } from "@/lib/types";

interface UserContextType {
  user: User | null;
  loading: boolean;
  usingMagic: boolean;
  /** Magic: opens the built-in Login UI. Mock: pass a socialId to impersonate. */
  login: (mockSocialId?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const UserContext = createContext<UserContextType | null>(null);
const SS_KEY = "arbor.session"; // mock-mode persistence only

// Resolve a Magic email/address to an app User via the backend directory,
// falling back to the seeded mock directory (SPEC Social ID ↔ address flow).
async function resolveUser(
  email: string,
  address: `0x${string}`,
  didToken: string,
): Promise<User> {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${didToken}`,
      },
      body: JSON.stringify({ email, address }),
    });
    if (res.ok) return (await res.json()) as User;
  } catch {
    /* fall through */
  }
  const seeded = mockUsers.find(
    (u) => u.address.toLowerCase() === address.toLowerCase(),
  );
  return {
    socialId: seeded?.socialId ?? `@${email.split("@")[0] || "user"}`,
    address,
    role: seeded?.role ?? "employee",
  };
}

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const { magic, web3 } = useMagic();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // read the wallet address from Web3 (guide pattern), then resolve to an
  // app User carrying Social ID + role.
  const hydrateFromMagic = useCallback(async (): Promise<User | null> => {
    if (!magic || !web3) return null;
    const info = await magic.user.getInfo();
    const token = await magic.user.getIdToken();
    const accounts = await web3.eth.getAccounts();
    const address = (accounts?.[0] ?? "0x") as `0x${string}`;
    return resolveUser(info.email ?? "", address, token);
  }, [magic, web3]);

  // rehydrate an existing session on mount / when Magic becomes ready
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (magicEnabled) {
        if (!magic || !web3) return; // wait for MagicProvider to init
        try {
          if (await magic.user.isLoggedIn()) {
            const u = await hydrateFromMagic();
            if (u && !cancelled) setUser(u);
          }
        } catch {
          /* not logged in */
        }
        if (!cancelled) setLoading(false);
      } else {
        const raw = sessionStorage.getItem(SS_KEY);
        if (raw && !cancelled) setUser(JSON.parse(raw) as User);
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [magic, web3, hydrateFromMagic]);

  const login = useCallback(
    async (mockSocialId?: string) => {
      setLoading(true);
      try {
        if (magicEnabled) {
          if (!magic) throw new Error("Magic not ready");
          // built-in Magic Login UI — handles email OTP entry itself
          await magic.wallet.connectWithUI();
          const u = await hydrateFromMagic();
          if (u) setUser(u);
        } else {
          const seeded =
            mockUsers.find((u) => u.socialId === mockSocialId) ?? mockUsers[0];
          const u: User = { ...seeded, role: seeded.role as Role };
          sessionStorage.setItem(SS_KEY, JSON.stringify(u));
          setUser(u);
        }
      } finally {
        setLoading(false);
      }
    },
    [magic, hydrateFromMagic],
  );

  const logout = useCallback(async () => {
    if (magicEnabled) {
      try {
        await magic?.user.logout();
      } catch {
        /* ignore */
      }
    } else {
      sessionStorage.removeItem(SS_KEY);
    }
    setUser(null);
  }, [magic]);

  return (
    <UserContext.Provider
      value={{ user, loading, usingMagic: magicEnabled, login, logout }}
    >
      {children}
    </UserContext.Provider>
  );
};

export function useUser(): UserContextType {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser outside UserProvider");
  return ctx;
}
