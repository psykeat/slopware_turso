import type { TelemetrySnapshot } from "@repo/ui/platform/telemetry-context";

export interface FeedbackSnapshot {
  url: string;
  userAgent: string;
  viewport: { width: number; height: number };
  userId: string;
  tenantId: string;
  locale: string;
  lastError: { message: string; stack?: string } | null;
  timestamp: string;
  focusState: { entity?: string; recordId?: string; panelId?: string };
  telemetry: TelemetrySnapshot;
}

export function captureFeedbackSnapshot(
  userId: string,
  tenantId: string,
  locale: string,
  focusState: { entity?: string; recordId?: string; panelId?: string },
  lastError: { message: string; stack?: string } | null,
  telemetry: TelemetrySnapshot,
): FeedbackSnapshot {
  return {
    url: typeof window !== "undefined" ? window.location.href : "",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    viewport:
      typeof window !== "undefined"
        ? { width: window.innerWidth, height: window.innerHeight }
        : { width: 0, height: 0 },
    userId,
    tenantId,
    locale,
    lastError,
    timestamp: new Date().toISOString(),
    focusState,
    telemetry,
  };
}
