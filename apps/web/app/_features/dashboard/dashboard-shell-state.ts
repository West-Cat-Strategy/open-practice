"use client";

import { useEffect, useRef, useState } from "react";
import {
  buildDashboardSectionUrl,
  matchRouteCatalogEntry,
  resolveDashboardRouteSelection,
  type DashboardNavigationSectionKey,
  type DashboardRouteSelection,
  type OpenPracticeSidebarNavigationSection,
} from "../../../routes/routeCatalog";

export const dashboardReviewRailCollapsedStorageKey = "open-practice.dashboard.reviewRailCollapsed";

export type DashboardNavigationMode = "query" | "path";

export function readDashboardRequestedSection(search: string, pathname = "/"): string | null {
  const section = new URLSearchParams(search).get("section");
  if (section) return section;
  if (pathname === "/") return null;
  return matchRouteCatalogEntry(`${pathname}${search}`)?.sectionKey ?? null;
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
  initialRouteSelection,
  navigationMode = "query",
  navigationSections,
}: {
  initialRouteSelection: DashboardRouteSelection;
  navigationMode?: DashboardNavigationMode;
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
  const [routeSelection, setRouteSelection] =
    useState<DashboardRouteSelection>(initialRouteSelection);
  const activeSection = routeSelection.sectionKey;

  useEffect(() => {
    if (navigationMode === "path") {
      setRouteSelection(initialRouteSelection);
      hasAppliedUrlSectionRef.current = true;
      return;
    }

    function applySectionFromUrl() {
      const selection = resolveDashboardRouteSelection({
        requestedSection: readDashboardRequestedSection(
          window.location.search,
          window.location.pathname,
        ),
        navigationSections,
      });
      if (hasAppliedUrlSectionRef.current) shouldFocusDetailRef.current = true;
      hasAppliedUrlSectionRef.current = true;
      setRouteSelection(selection);
    }

    applySectionFromUrl();
    window.addEventListener("popstate", applySectionFromUrl);
    return () => window.removeEventListener("popstate", applySectionFromUrl);
  }, [initialRouteSelection, navigationMode, navigationSections]);

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
    setRouteSelection(
      resolveDashboardRouteSelection({
        requestedSection: sectionKey,
        navigationSections,
      }),
    );
    const historyEntry = buildDashboardHistoryEntry(window.location.href, sectionKey);
    if (navigationMode === "path") {
      window.location.assign(historyEntry.url);
      return;
    }
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
    routeSelection,
    selectDashboardSection,
    toggleContextRail,
  };
}
