// Browser-side client for the official capability HTTP surface
// (POST /api/capabilities/{key}/execute). Shared UI components live outside
// apps/web and cannot import its server functions; this is the sanctioned
// transport for them — same executeCapability core, same envelope. Tenant
// context is resolved server-side from the session; never send tenantId.

export interface CapabilityErrorShape {
  code: string;
  message: string;
  issues?: Array<{ path: string; message: string }>;
}

export interface CapabilityMetaShape {
  capability: string;
  entityName: string;
  writesTables: string[];
  schemaVersion: number;
  dryRun: boolean;
  durationMs: number;
}

export class CapabilityHttpError extends Error {
  readonly code: string;
  readonly issues?: Array<{ path: string; message: string }>;

  constructor(error: CapabilityErrorShape) {
    super(error.message);
    this.name = "CapabilityHttpError";
    this.code = error.code;
    this.issues = error.issues;
  }
}

export async function executeCapability<T = unknown>(
  key: string,
  input: unknown,
  opts?: { dryRun?: boolean },
): Promise<{ data: T; meta: CapabilityMetaShape }> {
  const response = await fetch(`/api/capabilities/${key}/execute`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ input, ...(opts?.dryRun ? { dryRun: true } : {}) }),
  });
  const envelope = (await response.json()) as
    | { ok: true; data: T; meta: CapabilityMetaShape }
    | { ok: false; error: CapabilityErrorShape };
  if (!envelope.ok) throw new CapabilityHttpError(envelope.error);
  return { data: envelope.data, meta: envelope.meta };
}
