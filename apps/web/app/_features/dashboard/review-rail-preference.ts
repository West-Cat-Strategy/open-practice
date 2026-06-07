"use client";

import { useEffect, useState } from "react";

export function useReviewRailPreference(storageKey: string, defaultCollapsed = false) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [hasLoadedPreference, setHasLoadedPreference] = useState(false);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(storageKey);
      if (stored === "true") setIsCollapsed(true);
      if (stored === "false") setIsCollapsed(false);
    } catch {
      // Keep the default expanded posture when session storage is unavailable.
    } finally {
      setHasLoadedPreference(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!hasLoadedPreference) return;
    try {
      window.sessionStorage.setItem(storageKey, isCollapsed ? "true" : "false");
    } catch {
      // Session storage persistence is ergonomic only; the dashboard remains usable without it.
    }
  }, [hasLoadedPreference, isCollapsed, storageKey]);

  return {
    hasLoadedPreference,
    isCollapsed,
    setIsCollapsed,
  };
}
