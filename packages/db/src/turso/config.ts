export const TURSO_BUSY_TIMEOUT_MS = 5000;

export interface TursoTenantDatabaseConfig {
  tenantId: string;
  url: string;
  authToken?: string;
  group?: string;
  busyTimeoutMs?: number;
}

export interface NormalizedTursoTenantDatabaseConfig extends TursoTenantDatabaseConfig {
  busyTimeoutMs: number;
}

export function normalizeTursoTenantDatabaseConfig(
  config: TursoTenantDatabaseConfig,
): NormalizedTursoTenantDatabaseConfig {
  if (!config.tenantId.trim()) throw new Error("tenantId is required");
  if (!config.url.trim()) throw new Error("Turso database URL is required");

  return {
    ...config,
    busyTimeoutMs: Math.max(config.busyTimeoutMs ?? TURSO_BUSY_TIMEOUT_MS, TURSO_BUSY_TIMEOUT_MS),
  };
}
