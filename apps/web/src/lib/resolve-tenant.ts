import "@tanstack/react-start/server-only";
import { getTenantContext, getTenantContextById } from "@repo/db/services/tenant";

const COOKIE = "x-active-tenant";

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function resolveTenantContext(
  request: Request,
  userId: string,
  isSystemAdmin: boolean,
) {
  if (isSystemAdmin) {
    const activeTenantId = parseCookie(request.headers.get("cookie"), COOKIE);
    if (activeTenantId) return getTenantContextById(activeTenantId);
  }
  return getTenantContext(userId);
}
