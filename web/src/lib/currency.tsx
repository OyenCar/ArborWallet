"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { MOCK_ETH_USD } from "./mock/data";
import { formatEth, formatFiat } from "./format";

type Currency = "USD" | "ETH";

interface CurrencyCtx {
  currency: Currency;
  toggle: () => void;
  ethUsd: number;
  fmt: (wei: string) => string;
}

const Ctx = createContext<CurrencyCtx | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<Currency>("USD");

  useEffect(() => {
    const saved = localStorage.getItem("arbor.currency");
    if (saved === "ETH" || saved === "USD") setCurrency(saved);
  }, []);

  const toggle = useCallback(() => {
    setCurrency((c) => {
      const next = c === "USD" ? "ETH" : "USD";
      localStorage.setItem("arbor.currency", next);
      return next;
    });
  }, []);

  const ethUsd = MOCK_ETH_USD; // real impl: backend-cached price feed
  const fmt = useCallback(
    (wei: string) =>
      currency === "USD" ? formatFiat(wei, ethUsd) : formatEth(wei),
    [currency, ethUsd],
  );

  return (
    <Ctx.Provider value={{ currency, toggle, ethUsd, fmt }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCurrency(): CurrencyCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCurrency outside CurrencyProvider");
  return ctx;
}
