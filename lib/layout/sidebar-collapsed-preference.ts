/** Cookie + localStorage key for desktop sidebar collapsed (lite) mode. */
export const SIDEBAR_COLLAPSED_PREFERENCE_KEY = "finsepa-sidebar-collapsed";

export function readSidebarCollapsedPreference(raw: string | undefined | null): boolean {
  return raw === "1";
}
