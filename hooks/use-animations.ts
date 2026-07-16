"use client";

import { useEffect, useRef, useState, RefObject } from "react";

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
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setOffset(window.scrollY * speed);
          ticking = false;
        });
        ticking = true;
      }
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
