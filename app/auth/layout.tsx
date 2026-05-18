import type { ReactNode } from "react";

export { authMetadata as metadata, authViewport as viewport } from "@/lib/auth/auth-viewport";

export default function AuthSegmentLayout({ children }: { children: ReactNode }) {
  return children;
}
