import type { z } from "zod";

export type ActorMode = "user" | "assistant" | "system" | "test" | "external";

export type CapabilityModule = "masterdata" | "sales" | "logistics" | "accounting" | "system";

export type CapabilityKind = "read" | "create" | "update" | "archive" | "process";

export type CapabilityRole = "tenant_user" | "tenant_admin";

export type LlmExposure = "safe" | "confirm" | "hidden";

export interface LocalizedText {
  en: string;
  de: string;
}

// Built strictly server-side (session, API-key metadata, or test fixture).
// Never construct one of these from client-provided payload fields.
export interface ExecutionContext {
  tenantId: string;
  organizationId: string;
  userId: string | null;
  actorMode: ActorMode;
  role: CapabilityRole | "system";
  requestId?: string;
  dryRun?: boolean;
}

export interface CapabilityExposure {
  llm: LlmExposure;
  http: boolean;
  ui?: { placement?: string; icon?: string };
}

export interface CapabilityDefinition<
  I extends z.ZodType = z.ZodType,
  O extends z.ZodType = z.ZodType,
> {
  /** Always `${module}.${entityName}.${operation}` — derived by defineCapability. */
  key: string;
  module: CapabilityModule;
  /** Schema export name of the primary entity, e.g. "articleVariantTemplate". */
  entityName: string;
  operation: string;
  kind: CapabilityKind;
  summary: LocalizedText;
  description?: LocalizedText;
  input: I;
  output: O;
  /** Entity names of tables the handler writes beyond the primary entity's obvious write. */
  writesTables: string[];
  sideEffects: string[];
  idempotent: boolean;
  supportsDryRun: boolean;
  minRole: CapabilityRole;
  exposure: CapabilityExposure;
  /** Bump only on breaking input/output changes; additive-optional changes don't count. */
  schemaVersion: number;
  handler: (ctx: ExecutionContext, input: z.output<I>) => Promise<z.output<O>>;
}

export type AnyCapability = CapabilityDefinition;

export type CapabilityErrorCode =
  | "unknown_capability"
  | "forbidden"
  | "validation"
  | "not_found"
  | "conflict"
  | "internal";

export interface CapabilityIssue {
  path: string;
  message: string;
}

export interface CapabilityMeta {
  capability: string;
  schemaVersion: number;
  dryRun: boolean;
  durationMs: number;
}

export type CapabilityResult<T = unknown> =
  | { ok: true; data: T; meta: CapabilityMeta }
  | {
      ok: false;
      error: { code: CapabilityErrorCode; message: string; issues?: CapabilityIssue[] };
    };

export class CapabilityError extends Error {
  readonly code: Exclude<CapabilityErrorCode, "internal" | "unknown_capability">;
  readonly issues?: CapabilityIssue[];

  constructor(
    code: Exclude<CapabilityErrorCode, "internal" | "unknown_capability">,
    message: string,
    issues?: CapabilityIssue[],
  ) {
    super(message);
    this.name = "CapabilityError";
    this.code = code;
    this.issues = issues;
  }
}

// userTenant.role is free text ("owner", "admin", ...); collapse it to the
// two-level capability vocabulary so minRole checks stay simple.
export function toCapabilityRole(rawRole: string | null | undefined): CapabilityRole {
  if (rawRole === "owner" || rawRole === "admin" || rawRole === "tenant_admin") {
    return "tenant_admin";
  }
  return "tenant_user";
}
