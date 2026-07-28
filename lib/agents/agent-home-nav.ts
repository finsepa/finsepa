/** Dispatched when sidebar/mobile “Agent” is clicked while already on `/agents`. */
export const AGENT_HOME_NAV_EVENT = "finsepa:agent-home";

export function isAgentPath(pathname: string): boolean {
  return pathname === "/agents" || pathname.startsWith("/agents/");
}

/** If already on Agent, prevent same-route no-op and request the empty start screen. */
export function requestAgentHomeIfAlreadyThere(
  event: { preventDefault: () => void },
  pathname: string,
  href: string,
): void {
  if (href !== "/agents" || !isAgentPath(pathname)) return;
  event.preventDefault();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AGENT_HOME_NAV_EVENT));
  }
}
