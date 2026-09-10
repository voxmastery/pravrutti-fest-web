"use client";

import { useEffect, useRef, useState, RefObject } from "react";

/**
 * Counts from 0 to `end` once, the first time the element scrolls into view.
 *
 * Fires once and never resets — a number that re-counts every time it scrolls
 * past reads as broken rather than delightful.
 *
 * Honours prefers-reduced-motion by jumping straight to the final value: the
 * point of the stat is the number, so someone who has asked for less motion
 * should still get the information immediately, not a blank or a zero.
 */
export function useCountUp<T extends HTMLElement = HTMLDivElement>(
  end: number,
  duration = 1600
): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [value, setValue] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || done.current) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      done.current = true;
      setValue(end);
      return;
    }

    let raf = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || done.current) return;
        done.current = true;
        const t0 = performance.now();
        const step = (now: number) => {
          const p = Math.min((now - t0) / duration, 1);
          // easeOutCubic: fast to start, settles rather than stopping dead
          setValue(Math.round((1 - Math.pow(1 - p, 3)) * end));
          if (p < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      },
      { threshold: 0.4 }
    );

    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [end, duration]);

  return [ref, value];
}

/** Intersection-based scroll reveal: adds `revealed` class when visible */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
  threshold = 0.15,
  rootMargin = "0px 0px -40px 0px"
): RefObject<T | null> {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("revealed");
          observer.unobserve(el);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return ref;
}

/** Parallax value that updates on scroll */
export function useParallax(speed = 0.3): number {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    // Someone who asked for less motion should not get a moving background.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let ticking = false;
    let last = 0;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        // Rounded, and only committed when it actually changed. Every update
        // re-renders the whole hero, so a raw float from scrollY would trigger
        // a render on literally every frame for sub-pixel movement nobody can
        // see.
        const next = Math.round(window.scrollY * speed);
        if (next !== last) {
          last = next;
          setOffset(next);
        }
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [speed]);

  return offset;
}

/** Mouse position relative to an element (for tilt/magnetic effects) */
export function useMousePosition(ref: RefObject<HTMLElement | null>) {
  const [pos, setPos] = useState({ x: 0.5, y: 0.5, active: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      setPos({
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
        active: true,
      });
    };

    const onLeave = () => setPos({ x: 0.5, y: 0.5, active: false });

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [ref]);

  return pos;
}

/**
 * Global scroll reveal observer.
 * Mount this once at the root of your app to automatically
 * add "revealed" to any element with class reveal-up, reveal-left,
 * reveal-right, or reveal-scale when they enter the viewport.
 */
export function useGlobalScrollReveal() {
  useEffect(() => {
    const selectors = ".reveal-up, .reveal-left, .reveal-right, .reveal-scale";

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -30px 0px" }
    );

    // Observe all current elements
    document.querySelectorAll(selectors).forEach((el) => observer.observe(el));

    // Also watch for new elements being added to the DOM (dynamic rendering)
    const mutation = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        m.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            if (node.matches(selectors)) observer.observe(node);
            node.querySelectorAll(selectors).forEach((el) => observer.observe(el));
          }
        });
      });
    });

    mutation.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutation.disconnect();
    };
  }, []);
}
