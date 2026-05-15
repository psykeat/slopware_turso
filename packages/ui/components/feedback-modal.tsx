import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { XIcon } from "lucide-react";

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
      <div className="bg-canvas rounded-xl shadow-xl w-full max-w-lg p-6 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-medium text-ink">
            {t("feedback.title")}
          </h2>
          <button
            onClick={handleClose}
            className="size-7 grid place-items-center rounded-md text-ink-secondary hover:bg-canvas-soft hover:text-ink transition-colors"
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
                className="text-[13px] text-primary underline break-all"
              >
                {issueUrl}
              </a>
            )}
            <button
              onClick={handleClose}
              className="self-end h-8 px-4 rounded-md bg-canvas-soft text-[13px] text-ink hover:bg-hairline transition-colors"
            >
              {t("actions.close")}
            </button>
          </div>
        ) : status === "error" ? (
          /* Error state */
          <div className="flex flex-col gap-3">
            <p className="text-[13px] text-destructive">{t("feedback.error")}</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleClose}
                className="h-8 px-4 rounded-md bg-canvas-soft text-[13px] text-ink hover:bg-hairline transition-colors"
              >
                {t("actions.close")}
              </button>
              <button
                onClick={handleRetry}
                className="h-8 px-4 rounded-md text-[13px] text-primary-fg transition-colors"
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
              className="h-32 resize-none rounded-md border border-hairline-input bg-canvas-soft px-3 py-2 text-[13px] text-ink placeholder:text-ink-mute focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder={t("feedback.placeholder")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              minLength={10}
              required
              disabled={status === "loading"}
            />

            {/* Collapsible context */}
            <details className="text-[12px]">
              <summary className="cursor-pointer text-ink-secondary hover:text-ink select-none">
                {t("feedback.contextLabel")}
              </summary>
              <pre className="text-xs overflow-auto max-h-40 bg-canvas-soft p-2 rounded mt-2 text-ink-mute">
                {JSON.stringify(snapshot, null, 2)}
              </pre>
            </details>

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleClose}
                disabled={status === "loading"}
                className="h-8 px-4 rounded-md bg-canvas-soft text-[13px] text-ink hover:bg-hairline transition-colors disabled:opacity-50"
              >
                {t("actions.cancel")}
              </button>
              <button
                onClick={handleSubmit}
                disabled={description.length < 10 || status === "loading"}
                className="h-8 px-4 rounded-md text-[13px] text-primary-fg transition-colors disabled:opacity-40"
                style={{ background: "var(--primary)" }}
              >
                {status === "loading"
                  ? t("feedback.submitting")
                  : t("feedback.submit")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
