import { Button } from "@repo/ui/components/button";
import { Dialog, DialogContent } from "@repo/ui/components/dialog";
import { cn } from "@repo/ui/lib/utils";
import { CheckIcon, ClockIcon, MailIcon, SendIcon, XIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export type EmailComposeMode = "plain" | "html";
export type EmailComposeAction = "save-draft" | "provider-draft" | "queue" | "send";

export type EmailComposeIdentity = {
  emailIdentityId: string;
  emailAccountId?: string;
  email: string;
  displayName?: string | null;
  canSend?: boolean;
};

export type EmailComposeAttachment = {
  fileName: string;
  contentType: string;
  providerAttachmentId?: string | null;
  storageKey?: string | null;
  sizeBytes?: number | null;
  inlineContentId?: string | null;
  readOnly?: boolean;
};

export type EmailComposeValue = {
  identityId: string;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
};

export type EmailComposeSubmitValue = EmailComposeValue & {
  mode: EmailComposeMode;
  attachments: EmailComposeAttachment[];
};

type EmailComposeDialogProps = {
  open: boolean;
  title?: string;
  identities: EmailComposeIdentity[];
  value: EmailComposeValue;
  mode?: EmailComposeMode;
  attachments?: EmailComposeAttachment[];
  notice?: string | null;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (action: EmailComposeAction, value: EmailComposeSubmitValue) => Promise<void> | void;
};

function htmlToText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function formatBytes(value: number | null | undefined) {
  if (!value || !Number.isFinite(value)) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function hasAnyRecipient(value: EmailComposeValue) {
  return [value.to, value.cc, value.bcc].some((part) =>
    part.split(",").some((email) => email.trim()),
  );
}

export function EmailComposeDialog({
  open,
  title = "Compose email",
  identities,
  value,
  mode = "plain",
  attachments = [],
  notice,
  busy,
  onClose,
  onSubmit,
}: EmailComposeDialogProps) {
  const [draft, setDraft] = useState<EmailComposeValue>(value);
  const [composeMode, setComposeMode] = useState<EmailComposeMode>(mode);
  const [attachmentRows, setAttachmentRows] = useState<EmailComposeAttachment[]>(attachments);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/email/attachments/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          throw new Error(await res.text());
        }

        const result = await res.json();
        setAttachmentRows((prev) => [
          ...prev,
          {
            fileName: result.fileName,
            contentType: result.contentType,
            sizeBytes: result.sizeBytes,
            storageKey: result.storageKey,
          },
        ]);
        toast.success(`Uploaded ${file.name}`);
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to upload file");
    } finally {
      setUploading(false);
      event.target.value = ""; // Reset
    }
  };

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setDraft(value);
      setComposeMode(mode);
      setAttachmentRows(attachments);
    });
  }, [attachments, mode, open, value]);

  const selectedIdentityId = draft.identityId || identities[0]?.emailIdentityId || "";
  const canAddAttachments = useMemo(
    () => attachmentRows.every((attachment) => !attachment.readOnly),
    [attachmentRows],
  );

  const submit = async (action: EmailComposeAction) => {
    const next = {
      ...draft,
      identityId: selectedIdentityId,
      bodyHtml: composeMode === "html" ? draft.bodyHtml : draft.bodyText.replace(/\n/g, "<br />"),
      bodyText: composeMode === "html" ? htmlToText(draft.bodyHtml) : draft.bodyText,
    };
    if (action !== "save-draft" && !hasAnyRecipient(next)) {
      toast.error("Add at least one recipient before sending");
      return;
    }
    await onSubmit(action, { ...next, mode: composeMode, attachments: attachmentRows });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <div className="flex h-11 items-center justify-between border-b border-hairline px-3">
          <div className="min-w-0 truncate text-[13px] font-medium text-ink">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-7 place-items-center rounded-sm text-ink-secondary hover:bg-canvas-soft hover:text-ink"
            title="Close"
          >
            <XIcon className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <div className="mx-auto flex max-w-3xl flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <select
                value={selectedIdentityId}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, identityId: event.target.value }))
                }
                className="h-9 min-w-0 flex-1 rounded-sm border border-hairline bg-canvas px-2 text-[13px] outline-none focus:border-primary"
              >
                {identities.map((identity) => (
                  <option key={identity.emailIdentityId} value={identity.emailIdentityId}>
                    {identity.displayName || identity.email}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-1">
                {(["plain", "html"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={cn(
                      "rounded-sm border px-2 py-1 text-[12px]",
                      composeMode === item
                        ? "border-primary bg-[color-mix(in_oklab,var(--primary)_9%,transparent)] text-ink"
                        : "border-hairline text-ink-secondary",
                    )}
                    onClick={() => setComposeMode(item)}
                  >
                    {item === "plain" ? "Plain" : "HTML"}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-sm border border-hairline bg-canvas-soft px-2 py-1 text-[11px] text-ink-mute">
              Save Draft keeps the local draft editable. Provider Draft writes the provider copy,
              Queue defers send, and Send dispatches immediately.
            </div>
            {notice && (
              <div className="rounded-sm border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                {notice}
              </div>
            )}
            <input
              value={draft.to}
              onChange={(event) => setDraft((prev) => ({ ...prev, to: event.target.value }))}
              placeholder="To"
              className="h-9 rounded-sm border border-hairline bg-canvas px-2 text-[13px] outline-none focus:border-primary"
            />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                value={draft.cc}
                onChange={(event) => setDraft((prev) => ({ ...prev, cc: event.target.value }))}
                placeholder="Cc"
                className="h-9 rounded-sm border border-hairline bg-canvas px-2 text-[13px] outline-none focus:border-primary"
              />
              <input
                value={draft.bcc}
                onChange={(event) => setDraft((prev) => ({ ...prev, bcc: event.target.value }))}
                placeholder="Bcc"
                className="h-9 rounded-sm border border-hairline bg-canvas px-2 text-[13px] outline-none focus:border-primary"
              />
            </div>
            <input
              value={draft.subject}
              onChange={(event) => setDraft((prev) => ({ ...prev, subject: event.target.value }))}
              placeholder="Subject"
              className="h-9 rounded-sm border border-hairline bg-canvas px-2 text-[13px] outline-none focus:border-primary"
            />
            {composeMode === "plain" ? (
              <textarea
                value={draft.bodyText}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    bodyText: event.target.value,
                    bodyHtml: event.target.value.replace(/\n/g, "<br />"),
                  }))
                }
                placeholder="Message"
                className="min-h-48 resize-none rounded-sm border border-hairline bg-canvas p-2 text-[13px] outline-none focus:border-primary"
              />
            ) : (
              <textarea
                value={draft.bodyHtml}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    bodyHtml: event.target.value,
                    bodyText: htmlToText(event.target.value),
                  }))
                }
                placeholder="<p>HTML message</p>"
                className="min-h-48 resize-none rounded-sm border border-hairline bg-canvas p-2 font-mono text-[12px] outline-none focus:border-primary"
              />
            )}
            <div className="rounded-sm border border-hairline bg-canvas-soft p-2">
              <div className="mb-2 flex items-center justify-between text-[11px] tracking-wider text-ink-mute uppercase">
                <span>Attachments</span>
                {canAddAttachments && (
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer rounded-sm border border-hairline bg-canvas px-2 py-1 text-[11px] text-ink-secondary hover:text-ink">
                      {uploading ? "Uploading..." : "Upload File"}
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFileChange}
                        disabled={uploading}
                      />
                    </label>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                {attachmentRows.length === 0 ? (
                  <div className="text-[12px] text-ink-mute">No attachments</div>
                ) : (
                  attachmentRows.map((attachment, index) => (
                    <div
                      key={`${attachment.fileName}-${index}`}
                      className="grid grid-cols-[1fr_auto] gap-2 rounded-sm border border-hairline bg-canvas px-2 py-1.5 text-[12px]"
                    >
                      <span className="min-w-0 truncate text-ink">{attachment.fileName}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-ink-mute">
                          {attachment.contentType} · {formatBytes(attachment.sizeBytes)}
                        </span>
                        {!attachment.readOnly && (
                          <button
                            type="button"
                            onClick={() =>
                              setAttachmentRows((prev) =>
                                prev.filter((_, itemIndex) => itemIndex !== index),
                              )
                            }
                            className="text-[11px] font-medium text-ink-secondary hover:text-ink"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-hairline p-3">
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Close
          </Button>
          <Button variant="outline" size="sm" onClick={() => submit("save-draft")} disabled={busy}>
            <CheckIcon className="size-4" />
            Save Draft
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => submit("provider-draft")}
            disabled={busy}
          >
            <MailIcon className="size-4" />
            Provider Draft
          </Button>
          <Button variant="outline" size="sm" onClick={() => submit("queue")} disabled={busy}>
            <ClockIcon className="size-4" />
            Queue
          </Button>
          <Button size="sm" onClick={() => submit("send")} disabled={busy}>
            <SendIcon className="size-4" />
            Send
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
