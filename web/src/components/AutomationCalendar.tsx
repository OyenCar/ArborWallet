"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { animate, utils } from "animejs";
import { reducedMotion } from "@/lib/motion";
import { mockAutomations, mockPartitions } from "@/lib/mock/data";
import { formatDate, truncAddr } from "@/lib/format";
import { useCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import type { AutomationRule } from "@/lib/types";

const meta: Record<
  AutomationRule["kind"],
  {
    title: string;
    describe: (
      r: AutomationRule,
      fmt: (w: string) => string,
      label: (id: string) => string,
    ) => string;
  }
> =
// dummy for now 
{
  scheduled_release: {
    title: "Scheduled release",
    describe: (r, _fmt, label) =>
      `Releases the full ${label(r.partitionId)} budget to its members. Runs even if no one is online.`,
  },
  low_balance_topup: {
    title: "Low-balance top-up",
    describe: (r, fmt, label) =>
      `When ${label(r.partitionId)} drops below ${fmt(r.config.thresholdWei ?? "0")}, refills ${fmt(r.config.topUpWei ?? "0")} from ${label(r.config.sourcePartitionId ?? "")}.`,
  },
  recurring_payment: {
    title: "Recurring payment",
    describe: (r, fmt) =>
      `Pays ${fmt(r.config.amountWei ?? "0")} to ${r.config.toAddress ? truncAddr(r.config.toAddress) : "vendor"} every ${r.config.intervalDays ?? 30} days.`,
  },
  limit_reset: {
    title: "Spending limit reset",
    describe: (r, _fmt, label) =>
      `Resets every member's spent counter in ${label(r.partitionId)} every ${r.config.intervalDays ?? 30} days.`,
  },
};

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// anime.js count-up on the "days until run" figure — the reveal moment when a
// calendar day is picked (SPEC: anime.js for state-communicating motion).
function DaysUntil({ target }: { target: string }) {
  const el = useRef<HTMLSpanElement>(null);
  const days = Math.max(
    0,
    Math.ceil((new Date(target).getTime() - Date.now()) / 86_400_000),
  );

  useEffect(() => {
    if (!el.current) return;
    const counter = { v: 0 };
    const anim = animate(counter, {
      v: days,
      duration: 450,
      ease: "outQuad",
      modifier: utils.round(0),
      onUpdate: () => {
        if (el.current) el.current.textContent = String(counter.v);
      },
    });
    return () => {
      anim.cancel();
    };
  }, [days]);

  return (
    <p className="font-mono text-sm">
      Runs in{" "}
      <span ref={el} className="text-2xl font-extrabold tabular-nums">
        {days}
      </span>{" "}
      day{days === 1 ? "" : "s"}
    </p>
  );
}

export function AutomationCalendar() {
  const { fmt } = useCurrency();
  const [rules, setRules] = useState<AutomationRule[]>(mockAutomations);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // month navigation away from the selected date → clear pointer + line
  useEffect(() => {
    if (!selectedDay) return;
    const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
    if (!selectedDay.startsWith(monthKey)) setSelectedDay(null);
  }, [month, selectedDay]);

  // connector line: selected day cell → matching schedule card (anime.js-docs
  // style elbow). SVG overlay absolute over the grid; path recomputed on
  // scroll/resize so it stretches while the sticky calendar stays put.
  const wrapRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<SVGPathElement>(null);
  const dayRefs = useRef(new Map<string, HTMLButtonElement>());

  const drawLine = useCallback((animateDraw: boolean) => {
    const wrap = wrapRef.current;
    const path = lineRef.current;
    if (!wrap || !path) return;
    const dayEl = selectedDay ? dayRefs.current.get(selectedDay) : null;
    const cardEl = selectedDay
      ? wrap.querySelector(`[data-day="${selectedDay}"]`)
      : null;
    if (!dayEl || !cardEl) {
      path.setAttribute("d", "");
      return;
    }
    const w = wrap.getBoundingClientRect();
    const d = dayEl.getBoundingClientRect();
    const c = cardEl.getBoundingClientRect();
    let dAttr: string;
    if (c.right <= d.left) {
      // desktop: card left of calendar — horizontal elbow
      const sx = d.left - w.left;
      const sy = d.top - w.top + d.height / 2;
      const ex = c.right - w.left;
      const ey = c.top - w.top + Math.min(c.height / 2, 44);
      const midX = (sx + ex) / 2;
      dAttr = `M ${sx} ${sy} L ${midX} ${sy} L ${midX} ${ey} L ${ex} ${ey}`;
    } else {
      // stacked (mobile/tablet): calendar above — vertical elbow
      const sx = d.left - w.left + d.width / 2;
      const sy = d.bottom - w.top;
      const ex = c.left - w.left + 32;
      const ey = c.top - w.top;
      const midY = (sy + ey) / 2;
      dAttr = `M ${sx} ${sy} L ${sx} ${midY} L ${ex} ${midY} L ${ex} ${ey}`;
    }
    path.setAttribute("d", dAttr);
    if (animateDraw && !reducedMotion()) {
      const len = path.getTotalLength();
      path.style.strokeDasharray = String(len);
      const dash = { v: len };
      animate(dash, {
        v: 0,
        duration: 350,
        ease: "outQuad",
        onUpdate: () => {
          path.style.strokeDashoffset = String(dash.v);
        },
        onComplete: () => {
          path.style.strokeDasharray = "none";
          path.style.strokeDashoffset = "0";
        },
      });
    } else {
      path.style.strokeDasharray = "none";
      path.style.strokeDashoffset = "0";
    }
  }, [selectedDay]);

  useEffect(() => {
    drawLine(true); // draw-in on selection change
    const redraw = () => drawLine(false); // stretch-follow on scroll/resize
    window.addEventListener("scroll", redraw, { passive: true });
    window.addEventListener("resize", redraw);
    return () => {
      window.removeEventListener("scroll", redraw);
      window.removeEventListener("resize", redraw);
    };
  }, [drawLine]);

  const partitionLabel = (id: string) =>
    mockPartitions.find((p) => p.id === id)?.label ?? "budget";

  const toggleRule = (id: string) =>
    setRules((rs) =>
      rs.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
    );

  const scheduled = rules.filter((r) => r.nextRunAt);
  const conditional = rules.filter((r) => !r.nextRunAt);

  const runDays = useMemo(() => {
    const map = new Map<string, AutomationRule[]>();
    for (const r of scheduled) {
      const k = dayKey(new Date(r.nextRunAt!));
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return map;
  }, [scheduled]);

  // calendar grid for displayed month, Monday-first
  const grid = useMemo(() => {
    const first = new Date(month);
    const lead = (first.getDay() + 6) % 7; // Mon=0
    const daysInMonth = new Date(
      month.getFullYear(),
      month.getMonth() + 1,
      0,
    ).getDate();
    const cells: (Date | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= daysInMonth; d++)
      cells.push(new Date(month.getFullYear(), month.getMonth(), d));
    return cells;
  }, [month]);

  // always show every scheduled automation — the calendar only points, never filters
  const agenda = [...scheduled].sort(
    (a, b) => new Date(a.nextRunAt!).getTime() - new Date(b.nextRunAt!).getTime(),
  );

  const ruleCard = (r: AutomationRule) => {
    const m = meta[r.kind];
    const day = r.nextRunAt ? dayKey(new Date(r.nextRunAt)) : undefined;
    const pointed = !!day && day === selectedDay; // line lands here
    const open = expandedId === r.id;
    return (
      <div
        key={r.id}
        data-day={day}
        className={`border-2 bg-surface shadow-hard transition-shift ${
          pointed ? "border-accent" : "border-line"
        } ${r.enabled ? "" : "opacity-60"}`}
      >
        <div className="flex items-start justify-between gap-3 p-4">
          {/* click header → open/close description */}
          <button
            onClick={() => setExpandedId(open ? null : r.id)}
            aria-expanded={open}
            className="flex-1 text-left"
          >
            <p className="font-bold">
              {partitionLabel(r.partitionId)} — {m.title}
            </p>
            <p className="mt-1 font-mono text-xs text-muted">
              {r.nextRunAt
                ? `Next run: ${formatDate(r.nextRunAt)}`
                : "Runs when condition is met"}
              <span className="ml-2 text-accent-text">
                {open ? "− details" : "+ details"}
              </span>
            </p>
          </button>
          <div className="flex shrink-0 items-center gap-2">
            <StatusChip status={r.enabled ? "active" : "paused"} />
            <Button
              className="px-3 py-1.5 text-xs"
              onClick={() => toggleRule(r.id)}
              aria-pressed={r.enabled}
            >
              {r.enabled ? "Pause" : "Resume"}
            </Button>
          </div>
        </div>
        {open && (
          <div className="border-t-2 border-line/20 p-4">
            <p className="text-sm text-muted">
              {m.describe(r, fmt, partitionLabel)}
            </p>
            {r.nextRunAt && (
              <div className="mt-2">
                <DaysUntil target={r.nextRunAt} />
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div ref={wrapRef} className="relative grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      {/* connector: selected date → schedule card */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible"
      >
        <path
          ref={lineRef}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={2.5}
        />
      </svg>
      {/* Agenda — left */}
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted">
              Scheduled runs
            </h3>
            {selectedDay && (
              <button
                onClick={() => setSelectedDay(null)}
                className="text-sm text-accent-text underline underline-offset-4"
              >
                Clear pointer
              </button>
            )}
          </div>
          {agenda.length === 0 ? (
            <p className="border-2 border-dashed border-line p-4 text-sm text-muted">
              No scheduled runs.
            </p>
          ) : (
            <div className="space-y-3">
              {agenda.map((r) => ruleCard(r))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted">
            Condition-triggered
          </h3>
          <div className="space-y-3">{conditional.map((r) => ruleCard(r))}</div>
        </div>
      </div>

      {/* Calendar — right on desktop, top on tablet/mobile */}
      <div className="order-first h-fit border-2 border-line bg-surface p-4 shadow-hard lg:order-none lg:sticky lg:top-6">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-bold">
            {month.toLocaleString("en-US", { month: "long", year: "numeric" })}
          </p>
          <div className="flex gap-1">
            <button
              aria-label="Previous month"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
              }
              className="min-h-11 min-w-11 border-2 border-line font-mono hover:bg-bg"
            >
              ‹
            </button>
            <button
              aria-label="Next month"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
              }
              className="min-h-11 min-w-11 border-2 border-line font-mono hover:bg-bg"
            >
              ›
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 text-center text-xs font-medium text-muted">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <span key={i} className="py-1">
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {grid.map((d, i) => {
            if (!d) return <span key={`x${i}`} />;
            const k = dayKey(d);
            const has = runDays.has(k);
            const sel = selectedDay === k;
            return (
              <button
                key={k}
                ref={(el) => {
                  if (el) dayRefs.current.set(k, el);
                  else dayRefs.current.delete(k);
                }}
                onClick={() => has && setSelectedDay(sel ? null : k)}
                disabled={!has}
                aria-pressed={sel}
                aria-label={`${d.toDateString()}${has ? `, ${runDays.get(k)!.length} scheduled run(s)` : ""}`}
                className={`relative flex min-h-11 items-center justify-center text-sm tabular-nums ${
                  sel
                    ? "border-2 border-line bg-accent font-bold text-ink shadow-hard-sm"
                    : has
                      ? "cursor-pointer font-bold hover:bg-bg"
                      : "text-muted/50"
                }`}
              >
                {d.getDate()}
                {has && !sel && (
                  <span className="absolute bottom-1 h-1.5 w-1.5 bg-accent" />
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-3 flex items-center gap-2 text-xs text-muted">
          <span className="inline-block h-1.5 w-1.5 bg-accent" /> scheduled run
          — click a date to filter
        </p>
      </div>
    </div>
  );
}
