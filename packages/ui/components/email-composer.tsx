import { useForm } from "@tanstack/react-form";
import { ChevronDown, Clock, Loader2, Paperclip, Send, Sparkles } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/utils";
import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { Input } from "./input";
import { RichTextEditor } from "./rich-text-editor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

export interface EmailPayload {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  message: string;
  fromEmail?: string;
}

export interface EmailComposerProps {
  initialData?: Partial<EmailPayload>;
  availableAliases?: { email: string; name?: string; primary?: boolean }[];
  onSend: (data: EmailPayload) => Promise<void>;
  onSaveDraft?: (data: EmailPayload) => Promise<void>;
  onScheduleSend?: (data: EmailPayload, date: Date) => Promise<void>;
  onAiGenerate?: (prompt: string) => Promise<string>;
  onAttachmentsChange?: (attachments: File[]) => void;
  renderRecipientInput?: (props: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    name: string;
  }) => React.ReactNode;
  attachments?: { fileName: string; sizeBytes?: number | null }[];
  isLoading?: boolean;
  className?: string;
}

export function EmailComposer({
  initialData,
  availableAliases,
  onSend,
  onSaveDraft,
  onScheduleSend,
  onAiGenerate,
  onAttachmentsChange,
  renderRecipientInput,
  attachments,
  isLoading = false,
  className,
}: EmailComposerProps) {
  const [showLeaveConfirmation, setShowLeaveConfirmation] = React.useState(false);
  const [aiIsLoading, setAiIsLoading] = React.useState(false);
  const [composeMode, setComposeMode] = React.useState<"plain" | "html">("html");

  const defaultFrom =
    initialData?.fromEmail ??
    availableAliases?.find((a) => a.primary)?.email ??
    availableAliases?.[0]?.email ??
    "";

  // @ts-ignore
  const form = useForm<EmailPayload>({
    defaultValues: {
      to: initialData?.to ?? "",
      cc: initialData?.cc ?? "",
      bcc: initialData?.bcc ?? "",
      subject: initialData?.subject ?? "",
      message: initialData?.message ?? "",
      fromEmail: defaultFrom,
    },
    onSubmit: async ({ value }) => {
      await onSend(value);
    },
  });

  const handleAiGenerate = async () => {
    if (!onAiGenerate) {
      window.dispatchEvent(new CustomEvent("slopware:open-ai"));
      return;
    }
    setAiIsLoading(true);
    try {
      const subject = form.getFieldValue("subject");
      const message = form.getFieldValue("message");
      const prompt = `Subject: ${subject}\n\n${message}`;
      const newBody = await onAiGenerate(prompt);
      if (newBody) {
        form.setFieldValue("message", newBody);
      }
    } catch (error) {
      console.error("AI Generation failed", error);
    } finally {
      setAiIsLoading(false);
    }
  };

  // Workaround for tanstack/react-form types if needed
  const Subscribe = form.Subscribe as any;

  return (
    <div className={cn("flex h-full flex-col overflow-hidden bg-background", className)}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
        className="flex h-full flex-col"
      >
        {/* Header Fields */}
        <div className="flex flex-col gap-0 border-b">
          <form.Field name="fromEmail">
            {(field: any) => (
              <div className="flex items-center border-b px-4 py-2 focus-within:bg-muted/50">
                <span className="w-16 text-sm font-medium text-muted-foreground">From:</span>
                <Select value={field.state.value} onValueChange={(val) => field.handleChange(val)}>
                  <SelectTrigger className="h-7 w-fit border-0 bg-transparent px-2 shadow-none hover:bg-muted/50 focus:ring-0 data-[state=open]:bg-muted/50">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent align="start">
                    {availableAliases?.map((alias) => (
                      <SelectItem key={alias.email} value={alias.email}>
                        {alias.name ? `${alias.name} (${alias.email})` : alias.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>
          <form.Field name="to">
            {(field: any) => (
              <div className="flex items-center border-b px-4 py-2 focus-within:bg-muted/50">
                <span className="w-16 text-sm font-medium text-muted-foreground">To:</span>
                {renderRecipientInput ? (
                  renderRecipientInput({
                    value: field.state.value,
                    onChange: field.handleChange,
                    placeholder: "recipient@example.com",
                    name: "to",
                  })
                ) : (
                  <Input
                    className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                    placeholder="recipient@example.com"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                )}
              </div>
            )}
          </form.Field>
          <form.Field name="cc">
            {(field: any) => (
              <div className="flex items-center border-b px-4 py-2 focus-within:bg-muted/50">
                <span className="w-16 text-sm font-medium text-muted-foreground">Cc:</span>
                {renderRecipientInput ? (
                  renderRecipientInput({
                    value: field.state.value,
                    onChange: field.handleChange,
                    placeholder: "Optional",
                    name: "cc",
                  })
                ) : (
                  <Input
                    className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                    placeholder="Optional"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                )}
              </div>
            )}
          </form.Field>
          <form.Field name="bcc">
            {(field: any) => (
              <div className="flex items-center border-b px-4 py-2 focus-within:bg-muted/50">
                <span className="w-16 text-sm font-medium text-muted-foreground">Bcc:</span>
                {renderRecipientInput ? (
                  renderRecipientInput({
                    value: field.state.value,
                    onChange: field.handleChange,
                    placeholder: "Optional",
                    name: "bcc",
                  })
                ) : (
                  <Input
                    className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                    placeholder="Optional"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                )}
              </div>
            )}
          </form.Field>
          <form.Field name="subject">
            {(field: any) => (
              <div className="flex items-center px-4 py-2 focus-within:bg-muted/50">
                <span className="w-16 text-sm font-medium text-muted-foreground">Subject:</span>
                <Input
                  className="border-0 bg-transparent font-medium shadow-none focus-visible:ring-0"
                  placeholder="What is this about?"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </div>
            )}
          </form.Field>
        </div>

        {/* Attachments List */}
        {attachments && attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 border-b bg-muted/10 px-4 py-2">
            {attachments.map((file, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs shadow-sm"
              >
                <Paperclip className="size-3.5 text-muted-foreground" />
                <span className="max-w-[200px] truncate font-medium">{file.fileName}</span>
                {file.sizeBytes != null && (
                  <span className="text-[10px] text-muted-foreground">
                    ({Math.round(file.sizeBytes / 1024)} KB)
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Message Body */}
        <div className="flex-1 overflow-hidden p-4">
          <form.Field name="message">
            {(field: any) => (
              <RichTextEditor
                className="h-full border-0 focus-within:border-0"
                initialValue={field.state.value}
                mode={composeMode}
                onChange={(value) => field.handleChange(value)}
                onAttachmentsChange={onAttachmentsChange}
              />
            )}
          </form.Field>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center justify-between border-t bg-muted/20 p-3">
          <div className="flex items-center gap-2">
            {onAiGenerate && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAiGenerate}
                disabled={aiIsLoading || isLoading}
                className="gap-2"
              >
                {aiIsLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4 text-primary" />
                )}
                <span>AI Compose</span>
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground"
              disabled={isLoading}
              title="Attach file"
              onClick={() => document.getElementById("email-file-upload")?.click()}
            >
              <Paperclip className="size-4" />
            </Button>
            <input
              type="file"
              id="email-file-upload"
              className="hidden"
              multiple
              onChange={(e) => {
                if (e.target.files && onAttachmentsChange) {
                  onAttachmentsChange(Array.from(e.target.files));
                }
              }}
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="mr-1 flex items-center gap-1 border-r pr-3">
              <Button
                type="button"
                variant={composeMode === "plain" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setComposeMode("plain")}
              >
                Plain Text
              </Button>
              <Button
                type="button"
                variant={composeMode === "html" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setComposeMode("html")}
              >
                HTML
              </Button>
            </div>

            {onSaveDraft && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={async () => {
                  const values = form.state.values;
                  await onSaveDraft(values);
                }}
                disabled={isLoading}
              >
                Save Draft
              </Button>
            )}

            <Subscribe selector={(state: any) => [state.canSubmit, state.isSubmitting]}>
              {([canSubmit, isSubmitting]: [boolean, boolean]) => (
                <div className="flex items-center">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!canSubmit || isSubmitting || isLoading}
                    className={cn("gap-2 px-4", onScheduleSend && "rounded-r-none")}
                  >
                    {isSubmitting || isLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    <span>Send</span>
                  </Button>
                  {onScheduleSend && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            type="button"
                            size="sm"
                            variant="default"
                            className="rounded-l-none border-l border-primary-foreground/20 px-2"
                            disabled={!canSubmit || isSubmitting || isLoading}
                          >
                            <ChevronDown className="size-4" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            const values = form.state.values;
                            const tomorrow = new Date();
                            tomorrow.setDate(tomorrow.getDate() + 1);
                            tomorrow.setHours(8, 0, 0, 0);
                            void onScheduleSend(values, tomorrow);
                          }}
                        >
                          <Clock className="mr-2 size-4" />
                          Send Tomorrow Morning
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              )}
            </Subscribe>
          </div>
        </div>
      </form>

      <Dialog open={showLeaveConfirmation} onOpenChange={setShowLeaveConfirmation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard changes?</DialogTitle>
            <DialogDescription>
              You have unsaved changes in your email. Are you sure you want to leave? Your changes
              will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLeaveConfirmation(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => setShowLeaveConfirmation(false)}>
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
