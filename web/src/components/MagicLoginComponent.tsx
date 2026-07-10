/**
 * example: Magic Login Component
 * 
 * Usage:
 * 1. Wrap your app with <AuthProvider>
 * 2. Use <MagicLoginComponent> on your login page
 * 3. After login, use useAuth() hook in other components
 */

"use client";

import { useState } from "react";
import { useMagic } from "@/app/context/MagicProvider";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/Button";

export function MagicLoginComponent() {
  const { login, linkSocialId, isLoading, auth } = useAuth();
  const { magic, web3 } = useMagic();
  const [email, setEmail] = useState("");
  const [socialId, setSocialId] = useState("");

  const handleMagicLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!magic) {
      alert("Magic is not available in this environment.");
      return;
    }

    try {
      // Send magic link to user's email
      const response = await magic.auth.loginWithMagicLink({
        email,
      });

      if (response) {
        // Get the ID token
        const token = await magic.user.getIdToken();
        
        if (token) {
          // Send token to backend
          await login(token);
          
        }
      }
    } catch (error) {
      console.error("Magic login failed:", error);
      alert("Login failed. Check console for details.");
    }
  };

  const getWalletAddress = async () => {
    if (!magic) {
      return null;
    }

    const metadata = await magic.user.getInfo();
    if (metadata.publicAddress) {
      return metadata.publicAddress;
    }

    if (web3) {
      const accounts = await web3.eth.getAccounts();
      if (accounts?.length) {
        return accounts[0];
      }
    }

    try {
      await magic.wallet.connectWithUI();
      if (web3) {
        const accounts = await web3.eth.getAccounts();
        return accounts?.[0] ?? null;
      }
    } catch (error) {
      console.error("Wallet connect fallback failed:", error);
    }

    return null;
  };

  const handleSocialLink = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!socialId) {
      alert("Please fill in your Social ID.");
      return;
    }

    if (!magic) {
      alert("Magic SDK is not ready. Refresh the page and try again.");
      return;
    }

    try {
      const publicAddress = await getWalletAddress();

      if (!publicAddress) {
        throw new Error("Unable to read wallet address from Magic");
      }

      await linkSocialId(socialId, publicAddress);
      alert("Social ID linked successfully!");
      setEmail("");
      setSocialId("");
    } catch (error) {
      console.error("Social linking failed:", error);
      alert("Failed to link social ID. Check console for details.");
    }
  };

  if (auth && !auth.socialId) {
    return (
      <div className="max-w-md mx-auto p-6 border rounded">
        <h2 className="text-xl font-bold mb-4">Link Social ID</h2>
        <form onSubmit={handleSocialLink} className="space-y-4">
              <div>
            <label className="block text-sm font-medium mb-2">
              Social ID (e.g., @alice)
            </label>
            <input
              type="text"
              value={socialId}
              onChange={(e) => setSocialId(e.target.value)}
              placeholder="@username"
              className="w-full px-3 py-2 border rounded"
              disabled={isLoading}
              required
            />
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? "Linking..." : "Link Social ID"}
          </Button>
        </form>
      </div>
    );
  }

  if (auth && auth.socialId) {
    return (
      <div className="max-w-md mx-auto p-6 border rounded text-center">
        <h2 className="text-xl font-bold mb-4">Logged In</h2>
        <p className="mb-2">
          Social ID: <strong>{auth.socialId}</strong>
        </p>
        <p className="text-sm text-gray-600">
          Address: {auth.address ? `${auth.address.slice(0, 10)}...` : "Not available"}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 border rounded">
      <h2 className="text-xl font-bold mb-4">Login with Magic</h2>
      <form onSubmit={handleMagicLogin} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-3 py-2 border rounded"
            disabled={isLoading}
            required
          />
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? "Sending Magic Link..." : "Send Magic Link"}
        </Button>
      </form>

      <p className="text-xs text-gray-500 mt-4 text-center">
        Check your email for a login link
      </p>
    </div>
  );
}
