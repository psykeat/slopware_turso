import { auth } from "@repo/auth/auth";
import { db, activePersistence, runInTenantScope } from "@repo/db";
import { metadataHistory } from "@repo/db/schema";
import {
  MetadataResolver,
  type DesignerPatch,
  type DesignerSurfaceKind,
} from "@repo/db/services/metadata";
import { MetadataWriter } from "@repo/db/services/metadata-writer";
import { getTenantInfoById, getUserTenantRole } from "@repo/db/services/tenant";
import { discoverEntities, resolveProjection, type ProjectionKind } from "@repo/registry";
import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq } from "drizzle-orm";

import { resolveTenantContext } from "#/lib/resolve-tenant";

import { canWriteLayoutScope, resolveLayoutBody } from "./-layout-utils";

type DesignerFallbackResponse = {
  status: "unsupported";
  source: "fallback";
  entityName: string;
  surface: string;
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

function getEntityAndSurface(pathname: string): {
  entityName: string;
  surface: DesignerSurfaceKind;
} | null {
  const segments = getPathSegments(pathname);
  if (segments[0] !== "api" || segments[1] !== "metadata" || segments[2] !== "designer") {
    return null;
  }

  if (segments.length !== 5) return null;

  const entityName = segments[3];
  const surface = segments[4];

  if (!entityName || !surface) return null;

  return { entityName, surface: surface as DesignerSurfaceKind };
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
  request?: unknown;
}): DesignerFallbackResponse {
  return {
    status: "unsupported",
    source: "fallback",
    entityName: params.entityName,
    surface: params.surface,
    tenantId: params.tenantId,
    organizationId: params.organizationId ?? null,
    reason: "Structured metadata designer API is not available in this build.",
    request: params.request,
  };
}

function registryFieldType(type: string, format?: string | null) {
  if (type === "boolean") return "boolean";
  if (type === "number") return format === "integer" ? "integer" : "numeric";
  if (type === "date") return "timestamp";
  return "text";
}

function registryFieldsResponse(entityName: string) {
  const projection = resolveProjection(entityName, "form" as ProjectionKind);
  if (!projection) return null;
  return projection.fields.map((field) => {
    const formProjection = field.projection as {
      component?: string;
      readOnly?: boolean;
    };
    return {
      fieldName: field.name,
      entityName,
      fieldType: registryFieldType(field.type, field.format),
      isVisible: !field.technical && formProjection.component !== "hidden",
      isRequired: field.required,
      label: field.label,
      labelEn: field.label.en,
      labelDe: field.label.de,
      scope: "registry",
      componentHint: formProjection.component,
      readonly: formProjection.readOnly === true,
      lookupTable: null,
      lookupFilter: null,
      lookupPkColumn: null,
      lookupDisplayColumn: null,
      lookupCodeColumn: null,
      lookupValueColumn: null,
      lookupSortColumn: null,
      lookupIsI18n: false,
      conflictState: "clean",
      reconciliationRequired: false,
    };
  });
}

function registryLayoutResponse(entityName: string, layoutKey: string) {
  const projection = resolveProjection(entityName, "list" as ProjectionKind);
  if (!projection) return null;
  const columnOrder = projection.fields.map((field) => field.name);
  return {
    layoutKey,
    columnOrder,
    conflictState: "clean",
    reconciliationRequired: false,
    versionInfo: {
      baseVersion: `registry:${entityName}:${layoutKey}`,
      derivedFromVersion: `registry:${entityName}:${layoutKey}`,
      overrideMode: "base",
      conflictState: "clean",
      reconciliationRequired: false,
      supersededFieldRef: null,
      clientRevision: null,
    },
    resolution: {
      effectiveScope: "global",
      scopes: {
        global: { columnOrder },
        org: null,
        tenant: null,
        user: null,
      },
    },
  };
}

function registrySettingsResponse() {
  return discoverEntities()
    .filter((entity) => entity.module !== "system")
    .map((entity) => ({
      tableName: entity.name,
      label: entity.label,
      group: entity.module,
    }));
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

        return runInTenantScope(context, async () => {
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

              const historyConditions = [eq(metadataHistory.entityName, historyEntity)];
              if (activePersistence.provider === "postgres" && context.tenantId) {
                historyConditions.push(eq((metadataHistory as any).tenantId, context.tenantId));
              }

              const history = await db
                .select()
                .from(metadataHistory)
                .where(and(...historyConditions))
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
            if (designerTarget) {
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
              return jsonResponse(registrySettingsResponse());
            }

            if (pathname.includes("/fields/")) {
              const segments = pathname.split("/").filter(Boolean);
              const entityName = segments.pop();
              if (!entityName) return new Response("Bad Request", { status: 400 });
              const registryFields = registryFieldsResponse(entityName);
              if (registryFields) return jsonResponse(registryFields);
              const fields = await resolver.getEffectiveFields(entityName);
              return jsonResponse(fields);
            }

            if (pathname.includes("/layout/")) {
              const segments = pathname.split("/").filter(Boolean);
              const layoutKey = segments.pop();
              const entityName = segments.pop();
              if (!entityName || !layoutKey) return new Response("Bad Request", { status: 400 });
              const registryLayout = registryLayoutResponse(entityName, layoutKey);
              if (registryLayout) return jsonResponse(registryLayout);
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
        });
      },
      POST: async ({ request }) => handleUpdate({ request }),
      PATCH: async ({ request }) => handleUpdate({ request }),
    },
  },
});

async function handleUpdate({ request }: { request: Request }) {
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

  return runInTenantScope(context, async () => {
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
      if (designerTarget) {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON body", { status: 400 });
        }

        const structuredDesigner = await writer.commitDesignerPatch(
          designerTarget.entityName,
          designerTarget.surface,
          body as DesignerPatch,
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
            // @ts-expect-error
            // eslint-disable-next-line
            scope,
            tenantRole,
            isSystemAdmin,
            isBaseTenant: tenantInfo?.isBase ?? false,
          })
        ) {
          return new Response("Forbidden", { status: 403 });
        }

        // @ts-expect-error
        // eslint-disable-next-line
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
  });
}
