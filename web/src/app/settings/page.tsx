"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/app/context/UserContext";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getArbitrumSepoliaBalance, formatEth } from "@/lib/format";

export default function Settings() {
  const { user, usingFirebase } = useUser();
  const [revealKey, setRevealKey] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [balance, setBalance] = useState<string>("0");

  useEffect(() => {
    if (!user) return;
    const address = user.address;
    let active = true;
    async function fetchBalance() {
      const bal = await getArbitrumSepoliaBalance(address);
      if (active) setBalance(bal);
    }
    fetchBalance();
    const interval = setInterval(fetchBalance, 10000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [user]);

  if (!user) return null;

  // For mock mode, show a simulated private key.
  const mockPrivateKey = "0x4c55c3c2e1f2b3a4f5c6d7e8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8";

  function copyToClipboard(text: string, setCopied: (v: boolean) => void) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-5xl font-extrabold tracking-tight">Settings</h1>
        <p className="mt-2 text-muted">
          Manage your credentials, wallet details, and connection states.
        </p>
      </div>

      <Card className="p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-1">Wallet Configuration</h2>
          <p className="text-sm text-muted">
            Details of your deterministic embedded signer running on {usingFirebase ? "Arbitrum Sepolia (Testnet)" : "Demo / Mock Mode"}.
          </p>
        </div>

        {/* Public Address */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-muted">
            Public Ethereum Address
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={user.address}
              className="flex-1 border-2 border-line bg-bg px-4 py-2.5 font-mono text-sm focus:outline-none"
            />
            <Button
              variant="secondary"
              onClick={() => copyToClipboard(user.address, setCopiedAddress)}
            >
              {copiedAddress ? "Copied!" : "Copy"}
            </Button>
          </div>
        </div>

        {/* Real-time Balance */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-muted">
            Testnet Wallet Balance
          </label>
          <div className="flex gap-2 items-center">
            <input
              type="text"
              readOnly
              value={usingFirebase ? formatEth(balance) : "150.7345 ETH"}
              className="flex-1 border-2 border-line bg-bg px-4 py-2.5 font-mono text-sm focus:outline-none font-bold"
            />
            {usingFirebase && (
              <a
                href="https://faucet.quicknode.com/drip"
                target="_blank"
                rel="noreferrer"
                className="border-2 border-line bg-accent px-4 py-2.5 text-xs font-bold uppercase shadow-hard-sm hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-shift whitespace-nowrap"
              >
                ⛽ Get Faucet
              </a>
            )}
          </div>
        </div>

        {/* Private Key */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-muted">
            Private Key
          </label>
          {usingFirebase ? (
            <div className="border-2 border-line bg-bg p-4 space-y-3">
              <div className="flex items-center gap-2 text-warning font-semibold text-sm">
                <span className="w-2.5 h-2.5 bg-warning border border-line rounded-full inline-block"></span>
                TEE Enclave Secured (Non-Custodial)
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Your private key is securely generated and isolated inside a **Trusted Execution Environment (TEE)** enclave. By security design, the raw private key cannot be read programmatically or exposed to the client interface to prevent credential leakage.
              </p>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setRevealKey(!revealKey)}
                  className="text-xs font-bold underline text-accent-text hover:text-ink cursor-pointer"
                >
                  {revealKey ? "Hide details" : "Learn more about TEE Key Isolation"}
                </button>
              </div>
              {revealKey && (
                <div className="bg-surface border border-line/20 p-3 mt-2 text-xs text-muted leading-relaxed space-y-2">
                  <p>
                    <strong>How it works:</strong> When you authenticate via Google, GitHub, or Email/Password, your Firebase ID token (JWT) is sent to the Magic TEE server. The TEE enclave verifies the signature of the token and securely performs key operations internally (like transaction signing).
                  </p>
                  <p>
                    The private key is never written to disk or exposed to developers, ensuring complete control resides strictly with your social identity provider credentials.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type={revealKey ? "text" : "password"}
                  readOnly
                  value={mockPrivateKey}
                  className="flex-1 border-2 border-line bg-bg px-4 py-2.5 font-mono text-sm focus:outline-none"
                />
                <Button
                  variant="secondary"
                  onClick={() => setRevealKey(!revealKey)}
                >
                  {revealKey ? "Hide" : "Reveal"}
                </Button>
                {revealKey && (
                  <Button
                    variant="secondary"
                    onClick={() => copyToClipboard(mockPrivateKey, setCopiedKey)}
                  >
                    {copiedKey ? "Copied!" : "Copy"}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted">
                Demo mode only. Never share your private keys or expose them in production.
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
