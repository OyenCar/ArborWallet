"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  type User as FirebaseUser,
} from "firebase/auth";
import { auth, firebaseEnabled } from "@/lib/firebase";

interface FirebaseAuthContextType {
  /** The currently signed-in Firebase user (null if logged out) */
  firebaseUser: FirebaseUser | null;
  /** True while the initial auth state is being determined */
  firebaseLoading: boolean;
  /** Whether Firebase Auth is configured (env vars present) */
  firebaseReady: boolean;
  /** Sign in with email + password */
  signIn: (email: string, password: string) => Promise<FirebaseUser>;
  /** Create a new account with email + password */
  signUp: (email: string, password: string) => Promise<FirebaseUser>;
  /** Sign in with Google provider */
  signInWithGoogle: () => Promise<FirebaseUser>;
  /** Sign out the current Firebase user */
  signOut: () => Promise<void>;
  /** Get the current user's Firebase ID Token (JWT) for backend calls */
  getIdToken: () => Promise<string | null>;
}

const FirebaseAuthContext = createContext<FirebaseAuthContextType>({
  firebaseUser: null,
  firebaseLoading: true,
  firebaseReady: false,
  signIn: () => Promise.reject(new Error("FirebaseProvider not mounted")),
  signUp: () => Promise.reject(new Error("FirebaseProvider not mounted")),
  signInWithGoogle: () => Promise.reject(new Error("FirebaseProvider not mounted")),
  signOut: () => Promise.reject(new Error("FirebaseProvider not mounted")),
  getIdToken: () => Promise.resolve(null),
});

export const useFirebaseAuth = () => useContext(FirebaseAuthContext);

export function FirebaseProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [firebaseLoading, setFirebaseLoading] = useState(true);

  // Subscribe to Firebase auth state changes
  useEffect(() => {
    if (!firebaseEnabled) {
      setFirebaseLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setFirebaseLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = useCallback(
    async (email: string, password: string): Promise<FirebaseUser> => {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      return cred.user;
    },
    [],
  );

  const signUp = useCallback(
    async (email: string, password: string): Promise<FirebaseUser> => {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      return cred.user;
    },
    [],
  );

  const signInWithGoogle = useCallback(async (): Promise<FirebaseUser> => {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    return cred.user;
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  const getIdToken = useCallback(async (): Promise<string | null> => {
    if (!firebaseUser) return null;
    return firebaseUser.getIdToken();
  }, [firebaseUser]);

  return (
    <FirebaseAuthContext.Provider
      value={{
        firebaseUser,
        firebaseLoading,
        firebaseReady: firebaseEnabled,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        getIdToken,
      }}
    >
      {children}
    </FirebaseAuthContext.Provider>
  );
}
