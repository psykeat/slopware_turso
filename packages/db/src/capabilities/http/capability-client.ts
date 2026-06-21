import { setDefaultResultOrder } from "node:dns";

import "../../scripts/load-env";

// Node fetch (undici) tries ::1 first for "localhost" and does not fall back
// to IPv4, but the Vite dev server listens on 0.0.0.0 only. Rewriting the URL
// to 127.0.0.1 would break Better Auth's origin check, so fix DNS order.
setDefaultResultOrder("ipv4first");

// Thin HTTP client for the capability surface — the ONLY allowed test path
// over HTTP. Wraps exactly the three official endpoints:
//
//   GET  /api/capabilities?module=&entityName=
//   GET  /api/capabilities/{key}
//   POST /api/capabilities/{key}/execute
//
// Auth is a real Better Auth session for the dedicated test user
// (CAPABILITY_TEST_EMAIL / CAPABILITY_TEST_PASSWORD in apps/web/.env). That
// user owns its own throwaway tenant, so HTTP smoke tests never touch base
// tenant data. No auth bypasses, no mock servers, no tenantId in any input —
// the server builds the tenant context from the session.

export interface CapabilityEnvelope<T = unknown> {
  ok: boolean;
  data?: T;
  meta?: { capability: string; schemaVersion: number; dryRun: boolean; durationMs: number };
  error?: {
    code: "unknown_capability" | "forbidden" | "validation" | "not_found" | "conflict" | "internal";
    message: string;
    issues?: { path: string; message: string }[];
  };
}

export interface CapabilityDescriptor {
  key: string;
  module: string;
  entityName: string;
  operation: string;
  kind: string;
  summary: { en: string; de: string };
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  [extra: string]: unknown;
}

export interface EntityDiscoveryDescriptor {
  name: string;
  pluralName: string;
  label: { en: string; de: string };
  module: string;
  primaryKey: string;
  tenantScoped: boolean;
  schemaVersion: number;
  projections: string[];
  [extra: string]: unknown;
}

export class CapabilityClient {
  private constructor(
    readonly baseUrl: string,
    private readonly cookie: string,
  ) {}

  /**
   * Sign in and return a ready client. Defaults to the dedicated capability
   * test user (its own isolated tenant); pass `{ email, password }` to sign in
   * as a different user instead, e.g. the base-tenant-bound dev user (see
   * `db:dev-login`).
   */
  static async login(credentials?: {
    email?: string;
    password?: string;
  }): Promise<CapabilityClient> {
    const baseUrl =
      process.env.CAPABILITY_TEST_BASE_URL ?? process.env.VITE_BASE_URL ?? "http://localhost:3000";
    const email = credentials?.email ?? process.env.CAPABILITY_TEST_EMAIL;
    const password = credentials?.password ?? process.env.CAPABILITY_TEST_PASSWORD;
    if (!email || !password) {
      throw new Error(
        "CAPABILITY_TEST_EMAIL / CAPABILITY_TEST_PASSWORD missing in apps/web/.env — see AI_TESTING.md",
      );
    }

    let response: Response;
    try {
      // Explicit Origin: undici sends `Origin: null` on POST, which Better
      // Auth's CSRF check rejects (MISSING_OR_NULL_ORIGIN).
      response = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: baseUrl },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      throw new Error(`Dev server not reachable at ${baseUrl} — start it with \`pnpm dev\``);
    }
    if (!response.ok) {
      throw new Error(`Test login failed (${response.status}) for ${email} at ${baseUrl}`);
    }

    const cookie = response.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    if (!cookie) throw new Error("Test login returned no session cookie");

    return new CapabilityClient(baseUrl, cookie);
  }

  /** Raw `Cookie` header value for this session — for handing it to curl or a browser (see `db:dev-login`). */
  get cookieHeader(): string {
    return this.cookie;
  }

  private async request(path: string, init?: RequestInit): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        cookie: this.cookie,
        "content-type": "application/json",
        origin: this.baseUrl,
        ...init?.headers,
      },
    });
  }

  /** GET /api/capabilities — discovery, optionally filtered. */
  async listCapabilities(filter?: {
    module?: string;
    entityName?: string;
  }): Promise<CapabilityDescriptor[]> {
    const params = new URLSearchParams();
    if (filter?.module) params.set("module", filter.module);
    if (filter?.entityName) params.set("entityName", filter.entityName);
    const qs = params.size > 0 ? `?${params}` : "";
    const response = await this.request(`/api/capabilities${qs}`);
    if (!response.ok) throw new Error(`Discovery failed: ${response.status}`);
    const body = (await response.json()) as { capabilities: CapabilityDescriptor[] };
    return body.capabilities;
  }

  /** GET /api/capabilities — entity metadata discovery from the same official surface. */
  async discoverEntities(filter?: {
    module?: string;
    entityName?: string;
  }): Promise<EntityDiscoveryDescriptor[]> {
    const params = new URLSearchParams();
    if (filter?.module) params.set("module", filter.module);
    if (filter?.entityName) params.set("entityName", filter.entityName);
    const qs = params.size > 0 ? `?${params}` : "";
    const response = await this.request(`/api/capabilities${qs}`);
    if (!response.ok) throw new Error(`Entity discovery failed: ${response.status}`);
    const body = (await response.json()) as { entities?: EntityDiscoveryDescriptor[] };
    return body.entities ?? [];
  }

  /** GET /api/capabilities/{key} — full descriptor incl. outputSchema, or null on 404. */
  async getCapability(key: string): Promise<CapabilityDescriptor | null> {
    const response = await this.request(`/api/capabilities/${key}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Descriptor fetch for "${key}" failed: ${response.status}`);
    return (await response.json()) as CapabilityDescriptor;
  }

  /**
   * POST /api/capabilities/{key}/execute — returns the CapabilityResult
   * envelope verbatim (also for non-2xx; the HTTP status mirrors error.code).
   */
  async executeCapability<T = unknown>(
    key: string,
    input: unknown,
    options?: { dryRun?: boolean; idempotencyKey?: string },
  ): Promise<CapabilityEnvelope<T>> {
    const response = await this.request(`/api/capabilities/${key}/execute`, {
      method: "POST",
      body: JSON.stringify({ input, ...options }),
    });
    return (await response.json()) as CapabilityEnvelope<T>;
  }
}
