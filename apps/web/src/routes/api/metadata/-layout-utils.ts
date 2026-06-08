type LayoutScope = "global" | "org" | "tenant" | "user";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function canWriteLayoutScope(params: {
  scope: LayoutScope;
  tenantRole: string | null;
  isSystemAdmin: boolean;
  isBaseTenant: boolean;
}) {
  if (params.scope === "user") return true;
  if (params.scope === "tenant") return params.tenantRole === "owner";
  if (params.scope === "org") return params.isSystemAdmin;
  if (params.scope === "global") {
    return params.isBaseTenant && (params.isSystemAdmin || params.tenantRole === "owner");
  }
  return false;
}

export function resolveLayoutBody(body: unknown) {
  if (!isRecord(body)) {
    return { layoutDefinition: body, scope: "user" as LayoutScope };
  }

  const scope =
    body.scope === "global" ||
    body.scope === "org" ||
    body.scope === "tenant" ||
    body.scope === "user"
      ? body.scope
      : "user";
  const layoutDefinition = "layoutDefinition" in body ? body.layoutDefinition : body;

  return { layoutDefinition, scope };
}
