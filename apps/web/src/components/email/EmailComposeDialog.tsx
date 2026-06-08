import { Dialog, DialogContent } from "@repo/ui/components/dialog";
import { EmailComposer } from "@repo/ui/components/email-composer";
import { XIcon } from "lucide-react";
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

import { RecipientAutosuggest } from "./RecipientAutosuggest";

export function EmailComposeDialog({
  open,
  title = "Compose email",
  identities,
  value,
  mode,
  attachments,
  notice,
  busy,
  onClose,
  onSubmit,
}: EmailComposeDialogProps) {
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
              await onSubmit("send", {
                identityId: data.fromEmail || value.identityId,
                to: data.to,
                cc: data.cc || "",
                bcc: data.bcc || "",
                subject: data.subject,
                bodyText: data.message,
                bodyHtml: data.message,
                mode: "html",
                attachments: attachments || [],
              });
            }}
            onSaveDraft={async (data) => {
              await onSubmit("save-draft", {
                identityId: data.fromEmail || value.identityId,
                to: data.to,
                cc: data.cc || "",
                bcc: data.bcc || "",
                subject: data.subject,
                bodyText: data.message,
                bodyHtml: data.message,
                mode: "html",
                attachments: attachments || [],
              });
            }}
            onScheduleSend={async (data, date) => {
              await onSubmit("queue", {
                identityId: data.fromEmail || value.identityId,
                to: data.to,
                cc: data.cc || "",
                bcc: data.bcc || "",
                subject: data.subject,
                bodyText: data.message,
                bodyHtml: data.message,
                mode: "html",
                attachments: attachments || [],
                // @ts-expect-error backend expects this for queueing
                scheduleAt: date.toISOString(),
              });
            }}
            onAiGenerate={async () => {
              window.dispatchEvent(new CustomEvent("slopware:open-ai"));
              return "";
            }}
            onAttachmentsChange={async (newAttachments) => {
               // We will need a storage upload endpoint to handle new Files before appending to attachments.
               // Currently, the dialog holds server-side attachments via the `attachments` prop.
               toast.info("Neue Anhänge hochladen wird noch vom Backend vorbereitet.");
            }}
            attachments={attachments}
            isLoading={busy}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
