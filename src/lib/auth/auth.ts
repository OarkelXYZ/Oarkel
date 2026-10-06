import "server-only";
import { BRAND } from "@/config/brand";

/**
 * Domain named in every message a wallet signs here. It is never taken from
 * the request on trust: a look-alike site could otherwise obtain a message in
 * its own name, have a visitor sign it there, and replay the signature here.
 * Only the project's own domain (and localhost outside Vercel) is accepted.
 */
export function signInDomain(requestHost: string | null) {
  const host = (requestHost ?? "").toLowerCase();
  if (host === BRAND.domain || host === `www.${BRAND.domain}`) return host;
  if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
    if (/^(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(host)) return host;
  }
  return BRAND.domain;
}
