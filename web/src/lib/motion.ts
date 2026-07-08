"use client";

// anime.js motion helpers — every animation communicates a state change
// (DESIGN.md: no decorative motion, ≤400ms, respect reduced-motion).
import { animate, stagger, utils } from "animejs";

export const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** List/grid entrance: rise + fade, 40ms stagger per item. */
export function staggerIn(targets: Element[] | NodeListOf<Element>) {
  const els = Array.from(targets);
  if (els.length === 0) return;
  if (reducedMotion()) {
    els.forEach((el) => {
      (el as HTMLElement).style.opacity = "1";
      (el as HTMLElement).style.transform = "none";
    });
    return;
  }
  animate(els, {
    opacity: [0, 1],
    translateY: [8, 0],
    duration: 240,
    ease: "outQuad",
    delay: stagger(40),
  });
}

/** Panel slide-in from the right (detail slide-over). */
export function slideInRight(el: Element) {
  if (reducedMotion()) return;
  animate(el, {
    translateX: ["100%", "0%"],
    duration: 260,
    ease: "outQuad",
  });
}

/** Backdrop fade for modals/panels. */
export function fadeIn(el: Element, duration = 160) {
  if (reducedMotion()) return;
  animate(el, { opacity: [0, 1], duration, ease: "outQuad" });
}

/** Success/reveal pop: scale up with slight overshoot (QR, check icon). */
export function popIn(el: Element) {
  if (reducedMotion()) return;
  animate(el, {
    scale: [0.6, 1],
    opacity: [0, 1],
    duration: 320,
    ease: "outBack(1.4)",
  });
}

/** Progress bar fill: scaleX from 0 to target fraction (transform-only, no CLS). */
export function fillBar(el: Element, fraction: number) {
  const target = Math.max(0, Math.min(1, fraction));
  if (reducedMotion()) {
    (el as HTMLElement).style.transform = `scaleX(${target})`;
    return;
  }
  animate(el, {
    scaleX: [0, target],
    duration: 400,
    ease: "outQuad",
  });
}

/** Numeric count-up driving a callback each frame (currency-formatted by caller). */
export function countUp(
  from: number,
  to: number,
  onFrame: (v: number) => void,
  duration = 450,
) {
  if (reducedMotion() || from === to) {
    onFrame(to);
    return () => {};
  }
  const counter = { v: from };
  const anim = animate(counter, {
    v: to,
    duration,
    ease: "outQuad",
    modifier: utils.round(2),
    onUpdate: () => onFrame(counter.v),
    onComplete: () => onFrame(to),
  });
  return () => {
    anim.cancel();
  };
}
