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
import { useFirebaseAuth } from "./FirebaseProvider";
import { mockUsers } from "@/lib/mock/data";
import type { User } from "@/lib/types";

interface UserContextType {
  user: User | null;
  loading: boolean;
  /** True when Firebase Auth is configured and active */
  usingFirebase: boolean;
  /** Firebase sign-in: email + password. Mock: pass socialId. */
  login: (email: string, password: string) => Promise<void>;
  /** Google sign-in: authentication via Google popup. */
  loginWithGoogle: () => Promise<void>;
  /** Firebase sign-up: create account + create wallet. Mock: register dynamically. */
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const UserContext = createContext<UserContextType | null>(null);
const SS_KEY = "arbor.session"; // mock-mode persistence only

// ── Wallet creation via Magic Server Wallet TEE ──────────────────────────────
async function createServerWallet(firebaseIdToken: string): Promise<string> {
  const res = await fetch("/api/wallet/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${firebaseIdToken}`,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body.detail
      ? `Wallet creation failed: ${body.detail}`
      : (body.error ?? "Failed to create wallet");
    throw new Error(message);
  }
  const data = await res.json();
  return data.public_address as string;
}

async function getServerWalletAddress(firebaseIdToken: string): Promise<string | null> {
  const res = await fetch(`/api/wallet/address`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${firebaseIdToken}`,
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return (data.public_address as string) ?? null;
}

// Resolve a Firebase user to an app User with Social ID + role + wallet address.
async function resolveFirebaseUser(
  email: string,
  address: `0x${string}`,
  firebaseIdToken: string,
): Promise<User> {
  // Check backend user directory
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${firebaseIdToken}`,
      },
      body: JSON.stringify({ email, address }),
    });
    if (res.ok) {
      const u = (await res.json()) as User;
      u.role = "employee"; // everyone has the same kasta/role
      return u;
    }
  } catch {
    /* fall through */
  }

  // Fallback: match against seeded mock users by address
  const seeded = mockUsers.find(
    (u) => u.address.toLowerCase() === address.toLowerCase(),
  );
  return {
    socialId: seeded?.socialId ?? `@${email.split("@")[0] || "user"}`,
    address,
    role: "employee",
  };
}

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const {
    firebaseUser,
    firebaseLoading,
    firebaseReady,
    signIn: fbSignIn,
    signUp: fbSignUp,
    signOut: fbSignOut,
    signInWithGoogle,
  } = useFirebaseAuth();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Hydrate from Firebase on mount / auth state change ───────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (firebaseReady) {
        // Wait for Firebase to resolve auth state
        if (firebaseLoading) return;

        if (firebaseUser) {
          try {
            const token = await firebaseUser.getIdToken();
            const email = firebaseUser.email ?? "";

            // Try to get existing wallet, or create one
            let address = await getServerWalletAddress(token);
            if (!address) {
              address = await createServerWallet(token);
            }

            const u = await resolveFirebaseUser(
              email,
              address as `0x${string}`,
              token,
            );
            if (!cancelled) {
              setUser(u);
            }
          } catch {
            /* wallet fetch failed — user is authed but no wallet yet */
            if (!cancelled) setUser(null);
          }
        } else {
          if (!cancelled) setUser(null);
        }
        if (!cancelled) setLoading(false);
      } else {
        // Mock mode — restore from sessionStorage
        const raw = sessionStorage.getItem(SS_KEY);
        if (raw && !cancelled) setUser(JSON.parse(raw) as User);
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [firebaseUser, firebaseLoading, firebaseReady]);

  // ── Login (Firebase email/password or mock socialId) ─────────────────────
  const login = useCallback(
    async (emailOrSocialId: string, password: string) => {
      setLoading(true);
      try {
        if (firebaseReady) {
          // Firebase sign-in → get JWT → resolve wallet
          const fbUser = await fbSignIn(emailOrSocialId, password);
          const token = await fbUser.getIdToken();
          const email = fbUser.email ?? emailOrSocialId;

          let address = await getServerWalletAddress(token);
          if (!address) {
            address = await createServerWallet(token);
          }

          const u = await resolveFirebaseUser(
            email,
            address as `0x${string}`,
            token,
          );
          setUser(u);
        } else {
          // Mock mode
          const customUsersRaw = sessionStorage.getItem("arbor.custom_users");
          const customUsers: User[] = customUsersRaw
            ? JSON.parse(customUsersRaw)
            : [];
          const allUsers = [...mockUsers, ...customUsers];

          const lookupId = emailOrSocialId.startsWith("@")
            ? emailOrSocialId
            : `@${emailOrSocialId}`;

          let seeded = allUsers.find(
            (u) =>
              u.socialId.toLowerCase() === lookupId.toLowerCase() ||
              u.socialId.toLowerCase() === emailOrSocialId.toLowerCase(),
          );

          if (!seeded && emailOrSocialId) {
            const newMockUser: User = {
              socialId: lookupId,
              address: `0x${Array.from({ length: 40 }, () =>
                Math.floor(Math.random() * 16).toString(16),
              ).join("")}` as `0x${string}`,
              role: "employee",
            };
            customUsers.push(newMockUser);
            sessionStorage.setItem(
              "arbor.custom_users",
              JSON.stringify(customUsers),
            );
            seeded = newMockUser;
          }

          const finalUser = seeded ?? mockUsers[0];
          const u: User = {
            ...finalUser,
            role: "employee",
          };

          sessionStorage.setItem(SS_KEY, JSON.stringify(u));
          setUser(u);
        }
      } finally {
        setLoading(false);
      }
    },
    [firebaseReady, fbSignIn],
  );

  // ── Login with Google (Firebase popup or mock simulation) ────────────────
  const loginWithGoogle = useCallback(async () => {
    setLoading(true);
    try {
      if (firebaseReady) {
        const fbUser = await signInWithGoogle();
        const token = await fbUser.getIdToken();
        const email = fbUser.email ?? "google-user@arbor.finance";

        let address = await getServerWalletAddress(token);
        if (!address) {
          address = await createServerWallet(token);
        }

        const u = await resolveFirebaseUser(
          email,
          address as `0x${string}`,
          token,
        );
        setUser(u);
      } else {
        // Mock mode
        const customUsersRaw = sessionStorage.getItem("arbor.custom_users");
        const customUsers: User[] = customUsersRaw
          ? JSON.parse(customUsersRaw)
          : [];
        
        const googleMockUser = {
          socialId: "@google.budi",
          address: "0x1a2B3c4D5e6F7a8B9c0D1e2F3a4B5c6D7e8F9a0B" as `0x${string}`,
          role: "employee" as const,
        };

        if (!customUsers.some(u => u.socialId === googleMockUser.socialId)) {
          customUsers.push(googleMockUser);
          sessionStorage.setItem("arbor.custom_users", JSON.stringify(customUsers));
        }

        sessionStorage.setItem(SS_KEY, JSON.stringify(googleMockUser));
        setUser(googleMockUser);
      }
    } finally {
      setLoading(false);
    }
  }, [firebaseReady, signInWithGoogle]);

  // ── Signup (Firebase create account + wallet, or mock dynamic register) ──
  const signup = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      try {
        if (firebaseReady) {
          // Create Firebase account → get JWT → create Magic Server Wallet
          const fbUser = await fbSignUp(email, password);
          const token = await fbUser.getIdToken();

          const address = await createServerWallet(token);

          const u: User = {
            socialId: `@${email.split("@")[0] || "user"}`,
            address: address as `0x${string}`,
            role: "employee",
          };

          setUser(u);
        } else {
          // Mock mode: create a new user
          await login(email, "");
        }
      } finally {
        setLoading(false);
      }
    },
    [firebaseReady, fbSignUp, login],
  );

  // ── Logout ───────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    if (firebaseReady) {
      try {
        await fbSignOut();
      } catch {
        /* ignore */
      }
      sessionStorage.removeItem(SS_KEY);
    } else {
      sessionStorage.removeItem(SS_KEY);
    }
    setUser(null);
  }, [firebaseReady, fbSignOut]);

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        usingFirebase: firebaseReady,
        login,
        loginWithGoogle,
        signup,
        logout,
      }}
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
