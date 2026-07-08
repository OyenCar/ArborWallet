"use client";

import { useEffect, useRef } from "react";
import { useCurrency } from "@/lib/currency";
import { weiToEth } from "@/lib/format";
import { countUp } from "@/lib/motion";

// Currency amount that count-ups on mount and re-tweens when the
// fiat/ETH toggle flips — motion communicates the unit change.
export function AnimatedAmount({
  wei,
  className = "",
}: {
  wei: string;
  className?: string;
}) {
  const { currency, ethUsd } = useCurrency();
  const el = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);

  const eth = weiToEth(wei);
  const target = currency === "USD" ? eth * ethUsd : eth;

  useEffect(() => {
    const format = (v: number) =>
      currency === "USD"
        ? v.toLocaleString("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 2,
          })
        : `${v.toLocaleString("en-US", { maximumFractionDigits: 4 })} ETH`;

    const cancel = countUp(prev.current, target, (v) => {
      if (el.current) el.current.textContent = format(v);
    });
    prev.current = target;
    return cancel;
  }, [target, currency]);

  return <span ref={el} className={`tabular-nums ${className}`} />;
}
