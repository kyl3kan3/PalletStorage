"use client";

import { useEffect, useState } from "react";

/**
 * Returns true when `window.matchMedia(query)` currently matches.
 * SSR-safe (defaults to false on the server), subscribes to changes.
 *
 * Usage: const isMobile = useMatchMedia("(max-width: 1023px)");
 */
export function useMatchMedia(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);
  return matches;
}
