"use client";

import { useCallback, useEffect, useRef, type MouseEvent } from "react";

// Click-hold drag scrolling for horizontal rails on mouse devices, with
// momentum flick on release and vertical-wheel → horizontal mapping.
// Touch keeps native scrolling. Suppresses the trailing click after a real
// drag so card buttons don't fire when the user was just scrolling.
export function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const s = useRef({
    down: false,
    startX: 0,
    startLeft: 0,
    dragged: false,
    lastX: 0,
    lastT: 0,
    velocity: 0,
  });
  const raf = useRef<number | null>(null);

  const stopInertia = useCallback(() => {
    if (raf.current !== null) {
      cancelAnimationFrame(raf.current);
      raf.current = null;
    }
  }, []);

  const runInertia = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const step = () => {
      s.current.velocity *= 0.94; // friction
      el.scrollLeft -= s.current.velocity;
      const atEdge =
        el.scrollLeft <= 0 ||
        el.scrollLeft >= el.scrollWidth - el.clientWidth;
      if (Math.abs(s.current.velocity) > 0.4 && !atEdge) {
        raf.current = requestAnimationFrame(step);
      } else {
        raf.current = null;
      }
    };
    raf.current = requestAnimationFrame(step);
  }, []);

  function onMouseDown(e: MouseEvent<T>) {
    if (!ref.current || e.button !== 0) return;
    stopInertia();
    s.current = {
      down: true,
      startX: e.pageX,
      startLeft: ref.current.scrollLeft,
      dragged: false,
      lastX: e.pageX,
      lastT: performance.now(),
      velocity: 0,
    };
  }

  function onMouseMove(e: MouseEvent<T>) {
    if (!s.current.down || !ref.current) return;
    const dx = e.pageX - s.current.startX;
    if (Math.abs(dx) > 5) s.current.dragged = true;
    if (!s.current.dragged) return;
    e.preventDefault();
    ref.current.scrollLeft = s.current.startLeft - dx;

    const now = performance.now();
    const dt = now - s.current.lastT;
    if (dt > 0) {
      // px/frame, smoothed — drives the flick after release
      s.current.velocity =
        0.8 * s.current.velocity +
        0.2 * ((e.pageX - s.current.lastX) / dt) * 16;
    }
    s.current.lastX = e.pageX;
    s.current.lastT = now;
  }

  function endDrag() {
    if (!s.current.down) return;
    s.current.down = false;
    if (Math.abs(s.current.velocity) > 1) runInertia();
  }

  function onClickCapture(e: MouseEvent<T>) {
    if (s.current.dragged) {
      e.preventDefault();
      e.stopPropagation();
      s.current.dragged = false;
    }
  }

  // Vertical wheel scrolls the rail horizontally (trackpad/mouse-wheel intuit).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      const canScroll = el.scrollWidth > el.clientWidth;
      if (!canScroll) return;
      e.preventDefault();
      stopInertia();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [stopInertia]);

  useEffect(() => stopInertia, [stopInertia]);

  return {
    ref,
    onMouseDown,
    onMouseMove,
    onMouseUp: endDrag,
    onMouseLeave: endDrag,
    onClickCapture,
  };
}
