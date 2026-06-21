import {
  type NormalizedTursoTenantDatabaseConfig,
  type TursoTenantDatabaseConfig,
  normalizeTursoTenantDatabaseConfig,
} from "./config";

export type TursoTenantDatabaseStatus = "active" | "provisioning" | "migrating" | "suspended";

export interface TursoTenantDatabaseRoute {
  tenantId: string;
  organizationId: string;
  tenantSlug: string;
  databaseUrl: string;
  /**
   * Short-lived local development token or already-resolved runtime secret.
   * Production control-plane storage should prefer authTokenSecretRef.
   */
  authToken?: string;
  authTokenSecretRef?: string;
  group?: string;
  schemaVersion: number;
  status: TursoTenantDatabaseStatus;
}

export interface TursoTenantRouteStore {
  resolveByTenantId(tenantId: string): Promise<TursoTenantDatabaseRoute | null>;
  resolveByTenantSlug(tenantSlug: string): Promise<TursoTenantDatabaseRoute | null>;
}

export function routeToTursoConfig(
  route: TursoTenantDatabaseRoute,
): NormalizedTursoTenantDatabaseConfig {
  const config: TursoTenantDatabaseConfig = {
    tenantId: route.tenantId,
    url: route.databaseUrl,
    authToken: route.authToken,
    group: route.group,
  };
  return normalizeTursoTenantDatabaseConfig(config);
}

export function assertTursoTenantRouteReady(
  route: TursoTenantDatabaseRoute,
  requiredSchemaVersion: number,
) {
  if (route.status !== "active") {
    throw new Error(`Tenant database "${route.tenantId}" is ${route.status}`);
  }
  if (route.schemaVersion < requiredSchemaVersion) {
    throw new Error(
      `Tenant database "${route.tenantId}" schema version ${route.schemaVersion} is below required ${requiredSchemaVersion}`,
    );
  }
}

export async function resolveReadyTursoTenantConfig(
  store: TursoTenantRouteStore,
  tenantId: string,
  requiredSchemaVersion: number,
): Promise<NormalizedTursoTenantDatabaseConfig | null> {
  const route = await store.resolveByTenantId(tenantId);
  if (!route) return null;
  assertTursoTenantRouteReady(route, requiredSchemaVersion);
  return routeToTursoConfig(route);
}
