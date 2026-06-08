import { auth } from "@repo/auth/auth";
import { db } from "@repo/db";
import { metadataHistory } from "@repo/db/schema";
import { MetadataResolver } from "@repo/db/services/metadata";
import { MetadataWriter } from "@repo/db/services/metadata-writer";
import { getTenantInfoById, getUserTenantRole } from "@repo/db/services/tenant";
import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq } from "drizzle-orm";

import { resolveTenantContext } from "#/lib/resolve-tenant";

import { canWriteLayoutScope, resolveLayoutBody } from "./-layout-utils";

type DesignerAction = "patch" | "apply" | "reconcile";

type DesignerFallbackResponse = {
  status: "unsupported";
  source: "fallback";
  entityName: string;
  surface: string;
  action?: DesignerAction;
  tenantId: string;
  organizationId: string | null;
  reason: string;
  request?: unknown;
};

function jsonResponse(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json");
  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

function getPathname(request: Request) {
  return new URL(request.url, "http://localhost").pathname;
}

function getPathSegments(pathname: string) {
  return pathname.split("/").filter(Boolean);
}

function getEntityAndSurface(pathname: string) {
  const segments = getPathSegments(pathname);
  if (segments[0] !== "api" || segments[1] !== "metadata" || segments[2] !== "designer") {
    return null;
  }

  if (segments.length !== 5 && segments.length !== 6) return null;

  const entityName = segments[3];
  const surface = segments[4];
  const action = segments[5];

  if (!entityName || !surface) return null;

  return { entityName, surface, action };
}

function getEntityFromPath(pathname: string, section: "history") {
  const segments = getPathSegments(pathname);
  if (segments[0] !== "api" || segments[1] !== "metadata" || segments[2] !== section) {
    return null;
  }

  if (segments.length !== 4) return null;

  return segments[3] ?? null;
}

async function callOptionalMethod<T>(
  target: unknown,
  methodNames: string[],
  ...args: unknown[]
): Promise<T | undefined> {
  const candidate = target as Record<string, unknown>;

  for (const methodName of methodNames) {
    const maybeMethod = candidate[methodName];
    if (typeof maybeMethod === "function") {
      return (maybeMethod as (...methodArgs: unknown[]) => Promise<T> | T).apply(target, args);
    }
  }

  return undefined;
}

function designerFallback(params: {
  entityName: string;
  surface: string;
  tenantId: string;
  organizationId?: string;
  action?: DesignerAction;
  request?: unknown;
}): DesignerFallbackResponse {
  return {
    status: "unsupported",
    source: "fallback",
    entityName: params.entityName,
    surface: params.surface,
    action: params.action,
    tenantId: params.tenantId,
    organizationId: params.organizationId ?? null,
    reason: "Structured metadata designer API is not available in this build.",
    request: params.request,
  };
}

async function getMetadataRequestContext(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || !session.user) {
    return { error: new Response("Unauthorized", { status: 401 }) } as const;
  }

  const isSystemAdmin = (session.user as any).isSystemAdmin;
  let context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
  if (!context) {
    return {
      session,
      isSystemAdmin,
      context: null,
    } as const;
  }

  return {
    session,
    isSystemAdmin,
    context,
  } as const;
}

export const Route = createFileRoute("/api/metadata/$")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const requestContext = await getMetadataRequestContext(request);
        if ("error" in requestContext) {
          return requestContext.error;
        }

        const { session } = requestContext;
        let context = requestContext.context;
        if (!context) {
          console.warn(
            `[Metadata API] No tenant context for user ${session.user.id}, falling back to global.`,
          );
          context = { tenantId: "", organizationId: "" };
        }

        const resolver = new MetadataResolver({ ...context, userId: session.user.id });
        const pathname = getPathname(request);
        console.log(`[Metadata API] Request: ${request.method} ${pathname}`);

        try {
          const historyEntity = getEntityFromPath(pathname, "history");
          if (historyEntity) {
            const structuredHistory = await callOptionalMethod<unknown>(
              resolver,
              ["getDesignerHistory", "readDesignerHistory", "getMetadataHistory"],
              historyEntity,
            );
            if (typeof structuredHistory !== "undefined") {
              return jsonResponse(structuredHistory);
            }

            const history = await db
              .select()
              .from(metadataHistory)
              .where(
                context.tenantId
                  ? and(
                      eq(metadataHistory.entityName, historyEntity),
                      eq(metadataHistory.tenantId, context.tenantId),
                    )
                  : eq(metadataHistory.entityName, historyEntity),
              )
              .orderBy(desc(metadataHistory.createdAt))
              .limit(100);

            return jsonResponse({
              status: "ok",
              source: "database",
              entityName: historyEntity,
              items: history,
            });
          }

          const designerTarget = getEntityAndSurface(pathname);
          if (designerTarget && !designerTarget.action) {
            const structuredDesigner = await callOptionalMethod<unknown>(
              resolver,
              ["getDesignerSurface", "readDesignerSurface", "getDesignerMetadata"],
              designerTarget.entityName,
              designerTarget.surface,
            );
            if (typeof structuredDesigner !== "undefined") {
              return jsonResponse(structuredDesigner);
            }

            return jsonResponse(
              designerFallback({
                entityName: designerTarget.entityName,
                surface: designerTarget.surface,
                tenantId: context.tenantId,
                organizationId: context.organizationId,
              }),
              { status: 501 },
            );
          }

          if (pathname.includes("/settings-registry")) {
            console.log(`[Metadata API] Resolving settings registry`);
            const registry = await resolver.getSettingsRegistry();
            return jsonResponse(registry);
          }

          if (pathname.includes("/fields/")) {
            const segments = pathname.split("/").filter(Boolean);
            const entityName = segments.pop();
            console.log(`[Metadata API] Resolving fields for entity: ${entityName}`);
            if (!entityName) return new Response("Bad Request", { status: 400 });
            const fields = await resolver.getEffectiveFields(entityName);
            return jsonResponse(fields);
          }

          if (pathname.includes("/layout/")) {
            const segments = pathname.split("/").filter(Boolean);
            const layoutKey = segments.pop();
            const entityName = segments.pop();
            console.log(
              `[Metadata API] Resolving layout for entity: ${entityName}, key: ${layoutKey}`,
            );
            if (!entityName || !layoutKey) return new Response("Bad Request", { status: 400 });
            const layout = await resolver.getEffectiveLayout(entityName, layoutKey);
            return jsonResponse(layout);
          }

          return new Response("Not Found", { status: 404 });
        } catch (err) {
          console.error("API Metadata Error:", err);
          return new Response(err instanceof Error ? err.message : "Internal Server Error", {
            status: 500,
          });
        }
      },
      POST: async ({ request }) => handleUpdate({ request, method: "POST" }),
      PATCH: async ({ request }) => handleUpdate({ request, method: "PATCH" }),
    },
  },
});

async function handleUpdate({ request, method }: { request: Request; method: "POST" | "PATCH" }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || !session.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const isSystemAdmin = (session.user as any).isSystemAdmin;
  const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
  if (!context) {
    return new Response("Tenant context required for updates", { status: 400 });
  }

  const tenantInfo = await getTenantInfoById(context.tenantId);
  const writer = new MetadataWriter({
    tenantId: context.tenantId,
    userId: session.user.id,
    isSystemAdmin,
    isBaseTenant: tenantInfo?.isBase ?? false,
    organizationId: context.organizationId,
  });

  const pathname = getPathname(request);
  const designerTarget = getEntityAndSurface(pathname);

  try {
    if (
      designerTarget?.action &&
      designerTarget.action !== "apply" &&
      designerTarget.action !== "reconcile"
    ) {
      return new Response("Not Found", { status: 404 });
    }

    if (designerTarget && !designerTarget.action) {
      if (method !== "PATCH") {
        return new Response("Not Found", { status: 404 });
      }

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return new Response("Invalid JSON body", { status: 400 });
      }

      const structuredDesigner = await callOptionalMethod<unknown>(
        writer,
        [
          "saveDesignerPatch",
          "patchDesignerSurface",
          "saveDesignerSurface",
          "saveDesignerMetadata",
        ],
        designerTarget.entityName,
        designerTarget.surface,
        body,
        {
          tenantId: context.tenantId,
          userId: session.user.id,
          isSystemAdmin,
          organizationId: context.organizationId ?? null,
        },
      );
      if (typeof structuredDesigner !== "undefined") {
        return jsonResponse(structuredDesigner);
      }

      return jsonResponse(
        designerFallback({
          entityName: designerTarget.entityName,
          surface: designerTarget.surface,
          tenantId: context.tenantId,
          organizationId: context.organizationId,
          action: "patch",
          request: body,
        }),
        { status: 501 },
      );
    }

    if (designerTarget?.action === "apply" || designerTarget?.action === "reconcile") {
      if (method !== "POST") {
        return new Response("Not Found", { status: 404 });
      }

      let body: unknown = {};
      try {
        const raw = await request.text();
        body = raw ? JSON.parse(raw) : {};
      } catch {
        return new Response("Invalid JSON body", { status: 400 });
      }

      const action: DesignerAction = designerTarget.action;
      const structuredDesigner = await callOptionalMethod<unknown>(
        writer,
        action === "apply"
          ? ["applyDesignerPatch", "applyDesignerSurface", "publishDesignerSurface"]
          : ["reconcileDesignerPatch", "reconcileDesignerSurface", "repairDesignerSurface"],
        designerTarget.entityName,
        designerTarget.surface,
        body,
        {
          tenantId: context.tenantId,
          userId: session.user.id,
          isSystemAdmin,
          organizationId: context.organizationId ?? null,
        },
      );
      if (typeof structuredDesigner !== "undefined") {
        return jsonResponse(structuredDesigner);
      }

      return jsonResponse(
        designerFallback({
          entityName: designerTarget.entityName,
          surface: designerTarget.surface,
          tenantId: context.tenantId,
          organizationId: context.organizationId,
          action,
          request: body,
        }),
        { status: 501 },
      );
    }

    const body = await request.json();

    if (pathname.includes("/fields/")) {
      const segments = pathname.split("/").filter(Boolean);
      const entityName = segments.pop();
      if (!entityName) return new Response("Bad Request", { status: 400 });

      // Expects { fieldName: string, data: any }
      const { fieldName, data } = body;
      if (!fieldName || !data) return new Response("Missing fieldName or data", { status: 400 });

      await writer.saveFieldOverride(entityName, fieldName, data);
      return new Response(JSON.stringify({ success: true }), {
        headers: { "content-type": "application/json" },
      });
    }

    if (pathname.includes("/layout/")) {
      const segments = pathname.split("/").filter(Boolean);
      const layoutKey = segments.pop();
      const entityName = segments.pop();
      if (!entityName || !layoutKey) return new Response("Bad Request", { status: 400 });

      const tenantRole = await getUserTenantRole(session.user.id, context.tenantId);
      const { layoutDefinition, scope } = resolveLayoutBody(body);
      if (
        !canWriteLayoutScope({
          scope,
          tenantRole,
          isSystemAdmin,
          isBaseTenant: tenantInfo?.isBase ?? false,
        })
      ) {
        return new Response("Forbidden", { status: 403 });
      }

      await writer.saveLayoutOverride(entityName, layoutKey, layoutDefinition, scope);
      return new Response(JSON.stringify({ success: true }), {
        headers: { "content-type": "application/json" },
      });
    }

    if (pathname.includes("/groups/")) {
      const segments = pathname.split("/").filter(Boolean);
      const entityName = segments.pop();
      if (!entityName) return new Response("Bad Request", { status: 400 });

      // Expects { groupKey: string, data: any }
      const { groupKey, data } = body;
      if (!groupKey || !data) return new Response("Missing groupKey or data", { status: 400 });

      await writer.saveGroupOverride(entityName, groupKey, data);
      return jsonResponse({ success: true });
    }

    return new Response("Not Found", { status: 404 });
  } catch (err) {
    console.error("API Metadata Update Error:", err);
    return new Response(err instanceof Error ? err.message : "Internal Server Error", {
      status: 500,
    });
  }
}
