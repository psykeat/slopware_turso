import { XIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

interface FeedbackSnapshot {
  url: string;
  userId: string;
  tenantId: string;
  locale: string;
  focusState: unknown;
  lastError: unknown;
  timestamp: string;
  viewport: unknown;
  userAgent: string;
  telemetry?: unknown;
}

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
  snapshot: FeedbackSnapshot;
}

type Status = "idle" | "loading" | "success" | "error";

export function FeedbackModal({ open, onClose, snapshot }: FeedbackModalProps) {
  const { t } = useTranslation("ui");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [issueUrl, setIssueUrl] = useState<string | null>(null);

  // Escape key to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const handleClose = () => {
    setDescription("");
    setStatus("idle");
    setIssueUrl(null);
    onClose();
  };

  const handleSubmit = async () => {
    setStatus("loading");
    try {
      const res = await fetch("/api/feedback/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot, description }),
      });
      const data = (await res.json()) as {
        configMissing?: boolean;
        issueUrl?: string;
        error?: string;
      };
      if (data.configMissing) {
        setStatus("error");
        setDescription(t("feedback.notConfigured"));
      } else if (data.issueUrl) {
        setIssueUrl(data.issueUrl);
        setStatus("success");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  const handleRetry = () => {
    setStatus("idle");
    setDescription("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="flex w-full max-w-lg flex-col gap-4 rounded-xl bg-canvas p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-medium text-ink">{t("feedback.title")}</h2>
          <button
            onClick={handleClose}
            className="grid size-7 place-items-center rounded-md text-ink-secondary transition-colors hover:bg-canvas-soft hover:text-ink"
            aria-label="Close"
          >
            <XIcon className="size-4" />
          </button>
        </div>

        {status === "success" ? (
          /* Success state */
          <div className="flex flex-col gap-3">
            <p className="text-[13px] text-ink">{t("feedback.success")}</p>
            {issueUrl && (
              <a
                href={issueUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13px] break-all text-primary underline"
              >
                {issueUrl}
              </a>
            )}
            <button
              onClick={handleClose}
              className="h-8 self-end rounded-md bg-canvas-soft px-4 text-[13px] text-ink transition-colors hover:bg-hairline"
            >
              {t("actions.close")}
            </button>
          </div>
        ) : status === "error" ? (
          /* Error state */
          <div className="flex flex-col gap-3">
            <p className="text-[13px] text-destructive">{t("feedback.error")}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={handleClose}
                className="h-8 rounded-md bg-canvas-soft px-4 text-[13px] text-ink transition-colors hover:bg-hairline"
              >
                {t("actions.close")}
              </button>
              <button
                onClick={handleRetry}
                className="h-8 rounded-md px-4 text-[13px] text-primary-fg transition-colors"
                style={{ background: "var(--primary)" }}
              >
                {t("feedback.retry")}
              </button>
            </div>
          </div>
        ) : (
          /* Idle / Loading state */
          <>
            <textarea
              className="h-32 resize-none rounded-md border border-hairline-input bg-canvas-soft px-3 py-2 text-[13px] text-ink placeholder:text-ink-mute focus:ring-1 focus:ring-primary focus:outline-none"
              placeholder={t("feedback.placeholder")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              minLength={10}
              required
              disabled={status === "loading"}
            />

            {/* Collapsible context */}
            <details className="text-[12px]">
              <summary className="cursor-pointer text-ink-secondary select-none hover:text-ink">
                {t("feedback.contextLabel")}
              </summary>
              <pre className="mt-2 max-h-40 overflow-auto rounded bg-canvas-soft p-2 text-xs text-ink-mute">
                {JSON.stringify(snapshot, null, 2)}
              </pre>
            </details>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <button
                onClick={handleClose}
                disabled={status === "loading"}
                className="h-8 rounded-md bg-canvas-soft px-4 text-[13px] text-ink transition-colors hover:bg-hairline disabled:opacity-50"
              >
                {t("actions.cancel")}
              </button>
              <button
                onClick={handleSubmit}
                disabled={description.length < 10 || status === "loading"}
                className="h-8 rounded-md px-4 text-[13px] text-primary-fg transition-colors disabled:opacity-40"
                style={{ background: "var(--primary)" }}
              >
                {status === "loading" ? t("feedback.submitting") : t("feedback.submit")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
