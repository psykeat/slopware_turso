import { MailPlusIcon, RefreshCcwIcon } from "lucide-react";
import { useState } from "react";

interface MailComposeDraftPanelProps {
  to: string[];
  subject: string;
  context?: string;
  onClose: () => void;
}

export function MailComposeDraftPanel({ to, subject, context, onClose }: MailComposeDraftPanelProps) {
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatedBody, setGeneratedBody] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    setGeneratedBody(null);
    try {
      const res = await fetch("/api/ai/compose-draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          to,
          subject,
          context: context ? context.slice(0, 500) : undefined,
          instruction: instruction.trim() || undefined,
          language: "de",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? `Fehler ${res.status}`);
        return;
      }
      const data = (await res.json()) as { body: string };
      setGeneratedBody(data.body);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  };

  const apply = () => {
    if (!generatedBody) return;
    window.dispatchEvent(
      new CustomEvent("slopware:open-email-draft", {
        detail: { body: generatedBody },
      }),
    );
    onClose();
  };

  return (
    <div className="space-y-4 py-2">
      {/* Header info */}
      <div className="flex items-center gap-2 text-[13px] text-ink-mute">
        <MailPlusIcon className="size-4 text-primary" />
        <span className="font-medium text-ink">Mail verfassen</span>
      </div>

      <div className="space-y-1 rounded-md border border-hairline bg-canvas-soft px-3 py-2 text-[12px]">
        <div className="text-ink-mute">Empfänger</div>
        <div className="font-medium text-ink">{to.join(", ") || "—"}</div>
        <div className="mt-1 text-ink-mute">Betreff</div>
        <div className="font-medium text-ink">{subject || "—"}</div>
      </div>

      {/* Instruction input */}
      <div className="space-y-1">
        <label htmlFor="ai-compose-instruction" className="text-[11px] font-semibold tracking-wider text-ink-mute uppercase">
          Hinweis für die KI (optional)
        </label>
        <textarea
          id="ai-compose-instruction"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder={'z.B. "kurz halten", "formal", "freundlich und persönlich"'}
          rows={2}
          className="w-full resize-none rounded-md border border-hairline bg-canvas px-3 py-2 text-[12px] text-ink placeholder:text-ink-mute focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
      </div>

      {/* Generate button */}
      {!generatedBody && (
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="flex h-9 w-full items-center justify-center gap-1.5 rounded-sm bg-primary text-[12px] font-medium text-primary-fg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <RefreshCcwIcon className="size-4 animate-spin" />
              <span>Wird generiert…</span>
            </>
          ) : (
            <span>Entwurf generieren</span>
          )}
        </button>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-md border border-destructive/20 bg-[color-mix(in_oklab,var(--destructive)_8%,transparent)] px-3 py-2 text-[12px] text-destructive">
          {error}
        </div>
      )}

      {/* Preview */}
      {generatedBody && (
        <div className="space-y-3">
          <div className="text-[11px] font-semibold tracking-wider text-ink-mute uppercase">
            Generierter Entwurf
          </div>
          <div className="max-h-64 overflow-y-auto rounded-md border border-hairline bg-canvas-soft px-3 py-2 text-[12px] leading-relaxed whitespace-pre-wrap text-ink">
            {generatedBody}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={apply}
              className="flex h-9 flex-1 items-center justify-center rounded-sm bg-primary text-[12px] font-medium text-primary-fg hover:opacity-90"
            >
              Übernehmen
            </button>
            <button
              type="button"
              onClick={generate}
              disabled={loading}
              className="flex h-9 items-center justify-center gap-1 rounded-sm border border-hairline px-3 text-[12px] text-ink-secondary hover:bg-canvas-soft disabled:opacity-50"
            >
              {loading ? (
                <RefreshCcwIcon className="size-3.5 animate-spin" />
              ) : (
                <RefreshCcwIcon className="size-3.5" />
              )}
              <span>Neu generieren</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
