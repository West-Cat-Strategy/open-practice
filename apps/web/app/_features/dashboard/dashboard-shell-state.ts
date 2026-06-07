"use client";

import { useEffect, useRef, useState } from "react";
import {
  buildDashboardSectionUrl,
  resolveDashboardRouteSelection,
  type DashboardNavigationSectionKey,
  type OpenPracticeSidebarNavigationSection,
} from "../../../routes/routeCatalog";

export const dashboardReviewRailCollapsedStorageKey = "open-practice.dashboard.reviewRailCollapsed";

export function readDashboardRequestedSection(search: string): string | null {
  return new URLSearchParams(search).get("section");
}

export function buildDashboardHistoryState(sectionKey: DashboardNavigationSectionKey) {
  return { section: sectionKey };
}

export function buildDashboardHistoryEntry(
  currentHref: string,
  sectionKey: DashboardNavigationSectionKey,
) {
  return {
    state: buildDashboardHistoryState(sectionKey),
    url: buildDashboardSectionUrl(currentHref, sectionKey),
  };
}

export function useDashboardShellState({
  initialSection,
  navigationSections,
}: {
  initialSection: DashboardNavigationSectionKey;
  navigationSections: OpenPracticeSidebarNavigationSection[];
}) {
  const detailPanelRef = useRef<HTMLElement>(null);
  const reviewRailToggleRef = useRef<HTMLButtonElement>(null);
  const reviewRailExpandHandleRef = useRef<HTMLButtonElement>(null);
  const shouldFocusDetailRef = useRef(false);
  const shouldFocusReviewRailToggleRef = useRef(false);
  const hasAppliedUrlSectionRef = useRef(false);
  const [isContextRailCollapsed, setIsContextRailCollapsed] = useState(false);
  const [hasLoadedContextRailPreference, setHasLoadedContextRailPreference] = useState(false);
  const [activeSection, setActiveSection] = useState<DashboardNavigationSectionKey>(initialSection);

  useEffect(() => {
    function applySectionFromUrl() {
      const selection = resolveDashboardRouteSelection({
        requestedSection: readDashboardRequestedSection(window.location.search),
        navigationSections,
      });
      if (hasAppliedUrlSectionRef.current) shouldFocusDetailRef.current = true;
      hasAppliedUrlSectionRef.current = true;
      setActiveSection(selection.sectionKey);
    }

    applySectionFromUrl();
    window.addEventListener("popstate", applySectionFromUrl);
    return () => window.removeEventListener("popstate", applySectionFromUrl);
  }, [navigationSections]);

  useEffect(() => {
    if (!shouldFocusDetailRef.current) return;
    detailPanelRef.current?.focus();
    shouldFocusDetailRef.current = false;
  }, [activeSection]);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(dashboardReviewRailCollapsedStorageKey);
      if (stored === "true") setIsContextRailCollapsed(true);
      if (stored === "false") setIsContextRailCollapsed(false);
    } catch {
      // Keep the default expanded posture when session storage is unavailable.
    } finally {
      setHasLoadedContextRailPreference(true);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedContextRailPreference) return;
    try {
      window.sessionStorage.setItem(
        dashboardReviewRailCollapsedStorageKey,
        isContextRailCollapsed ? "true" : "false",
      );
    } catch {
      // Session storage persistence is ergonomic only; the dashboard remains usable without it.
    }
  }, [hasLoadedContextRailPreference, isContextRailCollapsed]);

  useEffect(() => {
    if (!shouldFocusReviewRailToggleRef.current || isContextRailCollapsed) return;
    reviewRailToggleRef.current?.focus();
    shouldFocusReviewRailToggleRef.current = false;
  }, [isContextRailCollapsed]);

  function selectDashboardSection(sectionKey: DashboardNavigationSectionKey): void {
    shouldFocusDetailRef.current = true;
    setActiveSection(sectionKey);
    const historyEntry = buildDashboardHistoryEntry(window.location.href, sectionKey);
    window.history.pushState(historyEntry.state, "", historyEntry.url);
  }

  function toggleContextRail(): void {
    setIsContextRailCollapsed((isCollapsed) => {
      const nextCollapsed = !isCollapsed;
      if (!nextCollapsed) shouldFocusReviewRailToggleRef.current = true;
      return nextCollapsed;
    });
  }

  function expandContextRail(): void {
    shouldFocusReviewRailToggleRef.current = true;
    setIsContextRailCollapsed(false);
  }

  return {
    activeSection,
    detailPanelRef,
    expandContextRail,
    isContextRailCollapsed,
    reviewRailExpandHandleRef,
    reviewRailToggleRef,
    selectDashboardSection,
    toggleContextRail,
  };
}
