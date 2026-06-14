import { auth } from "@repo/auth/auth";
import { toCapabilityRole, type ExecutionContext } from "@repo/db/capabilities";
import { getUserTenantRole } from "@repo/db/services/tenant";

import { resolveTenantContext } from "#/lib/resolve-tenant";
// Side-effect import: registers the server-side document-PDF renderer into the
// capability runtime's render port (see register-document-pdf for the why).
import "#/pdf/register-document-pdf";

// Single place where HTTP callers become an ExecutionContext. Phase 3 adds an
// x-api-key branch here (actorMode "external", tenant/role from key metadata
// stored server-side) — capability routes never read tenantId from the payload.
export async function resolveExecutionContext(
  request: Request,
): Promise<ExecutionContext | Response> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const isSystemAdmin = Boolean((session.user as Record<string, unknown>).isSystemAdmin);
  const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
  if (!context) {
    return new Response("No active tenant found", { status: 403 });
  }

  const role = isSystemAdmin
    ? "tenant_admin"
    : toCapabilityRole(await getUserTenantRole(session.user.id, context.tenantId));

  return {
    tenantId: context.tenantId,
    organizationId: context.organizationId,
    userId: session.user.id,
    actorMode: "user",
    role,
  };
}
