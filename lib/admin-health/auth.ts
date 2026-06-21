import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

import { getAdminHealthPassword, getAdminHealthSlug, isAdminHealthConfigured } from "@/lib/admin-health/env";

const COOKIE_NAME = "finsepa_ops_health";
const SESSION_VERSION = "v1";
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7;

function sessionToken(slug: string, password: string): string {
  return createHmac("sha256", password).update(`${SESSION_VERSION}:${slug}`).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function adminHealthSlugMatches(requestSlug: string): boolean {
  const expected = getAdminHealthSlug();
  if (!expected || !isAdminHealthConfigured()) return false;
  return safeEqual(requestSlug, expected);
}

export function verifyAdminHealthPassword(input: string): boolean {
  const expected = getAdminHealthPassword();
  if (!expected || !input) return false;
  return safeEqual(input, expected);
}

export function adminHealthCookiePath(_slug: string): string {
  // Path `/` so the httpOnly cookie is sent to both `/ops/...` pages and `/api/ops/...` routes.
  return "/";
}

export async function hasValidAdminHealthSession(requestSlug: string): Promise<boolean> {
  if (!adminHealthSlugMatches(requestSlug)) return false;

  const slug = getAdminHealthSlug();
  const password = getAdminHealthPassword();
  if (!slug || !password) return false;

  const cookieStore = await cookies();
  const value = cookieStore.get(COOKIE_NAME)?.value;
  if (!value) return false;

  return safeEqual(value, sessionToken(slug, password));
}

export function setAdminHealthSessionCookie(slug: string): {
  name: string;
  value: string;
  options: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: "lax";
    path: string;
    maxAge: number;
  };
} {
  const password = getAdminHealthPassword();
  if (!password) {
    throw new Error("Admin health password is not configured.");
  }

  return {
    name: COOKIE_NAME,
    value: sessionToken(slug, password),
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: adminHealthCookiePath(slug),
      maxAge: SESSION_MAX_AGE_SEC,
    },
  };
}

export function clearAdminHealthSessionCookie(slug: string): {
  name: string;
  value: string;
  options: { httpOnly: boolean; path: string; maxAge: number };
} {
  return {
    name: COOKIE_NAME,
    value: "",
    options: {
      httpOnly: true,
      path: adminHealthCookiePath(slug),
      maxAge: 0,
    },
  };
}
