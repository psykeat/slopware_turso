import { SiGmail } from "@icons-pack/react-simple-icons";
import { DataGrid } from "@repo/ui/components/data-grid";
import { EntityMask, type FieldDef } from "@repo/ui/components/entity-mask";
import { InspectorPanel } from "@repo/ui/components/inspector-panel";
import { NavigationTree, type TreeNode } from "@repo/ui/components/navigation-tree";
import { TriViewWorkspace } from "@repo/ui/components/triview-workspace";
import { cn } from "@repo/ui/lib/utils";
import { useActionBar } from "@repo/ui/platform/action-bar-context";
import { useAiOverlay } from "@repo/ui/platform/ai-overlay";
import { useCommands } from "@repo/ui/platform/command-registry";
import { useFocus } from "@repo/ui/platform/focus-manager";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArchiveIcon,
  // eslint-disable-next-line
  AtSignIcon,
  ClockIcon,
  FileTextIcon,
  MailIcon,
  MailOpenIcon,
  PaperclipIcon,
  PlusIcon,
  RefreshCcwIcon,
  SendIcon,
  SparklesIcon,
  TrashIcon,
  UserIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
  EmailComposeDialog,
  type EmailComposeAction,
  type EmailComposeSubmitValue,
} from "#/components/email/EmailComposeDialog";
import { entityList } from "#/lib/entity-capabilities";

export const Route = createFileRoute("/_auth/app/email")({
  component: EmailWorkspace,
});

type EmailAccount = {
  emailAccountId: string;
  provider: "gmail" | "microsoft";
  displayName: string;
  primaryEmail: string;
  status: string;
  lastSyncStatus: string;
  lastSyncError?: string | null;
  watchExpiresAt?: string | null;
};

type EmailLabel = {
  emailLabelId: string;
  providerLabelId: string;
  emailAccountId: string;
  name: string;
  kind: "system" | "folder" | "label";
  color?: string | null;
  messageCount?: number;
  unreadCount?: number;
};

type EmailThread = {
  emailThreadId: string;
  emailAccountId: string;
  subject: string | null;
  snippet: string | null;
  lastMessageAt: string | null;
  isRead: boolean;
  messageCount: number;
  senderDisplay?: string;
  hasAttachments?: boolean;
  relatedDocumentId?: string | null;
  relatedAddressId?: string | null;
  labels?: Array<{
    emailLabelId: string;
    providerLabelId: string;
    name: string;
    kind: string;
    color?: string | null;
  }>;
};

type EmailAttachment = {
  emailAttachmentId: string;
  emailMessageId?: string;
  providerAttachmentId: string | null;
  fileName: string;
  contentType: string | null;
  sizeBytes: number | null;
  storageKey: string | null;
  inlineContentId: string | null;
  fetchedAt: string | null;
};

type EmailMessage = {
  emailMessageId: string;
  fromJson: { email?: string; name?: string } | Record<string, unknown>;
  toJson: Array<{ email: string; name?: string | null }>;
  ccJson?: Array<{ email: string; name?: string | null }>;
  bccJson?: Array<{ email: string; name?: string | null }>;
  subject: string | null;
  snippet?: string | null;
  bodyHtml: string | null;
  bodyText: string | null;
  receivedAt: string | null;
  sentAt: string | null;
  providerMessageId?: string;
};

type EmailThreadDetail = EmailThread & {
  messages: EmailMessage[];
  attachments?: EmailAttachment[];
  labels?: Array<{
    emailMessageId: string;
    emailLabelId: string;
    providerLabelId: string;
    name: string;
    kind: string;
  }>;
};

type ComposerAttachment = {
  fileName: string;
  contentType: string;
  providerAttachmentId?: string | null;
  storageKey?: string | null;
  sizeBytes?: number | null;
  inlineContentId?: string | null;
};

type EmailTemplateRow = {
  emailTemplateId: string;
  category: string;
  code: string;
  name: string;
  subjectTemplate: string;
  bodyHtmlTemplate: string;
  bodyTextTemplate: string | null;
  language: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string | null;
};

type EmailTemplateBindingRow = {
  emailTemplateBindingId: string;
  emailTemplateId: string;
  documentType: string | null;
  companyId: string | null;
  language: string | null;
  emailIdentityId: string | null;
  priority: number;
  archived: boolean;
  createdAt: string;
};

type EmailTemplateRenderLogRow = {
  emailTemplateRenderLogId: string;
  emailTemplateId: string | null;
  emailTemplateBindingId: string | null;
  documentId: string | null;
  emailIdentityId: string | null;
  language: string | null;
  subject: string;
  renderedHash: string | null;
  createdAt: string;
  createdBy: string | null;
};

const TEMPLATE_FIELDS: FieldDef[] = [
  {
    key: "category",
    label: "Category",
    type: "text",
    required: true,
    helpText: "Business case, e.g. document.",
  },
  { key: "code", label: "Code", type: "text", required: true, helpText: "Stable template key." },
  { key: "name", label: "Name", type: "text", required: true, helpText: "Human-readable label." },
  {
    key: "subjectTemplate",
    label: "Subject Template",
    type: "textarea",
    required: true,
    fullWidth: true,
    helpText: "Supports {{path}} placeholders.",
  },
  {
    key: "bodyHtmlTemplate",
    label: "Body HTML Template",
    type: "textarea",
    required: true,
    fullWidth: true,
    helpText: "Rendered HTML body used for document mail preparation.",
  },
  {
    key: "bodyTextTemplate",
    label: "Body Text Template",
    type: "textarea",
    fullWidth: true,
    helpText: "Optional plain-text fallback. Leave blank to derive from HTML.",
  },
  {
    key: "language",
    label: "Language",
    type: "text",
    helpText: "Optional 2-letter language code.",
  },
];

const TEMPLATE_BINDING_FIELDS: FieldDef[] = [
  { key: "emailTemplateId", label: "Template", type: "text", required: true, readonly: true },
  { key: "documentType", label: "Document Type", type: "text" },
  { key: "companyId", label: "Company", type: "text" },
  { key: "language", label: "Language", type: "text" },
  { key: "emailIdentityId", label: "Identity", type: "text" },
  { key: "priority", label: "Priority", type: "number" },
];

const EMPTY_EMAIL_TEMPLATE_VALUES = {
  code: "",
  category: "document",
  name: "",
  subjectTemplate: "",
  bodyHtmlTemplate: "<p></p>",
  bodyTextTemplate: "",
  language: null,
} as const;

const SYNC_STATE_COLUMNS = [
  { key: "scope", header: "Scope", sortable: true },
  { key: "status", header: "Status", sortable: true },
  { key: "cursor", header: "Cursor", sortable: false },
  { key: "lastSyncedAt", header: "Last Synced", sortable: true },
  { key: "lastError", header: "Last Error", sortable: false },
];

const EMPTY: never[] = [];

function formatMailboxDate(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

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

function parsePeople(value: Array<{ email: string; name?: string | null }> | undefined | null) {
  return (value ?? [])
    .map((item) => item.email.trim())
    .filter(Boolean)
    .join(", ");
}

function fromJsonToPerson(
  value: Record<string, unknown> | { email?: string; name?: string } | undefined,
) {
  if (!value || typeof value !== "object") return "Unknown sender";
  const email = typeof value.email === "string" ? value.email : "";
  const name = typeof value.name === "string" ? value.name : "";
  return (
    [name, email].filter(Boolean).join(" <") + (name && email ? ">" : "") ||
    email ||
    "Unknown sender"
  );
}

function formatBytes(value: number | null | undefined) {
  if (!value || !Number.isFinite(value)) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function accountBrandIcon(provider: EmailAccount["provider"]) {
  const common = "size-3.5 shrink-0";
  if (provider === "gmail") {
    return <SiGmail aria-hidden className={common} style={{ color: "#ea4335" }} />;
  }
  return <MailIcon aria-hidden className={common} style={{ color: "#0078d4" }} />;
}

function formatStatusLabel(value: string | null | undefined) {
  if (!value) return "Unknown";
  if (value === "reauth_required") return "Reauthorization required";
  if (value === "recovery_required") return "Recovery required";
  if (value === "connected") return "Connected";
  if (value === "ok") return "Healthy";
  if (value === "idle") return "Idle";
  if (value === "queued") return "Queued";
  if (value === "syncing") return "Syncing";
  if (value === "error") return "Error";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatTemplateBindingScope(binding: EmailTemplateBindingRow | null) {
  if (!binding) return "No binding selected";
  return [
    binding.documentType ? `Doc ${binding.documentType}` : "Doc any",
    binding.companyId ? `Company ${binding.companyId}` : "Company any",
    binding.language ? `Lang ${binding.language}` : "Lang any",
    binding.emailIdentityId ? `Identity ${binding.emailIdentityId}` : "Identity any",
  ].join(" · ");
}

function EmailWorkspace() {
  const queryClient = useQueryClient();
  const { setSubCrumb } = useActionBar();
  const { registerCommand } = useCommands();
  const { openAiOverlay } = useAiOverlay();
  const { setFocus } = useFocus();
  const { t } = useTranslation("ui");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>("inbox");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedSystemView, setSelectedSystemView] = useState<"sync" | "templates" | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedBindingId, setSelectedBindingId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [savedOutboxId, setSavedOutboxId] = useState<string | null>(null);
  const [composerMode, setComposerMode] = useState<"plain" | "html">("plain");
  const [composerAttachments, setComposerAttachments] = useState<ComposerAttachment[]>([]);
  const [composerNotice, setComposerNotice] = useState<string | null>(null);
  const [composer, setComposer] = useState({
    identityId: "",
    to: "",
    cc: "",
    bcc: "",
    subject: "",
    bodyText: "",
    bodyHtml: "",
  });

  useEffect(() => {
    setSubCrumb(t("nav.email"));
    return () => setSubCrumb(undefined);
  }, [setSubCrumb, t]);

  const { data: accounts = EMPTY } = useQuery<EmailAccount[]>({
    queryKey: ["email", "accounts"],
    queryFn: async () => {
      const res = await fetch("/api/email/accounts");
      if (!res.ok) throw new Error("Failed to fetch email accounts");
      return res.json();
    },
    placeholderData: keepPreviousData,
  });

  const activeAccountId = selectedAccountId ?? accounts[0]?.emailAccountId ?? null;
  const activeAccount =
    accounts.find((account) => account.emailAccountId === activeAccountId) ?? null;

  const { data: identities = EMPTY } = useQuery<any[]>({
    queryKey: ["email", "identities", activeAccountId],
    queryFn: async () => {
      const res = await fetch(`/api/email/accounts/${activeAccountId}/identities`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: Boolean(activeAccountId),
    placeholderData: keepPreviousData,
  });

  const { data: labels = EMPTY } = useQuery<EmailLabel[]>({
    queryKey: ["email", "labels", activeAccountId],
    queryFn: async () => {
      const res = await fetch(`/api/email/accounts/${activeAccountId}/labels`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: Boolean(activeAccountId),
    placeholderData: keepPreviousData,
  });

  const { data: threads = EMPTY, isLoading: threadsLoading } = useQuery<EmailThread[]>({
    queryKey: [
      "email",
      "threads",
      activeAccountId,
      selectedLabelId,
      selectedFolder,
      searchQuery,
      page,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeAccountId) params.set("accountId", activeAccountId);
      if (selectedLabelId) params.set("labelId", selectedLabelId);
      if (selectedFolder) params.set("folder", selectedFolder);
      if (searchQuery) params.set("q", searchQuery);
      params.set("limit", "50");
      params.set("offset", String(page * 50));
      const res = await fetch(`/api/email/threads?${params}`);
      if (!res.ok) throw new Error("Failed to fetch threads");
      return res.json();
    },
    enabled: Boolean(activeAccountId),
    placeholderData: keepPreviousData,
  });

  const { data: threadDetail } = useQuery<EmailThreadDetail | null>({
    queryKey: ["email", "thread", selectedThreadId],
    queryFn: async () => {
      const res = await fetch(`/api/email/threads/${selectedThreadId}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: Boolean(selectedThreadId),
  });

  const { data: syncState = EMPTY } = useQuery<
    Array<{
      emailSyncStateId: string;
      scope: string;
      cursor: string | null;
      cursorJson: unknown;
      status: string;
      lastSyncedAt: string | null;
      lastError: string | null;
    }>
  >({
    queryKey: ["email", "sync-state", activeAccountId],
    queryFn: async () => {
      if (!activeAccountId) return [];
      const res = await fetch(`/api/email/accounts/${activeAccountId}/sync-state`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: Boolean(activeAccountId),
    placeholderData: keepPreviousData,
  });

  const { data: templates = EMPTY } = useQuery<EmailTemplateRow[]>({
    queryKey: ["email", "templates"],
    queryFn: () =>
      entityList<EmailTemplateRow>(
        "emailTemplate",
        {},
        {
          limit: 200,
          orderBy: "updatedAt:desc",
        },
      ).catch(() => []),
    placeholderData: keepPreviousData,
  });

  const { data: bindings = EMPTY } = useQuery<EmailTemplateBindingRow[]>({
    queryKey: ["email", "template-bindings", selectedTemplateId],
    queryFn: () =>
      selectedTemplateId
        ? entityList<EmailTemplateBindingRow>(
            "emailTemplateBinding",
            { emailTemplateId: selectedTemplateId },
            { limit: 200 },
          ).catch(() => [])
        : Promise.resolve([]),
    enabled: Boolean(selectedTemplateId),
    placeholderData: keepPreviousData,
  });

  const { data: renderLogs = EMPTY } = useQuery<EmailTemplateRenderLogRow[]>({
    queryKey: ["email", "template-render-logs", selectedTemplateId],
    queryFn: () =>
      selectedTemplateId
        ? entityList<EmailTemplateRenderLogRow>(
            "emailTemplateRenderLog",
            { emailTemplateId: selectedTemplateId },
            { limit: 25, orderBy: "createdAt:desc" },
          ).catch(() => [])
        : Promise.resolve([]),
    enabled: Boolean(selectedTemplateId),
    placeholderData: keepPreviousData,
  });

  const treeNodes = useMemo<TreeNode[]>(
    () => [
      {
        id: "accounts",
        label: t("email.tree.categories"),
        children: accounts.map((account) => ({
          id: `account:${account.emailAccountId}`,
          label: `${account.displayName || account.primaryEmail} (${account.primaryEmail})`,
          leadingIcon: accountBrandIcon(account.provider),
          count: account.lastSyncStatus === "error" ? 1 : undefined,
          children: [
            { id: `account:${account.emailAccountId}:inbox`, label: t("email.tree.inbox") },
            { id: `account:${account.emailAccountId}:sent`, label: t("email.tree.sent") },
            { id: `account:${account.emailAccountId}:drafts`, label: t("email.tree.drafts") },
            { id: `account:${account.emailAccountId}:archive`, label: t("email.tree.archive") },
            { id: `account:${account.emailAccountId}:trash`, label: "Trash" },
            ...(labels
              .filter((label) => label.emailAccountId === account.emailAccountId)
              .filter((label) => {
                const name = label.name.toLowerCase();
                const providerId = label.providerLabelId.toLowerCase();

                // Filter out standard Gmail system labels
                if (
                  providerId === "inbox" ||
                  providerId === "sent" ||
                  providerId === "draft" ||
                  providerId === "trash" ||
                  providerId === "spam" ||
                  providerId === "starred" ||
                  providerId === "important" ||
                  providerId === "unread"
                ) {
                  return false;
                }

                // Filter out standard localized Microsoft Graph system folders
                if (
                  name === "inbox" ||
                  name === "posteingang" ||
                  name === "sent items" ||
                  name === "gesendete elemente" ||
                  name === "gesendete objekte" ||
                  name === "drafts" ||
                  name === "entwürfe" ||
                  name === "deleted items" ||
                  name === "gelöschte elemente" ||
                  name === "junk email" ||
                  name === "junk-e-mail" ||
                  name === "outbox" ||
                  name === "postausgang" ||
                  name === "archive" ||
                  name === "archiv" ||
                  name === "conversation history" ||
                  name === "verlauf der unterhaltung"
                ) {
                  return false;
                }

                return true;
              })
              .map((label) => ({
                id: `label:${label.emailLabelId}`,
                label: label.name,
                count: label.unreadCount ?? undefined,
              })) ?? []),
          ],
        })),
      },
      {
        id: "system",
        label: t("nav.email"),
        children: [
          { id: "system:sync", label: t("email.system.syncStatus") },
          { id: "system:templates", label: "Templates" },
        ],
      },
    ],
    [accounts, labels, t],
  );

  const selectedTemplate =
    templates.find((template) => template.emailTemplateId === selectedTemplateId) ?? null;
  const createTemplateInitialValues = useMemo(
    () => (selectedTemplateId ? undefined : { ...EMPTY_EMAIL_TEMPLATE_VALUES }),
    [selectedTemplateId],
  );
  const createBindingInitialValues = useMemo(
    () =>
      selectedBindingId
        ? undefined
        : {
            emailTemplateId: selectedTemplateId,
            priority: 100,
          },
    [selectedBindingId, selectedTemplateId],
  );
  const selectedBinding =
    bindings.find((binding) => binding.emailTemplateBindingId === selectedBindingId) ?? null;
  const accountProviderLabel =
    activeAccount?.provider === "microsoft" ? "Microsoft Graph" : "Gmail";
  const accountStatusLabel = activeAccount ? formatStatusLabel(activeAccount.status) : "No account";
  const accountSyncLabel = activeAccount ? formatStatusLabel(activeAccount.lastSyncStatus) : "Idle";
  // @ts-expect-error
  // eslint-disable-next-line
  const accountSyncTimeLabel = activeAccount?.lastSyncAt
    ? // @ts-expect-error
      // eslint-disable-next-line
      new Date(activeAccount.lastSyncAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  const accountNeedsRecovery =
    activeAccount?.status === "reauth_required" ||
    activeAccount?.lastSyncStatus === "recovery_required";
  const selectedSystemLabel = selectedSystemView === "sync" ? t("email.system.syncStatus") : null;

  const connectProvider = useCallback(async (provider: "google" | "microsoft") => {
    window.location.href = `/api/email/accounts/connect/${provider}`;
  }, []);

  const openSystemView = useCallback((view: "sync" | "templates") => {
    setSelectedThreadId(null);
    setComposerOpen(false);
    setSelectedSystemView(view);
  }, []);

  const queueAccountAction = useCallback(
    async (path: string, successMessage: string) => {
      if (!activeAccountId) return false;
      const res = await fetch(path, { method: "POST" });
      if (!res.ok) {
        toast.error(await res.text());
        return false;
      }
      toast.success(successMessage);
      queryClient.invalidateQueries({ queryKey: ["email"] });
      return true;
    },
    [activeAccountId, queryClient],
  );

  const selectedIdentityId = composer.identityId || identities[0]?.emailIdentityId || "";
  const selectedIdentity =
    identities.find((identity) => identity.emailIdentityId === selectedIdentityId) ??
    identities[0] ??
    null;
  const selectedThread = threadDetail ?? null;

  const openComposerWithDraft = useCallback(
    (draft: any, open = true) => {
      const outbox = draft?.outbox ?? draft?.emailOutbox ?? (draft?.emailOutboxId ? draft : null);
      const payload = outbox?.payload ?? {};
      const attachmentPayload = Array.isArray(payload.attachments) ? payload.attachments : [];
      const documentMailWarnings = Array.isArray(payload?.meta?.documentMail?.warnings)
        ? payload.meta.documentMail.warnings.filter((item: unknown) => typeof item === "string")
        : [];
      setSavedOutboxId(outbox?.emailOutboxId ?? null);
      setComposerOpen(open);
      setComposerNotice(documentMailWarnings.length > 0 ? documentMailWarnings.join(" ") : null);
      setComposerMode(payload.bodyHtml ? "html" : "plain");
      if (outbox?.emailAccountId) setSelectedAccountId(outbox.emailAccountId);
      setComposer({
        identityId: outbox?.emailIdentityId ?? selectedIdentityId,
        to: (payload.to ?? []).map((item: any) => item.email).join(", "),
        cc: (payload.cc ?? []).map((item: any) => item.email).join(", "),
        bcc: (payload.bcc ?? []).map((item: any) => item.email).join(", "),
        subject: payload.subject ?? "",
        bodyText: payload.bodyText ?? "",
        bodyHtml: payload.bodyHtml ?? "",
      });
      setComposerAttachments(
        attachmentPayload.map((attachment: any) => ({
          fileName: String(attachment.fileName ?? ""),
          contentType: String(attachment.contentType ?? "application/octet-stream"),
          providerAttachmentId: attachment.providerAttachmentId ?? null,
          storageKey: attachment.storageKey ?? null,
          sizeBytes: attachment.sizeBytes ?? null,
          inlineContentId: attachment.inlineContentId ?? null,
        })),
      );
    },
    [selectedIdentityId],
  );

  const openBlankComposer = useCallback(() => {
    setSelectedSystemView(null);
    setSelectedThreadId(null);
    setSavedOutboxId(null);
    setComposerMode("plain");
    setComposerAttachments([]);
    setComposerNotice(null);
    setComposer({
      identityId: "",
      to: "",
      cc: "",
      bcc: "",
      subject: "",
      bodyText: "",
      bodyHtml: "",
    });
    setComposerOpen(true);
  }, []);

  const saveDraft = useCallback(
    async (
      options: { close?: boolean; value?: EmailComposeSubmitValue; silent?: boolean } = {},
    ) => {
      if (!activeAccountId || !selectedIdentity) {
        toast.error("No sending identity available");
        return null;
      }
      const source = options.value ?? {
        ...composer,
        identityId: selectedIdentityId,
        mode: composerMode,
        attachments: composerAttachments,
      };
      const bodyHtml =
        source.mode === "html" ? source.bodyHtml : source.bodyText.replace(/\n/g, "<br />");
      const bodyText = source.mode === "html" ? htmlToText(source.bodyHtml) : source.bodyText;
      const res = await fetch("/api/email/drafts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accountId: activeAccountId,
          identityId: source.identityId || selectedIdentityId,
          to: source.to
            .split(",")
            .map((email) => email.trim())
            .filter(Boolean)
            .map((email) => ({ email })),
          cc: source.cc
            .split(",")
            .map((email) => email.trim())
            .filter(Boolean)
            .map((email) => ({ email })),
          bcc: source.bcc
            .split(",")
            .map((email) => email.trim())
            .filter(Boolean)
            .map((email) => ({ email })),
          subject: source.subject,
          bodyText,
          bodyHtml,
          attachments: source.attachments,
        }),
      });
      if (!res.ok) {
        if (!options.silent) toast.error(await res.text());
        return null;
      }
      const result = await res.json();
      setSavedOutboxId(result.outbox?.emailOutboxId ?? null);
      if (!options.silent) toast.success("Draft saved");
      if (options.close) {
        setComposerOpen(false);
        setSavedOutboxId(null);
        setComposerAttachments([]);
        setComposerNotice(null);
        setComposer({
          identityId: selectedIdentityId,
          to: "",
          cc: "",
          bcc: "",
          subject: "",
          bodyText: "",
          bodyHtml: "",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["email"] });
      return result;
    },
    [
      activeAccountId,
      composer,
      composerAttachments,
      queryClient,
      selectedIdentity,
      selectedIdentityId,
      composerMode,
    ],
  );

  const actOnDraft = useCallback(
    async (action: "provider-draft" | "queue" | "send", value?: EmailComposeSubmitValue) => {
      const draft = savedOutboxId && !value ? null : await saveDraft({ value });
      const outboxId = value
        ? draft?.outbox?.emailOutboxId
        : (savedOutboxId ?? draft?.outbox?.emailOutboxId);
      if (!outboxId) return;
      const res = await fetch(`/api/email/drafts/${outboxId}/${action}`, { method: "POST" });
      if (!res.ok) {
        toast.error(await res.text());
        return;
      }
      toast.success(
        action === "provider-draft"
          ? "Provider draft saved"
          : action === "queue"
            ? "Draft queued"
            : "Draft sent",
      );
      if (action === "send") {
        setComposerOpen(false);
        setSavedOutboxId(null);
        setComposerAttachments([]);
        setComposerNotice(null);
      }
      queryClient.invalidateQueries({ queryKey: ["email"] });
    },
    [queryClient, saveDraft, savedOutboxId],
  );

  const submitComposer = useCallback(
    async (action: EmailComposeAction, value: EmailComposeSubmitValue) => {
      setComposer({
        identityId: value.identityId,
        to: value.to,
        cc: value.cc,
        bcc: value.bcc,
        subject: value.subject,
        bodyText: value.bodyText,
        bodyHtml: value.bodyHtml,
      });
      setComposerMode(value.mode);
      setComposerAttachments(value.attachments);
      if (action === "save-draft" || action === ("auto-save" as any)) {
        await saveDraft({ value, silent: action === ("auto-save" as any) });
        return;
      }
      await actOnDraft(action, value);
    },
    [actOnDraft, saveDraft],
  );

  const startReply = useCallback(
    async (messageIndex = 0) => {
      if (!selectedThread || !selectedThread.messages[messageIndex]) return;
      const source = selectedThread.messages[messageIndex];
      const res = await fetch(`/api/email/messages/${source.emailMessageId}/reply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          identityId: selectedIdentityId,
          to: [{ email: typeof source.fromJson?.email === "string" ? source.fromJson.email : "" }],
          subject: `Re: ${source.subject ?? selectedThread.subject ?? ""}`,
          bodyText: `\n\nOn ${formatMailboxDate(source.receivedAt ?? source.sentAt)} ${typeof source.fromJson?.email === "string" ? source.fromJson.email : "someone"} wrote:\n${source.bodyText ?? htmlToText(source.bodyHtml ?? "")}`,
          bodyHtml: `<p></p><p>On ${formatMailboxDate(source.receivedAt ?? source.sentAt)} ${typeof source.fromJson?.email === "string" ? source.fromJson.email : "someone"} wrote:</p><blockquote>${source.bodyHtml ?? `<pre>${(source.bodyText ?? "").replace(/</g, "&lt;")}</pre>`}</blockquote>`,
        }),
      });
      if (!res.ok) {
        toast.error(await res.text());
        return;
      }
      openComposerWithDraft(await res.json());
    },
    [selectedThread, selectedIdentityId, openComposerWithDraft],
  );

  const startReplyAll = useCallback(
    async (messageIndex = 0) => {
      if (!selectedThread || !selectedThread.messages[messageIndex]) return;
      const source = selectedThread.messages[messageIndex];
      const senderEmail = typeof source.fromJson?.email === "string" ? source.fromJson.email : "";
      const myEmail = selectedIdentity?.email || "";

      const toEmails = [senderEmail, ...(source.toJson ?? []).map((t: any) => t.email)].filter(
        (email) => email && email.toLowerCase() !== myEmail.toLowerCase(),
      );

      const distinctTo = Array.from(new Set(toEmails)).map((email) => ({ email }));

      const ccEmails = (source.ccJson ?? [])
        .map((c: any) => c.email)
        .filter((email: string) => email && email.toLowerCase() !== myEmail.toLowerCase());
      const distinctCc = Array.from(new Set(ccEmails)).map((email) => ({ email }));

      const res = await fetch(`/api/email/messages/${source.emailMessageId}/reply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          identityId: selectedIdentityId,
          to: distinctTo,
          cc: distinctCc,
          subject: `Re: ${source.subject ?? selectedThread.subject ?? ""}`,
          bodyText: `\n\nOn ${formatMailboxDate(source.receivedAt ?? source.sentAt)} ${typeof source.fromJson?.email === "string" ? source.fromJson.email : "someone"} wrote:\n${source.bodyText ?? htmlToText(source.bodyHtml ?? "")}`,
          bodyHtml: `<p></p><p>On ${formatMailboxDate(source.receivedAt ?? source.sentAt)} ${typeof source.fromJson?.email === "string" ? source.fromJson.email : "someone"} wrote:</p><blockquote>${source.bodyHtml ?? `<pre>${(source.bodyText ?? "").replace(/</g, "&lt;")}</pre>`}</blockquote>`,
        }),
      });
      if (!res.ok) {
        toast.error(await res.text());
        return;
      }
      openComposerWithDraft(await res.json());
    },
    [selectedThread, selectedIdentity, selectedIdentityId, openComposerWithDraft],
  );

  const startForward = useCallback(
    async (messageIndex = 0) => {
      if (!selectedThread || !selectedThread.messages[messageIndex]) return;
      const source = selectedThread.messages[messageIndex];
      const res = await fetch(`/api/email/messages/${source.emailMessageId}/forward`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          identityId: selectedIdentityId,
          to: [],
          subject: `Fwd: ${source.subject ?? selectedThread.subject ?? ""}`,
          bodyText: `\n\n-------- Forwarded message --------\nFrom: ${typeof source.fromJson?.email === "string" ? source.fromJson.email : "unknown"}\nDate: ${formatMailboxDate(source.receivedAt ?? source.sentAt)}\nSubject: ${source.subject ?? ""}\n\n${source.bodyText ?? htmlToText(source.bodyHtml ?? "")}`,
          bodyHtml: `<p>-------- Forwarded message --------</p><p>From: ${typeof source.fromJson?.email === "string" ? source.fromJson.email : "unknown"}<br />Date: ${formatMailboxDate(source.receivedAt ?? source.sentAt)}<br />Subject: ${source.subject ?? ""}</p><blockquote>${source.bodyHtml ?? `<pre>${(source.bodyText ?? "").replace(/</g, "&lt;")}</pre>`}</blockquote>`,
        }),
      });
      if (!res.ok) {
        toast.error(await res.text());
        return;
      }
      openComposerWithDraft(await res.json());
    },
    [selectedThread, selectedIdentityId, openComposerWithDraft],
  );

  const archiveThread = useCallback(async () => {
    if (!selectedThreadId) return;
    const res = await fetch(`/api/email/threads/${selectedThreadId}/archive`, { method: "POST" });
    if (!res.ok) {
      toast.error(await res.text());
      return;
    }
    setSelectedThreadId(null);
    queryClient.invalidateQueries({ queryKey: ["email"] });
  }, [selectedThreadId, queryClient]);

  const trashThread = useCallback(async () => {
    if (!selectedThreadId) return;
    const res = await fetch(`/api/email/threads/${selectedThreadId}/trash`, { method: "POST" });
    if (!res.ok) {
      toast.error(await res.text());
      return;
    }
    toast.success("E-Mail erfolgreich gelöscht.");
    setSelectedThreadId(null);
    queryClient.invalidateQueries({ queryKey: ["email"] });
  }, [selectedThreadId, queryClient]);

  const openMailAiAssistant = useCallback(
    (event?: Event) => {
      const detail = (event as CustomEvent<{ compose?: boolean }>)?.detail;
      // When triggered from the compose dialog (or while composer is open), open
      // the compose-draft panel with the current composer state as context.
      if (detail?.compose || composerOpen) {
        const toAddresses = composer.to
          ? composer.to
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [];
        openAiOverlay({
          taskScope: "mail-compose-draft",
          composeDraftContext: {
            to: toAddresses,
            subject: composer.subject,
            context: composer.bodyText ? composer.bodyText.slice(0, 500) : undefined,
          },
        });
      } else {
        openAiOverlay();
      }
    },
    [openAiOverlay, composer, composerOpen],
  );

  const openEmailDraftFromAi = useCallback(
    async (event: Event) => {
      const detail = (event as CustomEvent<{ draftId?: string; body?: string; subject?: string }>)
        .detail;

      // Direct body injection from MailComposeDraftPanel
      if (detail?.body) {
        const injectedBody = detail.body;
        setComposer((prev) => ({
          ...prev,
          bodyText: injectedBody,
          bodyHtml: injectedBody,
          ...(detail.subject ? { subject: detail.subject } : {}),
        }));
        setComposerOpen(true);
        return;
      }

      const draftId = detail?.draftId;
      if (!draftId) return;

      const res = await fetch(`/api/email/drafts/${draftId}`);
      if (!res.ok) {
        toast.error(await res.text());
        return;
      }

      const draft = await res.json();
      openComposerWithDraft(draft);
      setComposerOpen(true);
      setSelectedThreadId(null);
    },
    [openComposerWithDraft],
  );

  useEffect(() => {
    const handleOpenAi = (event: Event) => openMailAiAssistant(event);
    window.addEventListener("slopware:open-ai", handleOpenAi);
    window.addEventListener("slopware:open-email-draft", openEmailDraftFromAi);
    return () => {
      window.removeEventListener("slopware:open-ai", handleOpenAi);
      window.removeEventListener("slopware:open-email-draft", openEmailDraftFromAi);
    };
  }, [openEmailDraftFromAi, openMailAiAssistant]);

  const draftBootstrapRef = useRef<string | null>(null);

  useEffect(() => {
    const draftId = new URLSearchParams(window.location.search).get("draftId");
    if (!draftId || draftBootstrapRef.current === draftId) return;
    draftBootstrapRef.current = draftId;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/email/drafts/${draftId}`);
      if (!res.ok) return;
      const draft = await res.json();
      if (cancelled) return;
      openComposerWithDraft(draft);
      setComposerOpen(true);
      setSelectedThreadId(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeAccountId, openComposerWithDraft]);

  const activeAccountIdRef = useRef<string | null>(null);
  const selectedThreadIdRef = useRef<string | null>(null);
  const composerOpenRef = useRef(false);
  const saveDraftRef = useRef(saveDraft);
  const actOnDraftRef = useRef(actOnDraft);
  const openMailAiAssistantRef = useRef(openMailAiAssistant);
  const connectProviderRef = useRef(connectProvider);
  const startReplyRef = useRef(startReply);
  const startForwardRef = useRef(startForward);
  const trashThreadRef = useRef(trashThread);

  useEffect(() => {
    activeAccountIdRef.current = activeAccountId;
    selectedThreadIdRef.current = selectedThreadId;
    composerOpenRef.current = composerOpen;
    saveDraftRef.current = saveDraft;
    actOnDraftRef.current = actOnDraft;
    connectProviderRef.current = connectProvider;
    startReplyRef.current = startReply;
    startForwardRef.current = startForward;
    trashThreadRef.current = trashThread;
  });

  useEffect(() => {
    const unregCompose = registerCommand({
      id: "email-compose",
      scope: "context",
      group: "email",
      label: { en: "Compose email", de: "E-Mail verfassen" },
      shortcut: "F3",
      handler: () => {
        openBlankComposer();
        setSelectedThreadId(null);
      },
    });
    const unregSync = registerCommand({
      id: "email-sync-account",
      scope: "context",
      group: "email",
      label: { en: "Sync email account", de: "E-Mail-Konto synchronisieren" },
      shortcut: "F9",
      isEnabled: () => Boolean(activeAccountIdRef.current),
      handler: async () => {
        const activeAccountId = activeAccountIdRef.current;
        if (!activeAccountId) return;
        const res = await fetch(`/api/email/accounts/${activeAccountId}/sync`, { method: "POST" });
        if (!res.ok) throw new Error(await res.text());
        toast.success("Email sync queued");
        queryClient.invalidateQueries({ queryKey: ["email"] });
      },
    });
    const unregMarkRead = registerCommand({
      id: "email-mark-read",
      scope: "context",
      group: "email",
      label: { en: "Mark thread read", de: "Thread gelesen markieren" },
      shortcut: "F8",
      isEnabled: () => Boolean(selectedThreadIdRef.current),
      handler: async () => {
        const selectedThreadId = selectedThreadIdRef.current;
        if (!selectedThreadId) return;
        const res = await fetch(`/api/email/threads/${selectedThreadId}/mark-read`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ read: true }),
        });
        if (!res.ok) throw new Error(await res.text());
        queryClient.invalidateQueries({ queryKey: ["email"] });
      },
    });
    const unregSave = registerCommand({
      id: "email-save-draft",
      scope: "local",
      group: "email",
      label: { en: "Save draft", de: "Entwurf speichern" },
      shortcut: "F10",
      isEnabled: () => composerOpenRef.current,
      handler: async () => {
        if (composerOpenRef.current) await saveDraftRef.current();
      },
    });
    const unregSend = registerCommand({
      id: "email-send",
      scope: "local",
      group: "email",
      label: { en: "Send draft", de: "Entwurf senden" },
      shortcut: "Ctrl+Enter",
      isEnabled: () => composerOpenRef.current,
      handler: async () => {
        if (composerOpenRef.current) await actOnDraftRef.current("send");
      },
    });
    const unregArchive = registerCommand({
      id: "email-archive-thread",
      scope: "context",
      group: "email",
      label: { en: "Archive thread", de: "Thread archivieren" },
      isEnabled: () => Boolean(selectedThreadIdRef.current),
      handler: async () => {
        const selectedThreadId = selectedThreadIdRef.current;
        if (!selectedThreadId) return;
        const res = await fetch(`/api/email/threads/${selectedThreadId}/archive`, {
          method: "POST",
        });
        if (!res.ok) throw new Error(await res.text());
        setSelectedThreadId(null);
        queryClient.invalidateQueries({ queryKey: ["email"] });
      },
    });
    const unregTrash = registerCommand({
      id: "email-trash-thread",
      scope: "context",
      group: "email",
      label: { en: "Delete email (Move to trash)", de: "E-Mail löschen (In Papierkorb)" },
      shortcut: "F4",
      isEnabled: () => Boolean(selectedThreadIdRef.current),
      handler: async () => {
        const selectedThreadId = selectedThreadIdRef.current;
        if (!selectedThreadId) return;
        await trashThreadRef.current();
      },
    });
    const unregAi = registerCommand({
      id: "email-ai-assistant",
      scope: "context",
      group: "email",
      label: { en: "AI Assistant", de: "KI-Assistent" },
      shortcut: "Alt+A",
      isEnabled: () => Boolean(selectedThreadIdRef.current),
      handler: () => {
        openMailAiAssistantRef.current();
      },
    });
    const unregConnect = registerCommand({
      id: "connect-email-account",
      scope: "context",
      group: "email",
      label: { en: "Connect Gmail account", de: "Gmail-Konto verbinden" },
      handler: () => {
        connectProviderRef.current("google");
      },
    });
    const unregReply = registerCommand({
      id: "reply-email",
      scope: "context",
      group: "email",
      label: { en: "Reply to thread", de: "Auf Thread antworten" },
      shortcut: "R",
      isEnabled: () => Boolean(selectedThreadIdRef.current),
      handler: () => {
        void startReplyRef.current(0);
      },
    });
    const unregForward = registerCommand({
      id: "forward-email",
      scope: "context",
      group: "email",
      label: { en: "Forward thread", de: "Thread weiterleiten" },
      shortcut: "F",
      isEnabled: () => Boolean(selectedThreadIdRef.current),
      handler: () => {
        void startForwardRef.current(0);
      },
    });
    const unregApplyLabel = registerCommand({
      id: "apply-email-label",
      scope: "context",
      group: "email",
      label: { en: "Apply label to thread", de: "Label auf Thread anwenden" },
      isEnabled: () => Boolean(selectedThreadIdRef.current),
      handler: () => {
        toast.info("Select a label from the dropdown in the toolbar");
      },
    });
    return () => {
      unregCompose();
      unregSync();
      unregMarkRead();
      unregSave();
      unregSend();
      unregArchive();
      unregTrash();
      unregAi();
      unregConnect();
      unregReply();
      unregForward();
      unregApplyLabel();
    };
  }, [registerCommand, queryClient, openBlankComposer]);

  const threadAttachments = selectedThread?.attachments ?? [];
  const threadMessages = selectedThread?.messages ?? [];
  const accountSyncError = activeAccount?.lastSyncError ?? null;

  return (
    <>
      <EmailComposeDialog
        open={composerOpen}
        identities={identities}
        value={composer}
        mode={composerMode}
        attachments={composerAttachments}
        notice={composerNotice}
        onClose={() => {
          setComposerOpen(false);
          setSavedOutboxId(null);
          setComposerAttachments([]);
          setComposerNotice(null);
        }}
        onSubmit={submitComposer}
      />
      <TriViewWorkspace
        className="min-h-0"
        defaultLayout={["22%", "78%"]}
        defaultRightLayout={["58%", "42%"]}
        navigationTree={
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-hairline px-3 py-2">
              <div className="flex items-center gap-2 text-[13px] text-ink">
                <MailIcon className="size-4" />
                <span>{t("nav.email")}</span>
              </div>
              <button
                className="grid size-7 place-items-center rounded-sm text-ink-secondary hover:bg-canvas hover:text-ink"
                onClick={() => {
                  openBlankComposer();
                }}
                title={t("email.actions.compose")}
              >
                <PlusIcon className="size-4" />
              </button>
            </div>
            <NavigationTree
              entityName="emailAccount"
              panelId="email-nav"
              data={treeNodes}
              isLoading={!accounts}
              defaultExpandDepth={2}
              onSelect={(id) => {
                if (id.startsWith("account:")) {
                  const parts = id.split(":");
                  const accountId = parts[1] ?? null;
                  const folder = parts[2] ?? null;
                  if (accountId) {
                    setSelectedAccountId(accountId);
                    setSelectedThreadId(null);
                    setComposerOpen(false);
                    setSelectedSystemView(null);
                  }
                  if (folder) {
                    setSelectedFolder(folder);
                    setSelectedLabelId(null);
                  } else {
                    setSelectedFolder("inbox");
                    setSelectedLabelId(null);
                  }
                  setPage(0);
                  return;
                }
                if (id.startsWith("label:")) {
                  setSelectedLabelId(id.slice("label:".length));
                  setSelectedFolder(null);
                  setSelectedSystemView(null);
                  setPage(0);
                  return;
                }
                if (id.startsWith("system:")) {
                  const view = id.slice("system:".length);
                  setSelectedLabelId(null);
                  setSelectedFolder(null);
                  setSelectedThreadId(null);
                  setComposerOpen(false);
                  openSystemView(view as "sync" | "templates");
                  return;
                }
              }}
            />
          </div>
        }
        primaryGrid={
          <section className="flex h-full flex-col bg-canvas">
            <div className="flex h-10 items-center justify-between border-b border-hairline px-3">
              <div className="flex items-center gap-2 text-[13px] text-ink-secondary">
                <span>
                  {selectedSystemLabel ?? activeAccount?.primaryEmail ?? t("email.panels.primary")}
                </span>
                {threadsLoading && <ClockIcon className="size-3.5 animate-spin" />}
              </div>
              <div className="flex items-center gap-2">
                {activeAccount && (
                  <div className="flex items-center gap-1 text-[11px] text-ink-mute">
                    <span className="rounded-full border border-hairline px-1.5 py-0.5">
                      {accountProviderLabel}
                    </span>
                    <span className="rounded-full border border-hairline px-1.5 py-0.5">
                      {accountStatusLabel}
                    </span>
                    <span className="rounded-full border border-hairline px-1.5 py-0.5">
                      Sync {accountSyncLabel}{" "}
                      {accountSyncTimeLabel ? `(${accountSyncTimeLabel})` : ""}
                    </span>
                  </div>
                )}
                <button
                  onClick={() =>
                    activeAccountId &&
                    void queueAccountAction(
                      `/api/email/accounts/${activeAccountId}/sync`,
                      "Mailbox sync queued",
                    )
                  }
                  disabled={!activeAccountId}
                  className="grid size-7 place-items-center rounded-sm text-ink-secondary hover:bg-canvas-soft hover:text-ink"
                  title={t("email.system.syncStatus")}
                >
                  <RefreshCcwIcon className="size-4" />
                </button>
                <button
                  onClick={() => {
                    openBlankComposer();
                  }}
                  className="grid size-7 place-items-center rounded-sm text-ink-secondary hover:bg-canvas-soft hover:text-ink"
                  title={t("email.actions.compose")}
                >
                  <PlusIcon className="size-4" />
                </button>
              </div>
            </div>
            {!activeAccount ? (
              <div className="border-b border-hairline bg-canvas-soft px-3 py-2 text-[12px] text-ink-secondary">
                Connect Gmail or Microsoft Graph to start mailbox sync, recovery, and document mail
                preparation.
              </div>
            ) : activeAccount.status === "reauth_required" ? (
              <div className="flex items-center justify-between gap-3 border-b border-hairline bg-[color-mix(in_oklab,var(--destructive)_8%,transparent)] px-3 py-2 text-[12px] text-ink">
                <div className="min-w-0">
                  <div className="font-medium">
                    {activeAccount.provider === "microsoft"
                      ? "Microsoft Graph access needs to be reauthorized."
                      : "Gmail access needs to be reauthorized."}
                  </div>
                  <div className="text-ink-secondary">
                    Sync, watch renewal, and document-mail preparation will stay blocked until the
                    account is reconnected.
                  </div>
                </div>
                <button
                  onClick={() =>
                    connectProvider(activeAccount.provider === "microsoft" ? "microsoft" : "google")
                  }
                  className="rounded-sm border border-hairline bg-canvas px-2 py-1 text-[12px] text-ink-secondary hover:text-ink"
                >
                  Reauthorize
                </button>
              </div>
            ) : accountNeedsRecovery ? (
              <div className="flex items-center justify-between gap-3 border-b border-hairline bg-[color-mix(in_oklab,var(--primary)_7%,transparent)] px-3 py-2 text-[12px] text-ink">
                <div className="min-w-0">
                  <div className="font-medium">
                    {activeAccount.lastSyncStatus === "recovery_required"
                      ? "Mailbox recovery is required."
                      : "Mailbox sync needs attention."}
                  </div>
                  <div className="text-ink-secondary">
                    Reconnect the provider, then run Initial sync or Refresh so template rendering
                    and document-mail preparation use current mailbox state.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      connectProvider(
                        activeAccount.provider === "microsoft" ? "microsoft" : "google",
                      )
                    }
                    className="rounded-sm border border-hairline bg-canvas px-2 py-1 text-[12px] text-ink-secondary hover:text-ink"
                  >
                    Reconnect
                  </button>
                  <button
                    onClick={() =>
                      void queueAccountAction(
                        `/api/email/accounts/${activeAccountId}/initial-sync`,
                        "Initial sync queued",
                      )
                    }
                    className="rounded-sm border border-hairline bg-canvas px-2 py-1 text-[12px] text-ink-secondary hover:text-ink"
                  >
                    Initial sync
                  </button>
                </div>
              </div>
            ) : null}
            <div className="border-b border-hairline p-2">
              <input
                type="text"
                placeholder="Search mail..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(0);
                }}
                className="h-8 w-full rounded-sm border border-hairline bg-canvas px-2.5 text-[12px] outline-none focus:border-primary"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              {threads.length === 0 ? (
                <div className="grid h-full place-items-center text-[13px] text-ink-mute">
                  {t("email.panels.thread")}
                </div>
              ) : (
                threads.map((thread) => (
                  <button
                    key={thread.emailThreadId}
                    onClick={() => {
                      setSelectedThreadId(thread.emailThreadId);
                      setSelectedSystemView(null);
                      setFocus({
                        workspace: "email",
                        area: "grid",
                        panel: "email-thread-list",
                        entity: "emailThread",
                        recordId: thread.emailThreadId,
                      });
                    }}
                    className={cn(
                      "grid w-full grid-cols-[1fr_auto] gap-2 border-b border-hairline px-3 py-2.5 text-left transition-colors hover:bg-canvas-soft",
                      selectedThreadId === thread.emailThreadId &&
                        "bg-[color-mix(in_oklab,var(--primary)_8%,transparent)]",
                    )}
                  >
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "mb-0.5 block truncate text-[12px] text-ink-secondary",
                          !thread.isRead && "font-semibold text-ink",
                        )}
                      >
                        {thread.senderDisplay || "Unknown sender"}
                      </span>
                      <span
                        className={cn(
                          "block truncate text-[13px]",
                          !thread.isRead && "font-medium text-ink",
                        )}
                      >
                        {thread.subject || "(no subject)"}
                      </span>
                      <span className="mt-0.5 block truncate text-[12px] text-ink-mute">
                        {thread.snippet || "No preview"}
                      </span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full border border-hairline px-1.5 py-0.5 text-[10px] text-ink-mute">
                          {thread.messageCount} {t("email.panels.messages")}
                        </span>
                        {!thread.isRead && (
                          <span className="rounded-full border border-hairline bg-[color-mix(in_oklab,var(--primary)_8%,transparent)] px-1.5 py-0.5 text-[10px] font-medium text-ink">
                            unread
                          </span>
                        )}
                        {thread.hasAttachments && (
                          <span
                            className="inline-flex items-center text-ink-mute"
                            title="Has attachments"
                          >
                            <PaperclipIcon className="size-3" />
                          </span>
                        )}
                        {thread.relatedDocumentId && (
                          <span
                            className="inline-flex items-center gap-0.5 rounded-full border border-primary/20 bg-[color-mix(in_oklab,var(--primary)_8%,transparent)] px-1.5 py-0.5 text-[10px] font-medium text-primary"
                            title="Related to ERP Document"
                          >
                            <FileTextIcon className="size-2.5" />
                            <span>doc</span>
                          </span>
                        )}
                        {thread.relatedAddressId && (
                          <span
                            className="inline-flex items-center gap-0.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600"
                            title="Related to Customer"
                          >
                            <UserIcon className="size-2.5" />
                            <span>customer</span>
                          </span>
                        )}
                        {thread.labels?.map((label) => (
                          <span
                            key={label.emailLabelId}
                            className="rounded-full border px-1.5 py-0.5 text-[10px]"
                            style={{
                              backgroundColor: label.color
                                ? `${label.color}15`
                                : "var(--canvas-soft)",
                              borderColor: label.color || "var(--hairline)",
                              color: label.color || "var(--ink-secondary)",
                            }}
                          >
                            {label.name}
                          </span>
                        ))}
                      </span>
                    </span>
                    <span className="text-[11px] text-ink-mute">
                      {formatMailboxDate(thread.lastMessageAt)}
                    </span>
                  </button>
                ))
              )}
            </div>
            <div className="flex flex-none items-center justify-between border-t border-hairline bg-canvas-soft px-3 py-2">
              <button
                disabled={page === 0}
                onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                className="rounded-sm border border-hairline bg-canvas px-2.5 py-1 text-[11px] text-ink-secondary hover:text-ink disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-[11px] text-ink-mute">Page {page + 1}</span>
              <button
                disabled={threads.length < 50}
                onClick={() => setPage((prev) => prev + 1)}
                className="rounded-sm border border-hairline bg-canvas px-2.5 py-1 text-[11px] text-ink-secondary hover:text-ink disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </section>
        }
        dependentContext={
          selectedSystemView === "templates" ? (
            <section className="flex h-full min-h-0 flex-col bg-canvas">
              <div className="flex h-10 items-center justify-between border-b border-hairline px-3">
                <div className="text-[13px] text-ink-secondary">
                  {selectedTemplate
                    ? `${selectedTemplate.code} · ${selectedTemplate.name}`
                    : "Create template"}
                  {selectedBinding ? ` · binding ${selectedBinding.priority}` : ""}
                </div>
                <div className="flex items-center gap-1">
                  {selectedTemplateId && (
                    <button
                      onClick={() => setSelectedBindingId(null)}
                      className="rounded-sm border border-hairline px-2 py-1 text-[12px] text-ink-secondary hover:bg-canvas-soft hover:text-ink"
                    >
                      New binding
                    </button>
                  )}
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-auto p-4">
                <div className="mx-auto flex max-w-4xl flex-col gap-4">
                  <div className="rounded-md border border-hairline bg-canvas-soft p-3 text-[12px] text-ink-secondary">
                    Document mail uses the binding row to resolve the template before rendering
                    subject and body. Scope bindings by document type, company, language, and
                    sending identity.
                    {selectedBinding && (
                      <div className="mt-1 text-ink-mute">
                        {formatTemplateBindingScope(selectedBinding)}
                      </div>
                    )}
                  </div>
                  <EntityMask
                    entityName="emailTemplate"
                    recordId={selectedTemplateId ?? undefined}
                    mode={selectedTemplateId ? "edit" : "create"}
                    title={selectedTemplateId ? "Edit template" : "Create template"}
                    fields={TEMPLATE_FIELDS}
                    initialValues={createTemplateInitialValues}
                    onSaved={(record) => {
                      const next = record as EmailTemplateRow;
                      setSelectedTemplateId(next.emailTemplateId);
                      queryClient.invalidateQueries({ queryKey: ["email"] });
                    }}
                  />
                  {selectedTemplateId && (
                    <EntityMask
                      entityName="emailTemplateBinding"
                      recordId={selectedBindingId ?? undefined}
                      mode={selectedBindingId ? "edit" : "create"}
                      title={selectedBindingId ? "Edit binding" : "Create binding"}
                      fields={TEMPLATE_BINDING_FIELDS}
                      initialValues={createBindingInitialValues}
                      onSaved={(record) => {
                        const next = record as EmailTemplateBindingRow;
                        setSelectedBindingId(next.emailTemplateBindingId);
                        queryClient.invalidateQueries({ queryKey: ["email"] });
                      }}
                    />
                  )}
                  {selectedTemplateId && (
                    <DataGrid
                      entityName="emailTemplateBinding"
                      panelId="email-template-binding-grid"
                      data={bindings}
                      keyExtractor={(row) => row.emailTemplateBindingId}
                      columns={[
                        { key: "priority", header: "Priority", sortable: true, width: "90px" },
                        { key: "documentType", header: "Doc Type", sortable: true, width: "120px" },
                        { key: "companyId", header: "Company", sortable: false },
                        { key: "language", header: "Language", sortable: true, width: "90px" },
                        { key: "emailIdentityId", header: "Identity", sortable: false },
                      ]}
                      emptyTitle="No bindings yet"
                      emptySubtitle="Add a binding to scope this template to a document, company, language, or identity."
                      onRowClick={(row: EmailTemplateBindingRow) =>
                        setSelectedBindingId(row.emailTemplateBindingId)
                      }
                    />
                  )}
                  {renderLogs.length > 0 && (
                    <div className="rounded-md border border-hairline bg-canvas-soft p-3">
                      <div className="mb-2 text-[11px] tracking-wider text-ink-mute uppercase">
                        Recent render logs
                      </div>
                      <div className="space-y-2">
                        {renderLogs.map((log) => (
                          <div
                            key={log.emailTemplateRenderLogId}
                            className="rounded-sm border border-hairline bg-canvas px-3 py-2 text-[12px]"
                          >
                            <div className="flex items-center justify-between gap-4">
                              <span className="truncate text-ink">{log.subject}</span>
                              <span className="text-ink-mute">
                                {formatMailboxDate(log.createdAt)}
                              </span>
                            </div>
                            <div className="mt-1 text-[11px] text-ink-mute">
                              {log.language || "default"} · {log.emailIdentityId || "no identity"} ·{" "}
                              {log.renderedHash || "no hash"}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          ) : selectedSystemView === "sync" ? (
            <section className="flex h-full min-h-0 flex-col bg-canvas">
              <div className="flex h-10 items-center justify-between border-b border-hairline px-3">
                <div className="text-[13px] text-ink-secondary">{t("email.system.syncStatus")}</div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      activeAccountId &&
                      void queueAccountAction(
                        `/api/email/accounts/${activeAccountId}/initial-sync`,
                        "Initial sync queued",
                      )
                    }
                    className="rounded-sm border border-hairline px-2 py-1 text-[12px] text-ink-secondary hover:bg-canvas-soft hover:text-ink"
                  >
                    Initial sync
                  </button>
                  <button
                    onClick={() =>
                      activeAccountId &&
                      void queueAccountAction(
                        `/api/email/accounts/${activeAccountId}/sync`,
                        "Mailbox sync queued",
                      )
                    }
                    className="rounded-sm border border-hairline px-2 py-1 text-[12px] text-ink-secondary hover:bg-canvas-soft hover:text-ink"
                  >
                    Refresh
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-auto p-4">
                <div className="mx-auto flex max-w-4xl flex-col gap-4">
                  <div className="rounded-md border border-hairline bg-canvas-soft p-4">
                    <div className="text-[13px] font-medium text-ink">Setup and recovery</div>
                    <div className="mt-1 text-[12px] text-ink-secondary">
                      {activeAccount?.provider === "microsoft"
                        ? "Microsoft Graph needs Mail.ReadWrite, Mail.Send, offline_access, and a configured subscription client state before watch renewal can succeed."
                        : "Gmail needs labels, modify, compose, send, and readonly scopes before sync and watch renewal can succeed."}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() =>
                          connectProvider(
                            activeAccount?.provider === "microsoft" ? "microsoft" : "google",
                          )
                        }
                        className="rounded-sm bg-primary px-3 py-1.5 text-[12px] text-primary-fg"
                      >
                        {activeAccount?.status === "reauth_required" ? "Reconnect" : "Connect"}{" "}
                        {activeAccount?.provider === "microsoft" ? "Microsoft" : "Gmail"}
                      </button>
                      {activeAccountId && (
                        <button
                          onClick={() =>
                            void queueAccountAction(
                              `/api/email/accounts/${activeAccountId}/watch-renewal`,
                              "Watch renewal queued",
                            )
                          }
                          className="rounded-sm border border-hairline px-3 py-1.5 text-[12px] text-ink-secondary hover:bg-canvas-soft hover:text-ink"
                        >
                          Renew watch
                        </button>
                      )}
                    </div>
                    <div className="mt-3 text-[12px] text-ink-mute">
                      Recovery clears expired cursors, reconnects provider access, and keeps
                      document mail templates in sync with the active mailbox state.
                    </div>
                  </div>
                  <DataGrid
                    entityName="emailSyncState"
                    panelId="email-sync-state-grid"
                    data={syncState}
                    keyExtractor={(row) => row.emailSyncStateId}
                    columns={SYNC_STATE_COLUMNS}
                    emptyTitle="No sync state"
                    emptySubtitle="Run initial sync to seed cursors and mailbox state."
                  />
                </div>
              </div>
            </section>
          ) : (
            <section className="flex h-full min-h-0 bg-canvas">
              <div className="flex min-w-0 flex-1 flex-col border-r border-hairline">
                <div className="flex h-10 items-center gap-1 border-b border-hairline px-3">
                  <button
                    onClick={async () => {
                      if (!selectedThreadId) return;
                      const res = await fetch(`/api/email/threads/${selectedThreadId}/mark-read`, {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ read: !selectedThread?.isRead }),
                      });
                      if (!res.ok) {
                        toast.error(await res.text());
                        return;
                      }
                      queryClient.invalidateQueries({ queryKey: ["email"] });
                    }}
                    className="grid size-7 place-items-center rounded-sm text-ink-secondary hover:bg-canvas-soft hover:text-ink"
                    title={
                      selectedThread?.isRead ? t("email.panels.unread") : t("email.panels.thread")
                    }
                  >
                    <MailOpenIcon className="size-4" />
                  </button>
                  <button
                    onClick={archiveThread}
                    className="grid size-7 place-items-center rounded-sm text-ink-secondary hover:bg-canvas-soft hover:text-ink"
                    title={t("actions.archive")}
                  >
                    <ArchiveIcon className="size-4" />
                  </button>
                  <button
                    onClick={trashThread}
                    className="grid size-7 place-items-center rounded-sm text-ink-secondary hover:bg-canvas-soft hover:text-destructive"
                    title="Löschen (F4)"
                  >
                    <TrashIcon className="size-4" />
                  </button>
                  <button
                    onClick={() => openMailAiAssistant()}
                    disabled={!selectedThreadId}
                    className="grid size-7 place-items-center rounded-sm text-ink-secondary hover:bg-canvas-soft hover:text-ink"
                    title="AI Assistant (Alt+A)"
                  >
                    <SparklesIcon className="size-4 text-primary" />
                  </button>
                  {selectedThreadId && labels.length > 0 && (
                    <select
                      onChange={async (e) => {
                        const labelId = e.target.value;
                        if (!labelId) return;
                        const res = await fetch(
                          `/api/email/threads/${selectedThreadId}/apply-label`,
                          {
                            method: "POST",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({ labelId }),
                          },
                        );
                        if (!res.ok) {
                          toast.error(await res.text());
                        } else {
                          toast.success("Label applied");
                          queryClient.invalidateQueries({ queryKey: ["email"] });
                        }
                        e.target.value = ""; // Reset
                      }}
                      className="h-7 rounded-sm border border-hairline bg-canvas px-1.5 text-[12px] text-ink outline-none focus:border-primary"
                    >
                      <option value="">Apply Label...</option>
                      {labels.map((l) => (
                        <option key={l.emailLabelId} value={l.emailLabelId}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    onClick={() => {
                      openBlankComposer();
                    }}
                    className="ml-auto flex h-7 items-center gap-1.5 rounded-sm bg-primary px-2 text-[12px] text-primary-fg"
                  >
                    <SendIcon className="size-3.5" />
                    {t("email.actions.compose")}
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-auto p-4">
                  {selectedThread ? (
                    <div className="mx-auto flex max-w-4xl flex-col gap-4">
                      <div>
                        <h2 className="text-[18px] text-ink">
                          {selectedThread.subject || "(no subject)"}
                        </h2>
                        <div className="mt-1 flex flex-wrap gap-2 text-[12px] text-ink-mute">
                          <span>
                            {selectedThread.messages.length} {t("email.panels.messages")}
                          </span>
                          <span>{selectedThread.isRead ? "Read" : t("email.panels.unread")}</span>
                          <span>{selectedThread.messageCount} stored</span>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {threadMessages.map((message, index) => {
                          const attachmentRows = threadAttachments.filter(
                            (attachment) => attachment.emailMessageId === message.emailMessageId,
                          );
                          return (
                            <article
                              key={message.emailMessageId}
                              className="rounded-md border border-hairline bg-canvas p-3"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <div className="text-[13px] text-ink">
                                    {fromJsonToPerson(message.fromJson as any)}
                                  </div>
                                  <div className="mt-0.5 text-[12px] text-ink-mute">
                                    To: {parsePeople(message.toJson)}
                                    {message.ccJson?.length
                                      ? ` · Cc: ${parsePeople(message.ccJson)}`
                                      : ""}
                                    {message.bccJson?.length
                                      ? ` · Bcc: ${parsePeople(message.bccJson)}`
                                      : ""}
                                  </div>
                                </div>
                                <div className="shrink-0 text-right text-[11px] text-ink-mute">
                                  <div>
                                    {formatMailboxDate(message.receivedAt ?? message.sentAt)}
                                  </div>
                                  <div>{message.subject ?? ""}</div>
                                </div>
                              </div>
                              {message.bodyHtml ? (
                                <iframe
                                  title="Message HTML Body"
                                  srcDoc={`
                                    <!DOCTYPE html>
                                    <html>
                                      <head>
                                        <style>
                                          body {
                                            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
                                            font-size: 13px;
                                            line-height: 1.5;
                                            color: #1a1a1a;
                                            margin: 0;
                                            padding: 4px;
                                            background: transparent;
                                          }
                                          img {
                                            max-width: 100%;
                                            height: auto;
                                          }
                                        </style>
                                      </head>
                                      <body>
                                        ${message.bodyHtml}
                                      </body>
                                    </html>
                                  `}
                                  sandbox="allow-popups allow-popups-to-escape-sandbox"
                                  className="mt-3 min-h-[150px] w-full resize-y border-0 bg-transparent"
                                  onLoad={(e) => {
                                    const iframe = e.currentTarget;
                                    const doc =
                                      iframe.contentDocument || iframe.contentWindow?.document;
                                    if (doc) {
                                      const adjustHeight = () => {
                                        if (doc.body) {
                                          iframe.style.height = `${Math.max(doc.body.scrollHeight + 20, 150)}px`;
                                        }
                                      };
                                      adjustHeight();
                                      if (typeof ResizeObserver !== "undefined") {
                                        const observer = new ResizeObserver(adjustHeight);
                                        observer.observe(doc.body);
                                      }
                                    }
                                  }}
                                />
                              ) : (
                                <div className="mt-3 text-[13px] whitespace-pre-wrap text-ink">
                                  {message.bodyText || "No body"}
                                </div>
                              )}
                              {attachmentRows.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {attachmentRows.map((attachment) => (
                                    <button
                                      key={attachment.emailAttachmentId}
                                      onClick={async () => {
                                        const res = await fetch(
                                          `/api/email/attachments/${attachment.emailAttachmentId}/fetch`,
                                          { method: "POST" },
                                        );
                                        if (!res.ok) {
                                          toast.error(await res.text());
                                          return;
                                        }
                                        toast.success("Attachment fetch queued");
                                        queryClient.invalidateQueries({ queryKey: ["email"] });
                                      }}
                                      className="rounded-full border border-hairline px-2 py-1 text-[11px] text-ink-secondary hover:text-ink"
                                    >
                                      {attachment.fileName} · {formatBytes(attachment.sizeBytes)}
                                    </button>
                                  ))}
                                </div>
                              )}
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  onClick={() => startReply(index)}
                                  className="rounded-full border border-hairline px-2 py-1 text-[11px] text-ink-secondary hover:text-ink"
                                >
                                  Reply
                                </button>
                                <button
                                  onClick={() => startReplyAll(index)}
                                  className="rounded-full border border-hairline px-2 py-1 text-[11px] text-ink-secondary hover:text-ink"
                                >
                                  Reply All
                                </button>
                                <button
                                  onClick={() => startForward(index)}
                                  className="rounded-full border border-hairline px-2 py-1 text-[11px] text-ink-secondary hover:text-ink"
                                >
                                  Forward
                                </button>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="grid h-full place-items-center text-[13px] text-ink-mute">
                      Select a thread or compose a draft
                    </div>
                  )}
                </div>
              </div>
              <aside className="hidden w-80 flex-none flex-col bg-canvas-soft lg:flex">
                <InspectorPanel
                  title={t("email.panels.inspector")}
                  recordId={selectedThreadId ?? activeAccountId ?? undefined}
                  sections={[
                    {
                      title: t("email.panels.primary"),
                      fields: [
                        {
                          label: t("email.panels.display"),
                          value: activeAccount?.displayName ?? "-",
                        },
                        {
                          label: t("email.panels.primary"),
                          value: activeAccount?.primaryEmail ?? "-",
                        },
                        {
                          label: t("email.panels.provider"),
                          value: activeAccount?.provider ?? "-",
                        },
                        {
                          label: t("email.panels.connection"),
                          value: activeAccount?.status ?? "-",
                        },
                        {
                          label: t("email.panels.syncState"),
                          value: activeAccount?.lastSyncStatus ?? "-",
                        },
                      ],
                    },
                    {
                      title: t("email.panels.thread"),
                      fields: [
                        { label: "Subject", value: selectedThread?.subject ?? "-" },
                        {
                          label: t("email.panels.messages"),
                          value: selectedThread?.messages.length ?? 0,
                        },
                        { label: t("email.panels.attachments"), value: threadAttachments.length },
                        {
                          label: t("email.panels.unread"),
                          value: selectedThread && !selectedThread.isRead ? "Yes" : "No",
                        },
                        {
                          label: "Related Document",
                          value: selectedThread?.relatedDocumentId ? (
                            <a
                              href={`/app/documents?documentId=${selectedThread.relatedDocumentId}`}
                              className="font-medium text-primary hover:underline"
                            >
                              Open Document
                            </a>
                          ) : (
                            "-"
                          ),
                        },
                        {
                          label: "Related Customer",
                          value: selectedThread?.relatedAddressId ? (
                            <a
                              href={`/app/addresses?addressId=${selectedThread.relatedAddressId}`}
                              className="font-medium text-primary hover:underline"
                            >
                              Open Customer
                            </a>
                          ) : (
                            "-"
                          ),
                        },
                      ],
                    },
                    {
                      title: t("email.system.syncStatus"),
                      fields: [
                        { label: t("email.panels.lastError"), value: accountSyncError ?? "-" },
                        {
                          label: t("email.panels.watch"),
                          value: activeAccount?.watchExpiresAt
                            ? formatMailboxDate(activeAccount.watchExpiresAt)
                            : "-",
                        },
                        { label: t("email.panels.label"), value: selectedLabelId ?? "-" },
                      ],
                    },
                  ]}
                />
              </aside>
            </section>
          )
        }
      />
    </>
  );
}
