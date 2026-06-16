import { Dialog, DialogContent } from "@repo/ui/components/dialog";
import { EmailComposer } from "@repo/ui/components/email-composer";
import { XIcon } from "lucide-react";
import { useState } from "react";
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

export type EmailComposeTemplate = {
  emailTemplateId: string;
  name: string;
  code: string;
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
  templates?: EmailComposeTemplate[];
  selectedTemplateId?: string | null;
  onTemplateChange?: (templateId: string | null) => void;
  onClose: () => void;
  onSubmit: (action: EmailComposeAction, value: EmailComposeSubmitValue) => Promise<void> | void;
};

import { RecipientAutosuggest } from "./RecipientAutosuggest";

export function EmailComposeDialog({
  open,
  title = "Compose email",
  identities,
  value,
  _mode,
  attachments,
  notice,
  busy,
  templates,
  selectedTemplateId,
  onTemplateChange,
  onClose,
  onSubmit,
}: EmailComposeDialogProps) {
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);

  const uploadPendingFiles = async (): Promise<EmailComposeAttachment[]> => {
    if (pendingFiles.length === 0) return [];
    setUploadingAttachments(true);
    const uploaded: EmailComposeAttachment[] = [];
    try {
      for (const file of pendingFiles) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/email/attachments/upload", {
          method: "POST",
          body: form,
        });
        if (!res.ok) throw new Error(`Upload fehlgeschlagen: ${file.name}`);
        const data = (await res.json()) as {
          fileName: string;
          contentType: string;
          sizeBytes: number;
          storageKey: string;
        };
        uploaded.push({
          fileName: data.fileName,
          contentType: data.contentType,
          sizeBytes: data.sizeBytes,
          storageKey: data.storageKey,
        });
      }
    } finally {
      setUploadingAttachments(false);
    }
    return uploaded;
  };

  const buildAttachments = async (): Promise<EmailComposeAttachment[]> => {
    const uploaded = await uploadPendingFiles();
    return [...(attachments || []), ...uploaded];
  };

  const handleAttachmentsChange = (files: File[]) => {
    setPendingFiles((prev) => [...prev, ...files]);
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex h-[80vh] max-h-[800px] w-[90vw] max-w-4xl flex-col gap-0 overflow-hidden p-0">
        <div className="flex h-11 items-center justify-between border-b border-border px-3 bg-muted/30">
          <div className="min-w-0 text-sm font-medium">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-7 place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Close"
          >
            <XIcon className="size-4" />
          </button>
        </div>

        {notice && (
          <div className="bg-amber-50 px-4 py-2 text-sm text-amber-900 border-b">
            {notice}
          </div>
        )}

        {templates && templates.length > 0 && onTemplateChange && (
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <label htmlFor="email-compose-template" className="text-xs text-muted-foreground">
              Vorlage
            </label>
            <select
              id="email-compose-template"
              value={selectedTemplateId ?? ""}
              disabled={busy}
              onChange={(event) => onTemplateChange(event.target.value || null)}
              className="h-7 rounded border border-border bg-background px-2 text-xs outline-none disabled:opacity-50"
            >
              <option value="">Automatisch (Belegart)</option>
              {templates.map((template) => (
                <option key={template.emailTemplateId} value={template.emailTemplateId}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          <EmailComposer
            renderRecipientInput={(props) => <RecipientAutosuggest {...props} />}
            initialData={{
              to: value.to,
              cc: value.cc,
              bcc: value.bcc,
              subject: value.subject,
              message: value.bodyHtml || value.bodyText,
              fromEmail: value.identityId,
            }}
            availableAliases={identities.map((id) => ({
              email: id.email,
              name: id.displayName || undefined,
              primary: id.emailIdentityId === value.identityId,
            }))}
            onSend={async (data) => {
              let allAttachments: EmailComposeAttachment[];
              try {
                allAttachments = await buildAttachments();
              } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : "Upload fehlgeschlagen";
                toast.error(msg);
                return;
              }
              await onSubmit("send", {
                identityId: data.fromEmail || value.identityId,
                to: data.to,
                cc: data.cc || "",
                bcc: data.bcc || "",
                subject: data.subject,
                bodyText: data.message,
                bodyHtml: data.message,
                mode: "html",
                attachments: allAttachments,
              });
            }}
            onSaveDraft={async (data) => {
              let allAttachments: EmailComposeAttachment[];
              try {
                allAttachments = await buildAttachments();
              } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : "Upload fehlgeschlagen";
                toast.error(msg);
                return;
              }
              await onSubmit("save-draft", {
                identityId: data.fromEmail || value.identityId,
                to: data.to,
                cc: data.cc || "",
                bcc: data.bcc || "",
                subject: data.subject,
                bodyText: data.message,
                bodyHtml: data.message,
                mode: "html",
                attachments: allAttachments,
              });
            }}
            onScheduleSend={async (data, date) => {
              let allAttachments: EmailComposeAttachment[];
              try {
                allAttachments = await buildAttachments();
              } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : "Upload fehlgeschlagen";
                toast.error(msg);
                return;
              }
              await onSubmit("queue", {
                identityId: data.fromEmail || value.identityId,
                to: data.to,
                cc: data.cc || "",
                bcc: data.bcc || "",
                subject: data.subject,
                bodyText: data.message,
                bodyHtml: data.message,
                mode: "html",
                attachments: allAttachments,
                // @ts-expect-error backend expects this for queueing
                scheduleAt: date.toISOString(),
              });
            }}
            onAiGenerate={async () => {
              window.dispatchEvent(new CustomEvent("slopware:open-ai"));
              return "";
            }}
            onAttachmentsChange={handleAttachmentsChange}
            attachments={[
              ...(attachments || []),
              ...pendingFiles.map((f) => ({ fileName: f.name, sizeBytes: f.size })),
            ]}
            isLoading={busy || uploadingAttachments}
          />
        </div>

        {pendingFiles.length > 0 && (
          <div className="border-t border-border px-3 py-2 flex flex-wrap gap-2">
            {pendingFiles.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center gap-1.5 rounded bg-muted px-2 py-1 text-xs text-muted-foreground"
              >
                <span className="max-w-[160px] truncate text-foreground">{file.name}</span>
                <span>{formatBytes(file.size)}</span>
                <button
                  type="button"
                  onClick={() => removePendingFile(index)}
                  className="ml-0.5 grid size-4 place-items-center rounded-sm hover:bg-muted-foreground/20 hover:text-foreground"
                  title={`Remove ${file.name}`}
                >
                  <XIcon className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
