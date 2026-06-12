import { z } from "zod";

import { EmailAccountService, EmailAuthorizationError } from "../../services/email/account-service";
import { EmailDocumentService } from "../../services/email/document-service";
import { EmailSendService } from "../../services/email/send-service";
import { EmailSyncService } from "../../services/email/sync-service";
import { defineCapability } from "../core/define";
import { CapabilityError, type ExecutionContext } from "../core/types";

const looseRowSchema = z.looseObject({});

const addressSchema = z.object({
  email: z.string().trim().min(1),
  name: z.string().nullable().optional(),
});

// Email services enforce per-account grants by userId; "system" bypasses the
// grant check, which is exactly right for system/test actors without a user.
function actorUserId(ctx: ExecutionContext): string {
  return ctx.userId ?? "system";
}

async function withEmailAuthMapped<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof EmailAuthorizationError) {
      throw new CapabilityError("forbidden", error.message);
    }
    throw error;
  }
}

export const emailThreadList = defineCapability({
  module: "communication",
  entityName: "emailThread",
  operation: "list",
  kind: "read",
  summary: { en: "List email threads", de: "E-Mail-Threads auflisten" },
  input: z.object({
    accountId: z.uuid().optional(),
    labelId: z.string().optional(),
    folder: z.string().optional(),
    search: z.string().trim().min(1).optional(),
    limit: z.number().int().min(1).max(200).default(50),
    offset: z.number().int().min(0).default(0),
  }),
  output: z.object({ items: z.array(looseRowSchema) }),
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) =>
    withEmailAuthMapped(async () => {
      const items = await new EmailSyncService(ctx.tenantId, actorUserId(ctx)).listThreads({
        accountId: input.accountId ?? null,
        labelId: input.labelId ?? null,
        folder: input.folder ?? null,
        search: input.search ?? null,
        limit: input.limit,
        offset: input.offset,
      });
      return { items: items as z.output<typeof looseRowSchema>[] };
    }),
});

export const emailThreadGet = defineCapability({
  module: "communication",
  entityName: "emailThread",
  operation: "get",
  kind: "read",
  summary: { en: "Get an email thread with messages", de: "E-Mail-Thread mit Nachrichten lesen" },
  input: z.object({ threadId: z.uuid() }),
  output: looseRowSchema,
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) =>
    withEmailAuthMapped(async () => {
      const thread = await new EmailSyncService(ctx.tenantId, actorUserId(ctx)).getThread(
        input.threadId,
      );
      if (!thread) throw new CapabilityError("not_found", "Email thread not found");
      return thread;
    }),
});

export const emailThreadArchive = defineCapability({
  module: "communication",
  entityName: "emailThread",
  operation: "archive",
  kind: "archive",
  summary: { en: "Archive an email thread", de: "E-Mail-Thread archivieren" },
  description: {
    en: "Soft-archives the thread and removes it from the provider inbox. No data is deleted.",
    de: "Archiviert den Thread (soft) und entfernt ihn aus der Provider-Inbox. Es werden keine Daten gelöscht.",
  },
  input: z.object({ threadId: z.uuid() }),
  output: z.object({ ok: z.literal(true) }),
  writesTables: ["emailThread"],
  sideEffects: ["removes the INBOX label at the email provider"],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) =>
    withEmailAuthMapped(async () => {
      const result = await new EmailSyncService(ctx.tenantId, actorUserId(ctx)).archiveThread(
        input.threadId,
      );
      if (!result) throw new CapabilityError("not_found", "Email thread not found");
      return { ok: true as const };
    }),
});

export const emailThreadMarkRead = defineCapability({
  module: "communication",
  entityName: "emailThread",
  operation: "markRead",
  kind: "update",
  summary: { en: "Mark an email thread read/unread", de: "E-Mail-Thread (un)gelesen markieren" },
  input: z.object({
    threadId: z.uuid(),
    read: z.boolean().default(true),
  }),
  output: z.object({ ok: z.literal(true) }),
  writesTables: ["emailThread", "emailMessage"],
  sideEffects: ["updates the read state at the email provider"],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) =>
    withEmailAuthMapped(async () => {
      const result = await new EmailSyncService(ctx.tenantId, actorUserId(ctx)).markRead(
        input.threadId,
        input.read,
      );
      if (!result) throw new CapabilityError("not_found", "Email thread not found");
      return { ok: true as const };
    }),
});

export const emailThreadLink = defineCapability({
  module: "communication",
  entityName: "emailThread",
  operation: "link",
  kind: "update",
  summary: {
    en: "Link an email thread to an address and/or document",
    de: "E-Mail-Thread mit Adresse und/oder Beleg verknüpfen",
  },
  description: {
    en: "Pass null to unlink. Omitted fields stay unchanged.",
    de: "Mit null wird die Verknüpfung entfernt. Nicht übergebene Felder bleiben unverändert.",
  },
  input: z
    .object({
      threadId: z.uuid(),
      addressId: z.uuid().nullable().optional(),
      documentId: z.uuid().nullable().optional(),
    })
    .refine((value) => value.addressId !== undefined || value.documentId !== undefined, {
      message: "addressId or documentId must be provided",
    }),
  output: looseRowSchema,
  writesTables: ["emailThread"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) =>
    withEmailAuthMapped(async () => {
      const updated = await new EmailSyncService(ctx.tenantId, actorUserId(ctx)).linkThread(
        input.threadId,
        { addressId: input.addressId, documentId: input.documentId },
      );
      if (!updated) throw new CapabilityError("not_found", "Email thread not found");
      return updated;
    }),
});

export const emailAccountList = defineCapability({
  module: "communication",
  entityName: "emailAccount",
  operation: "list",
  kind: "read",
  summary: { en: "List connected email accounts", de: "Verbundene E-Mail-Konten auflisten" },
  input: z.object({}),
  output: z.object({ items: z.array(looseRowSchema) }),
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx) =>
    withEmailAuthMapped(async () => {
      const items = await new EmailAccountService(ctx.tenantId, actorUserId(ctx)).listAccounts();
      return { items: items as z.output<typeof looseRowSchema>[] };
    }),
});

export const emailOutboxComposeDefaults = defineCapability({
  module: "communication",
  entityName: "emailOutbox",
  operation: "composeDefaults",
  kind: "read",
  summary: {
    en: "Resolve compose defaults for a document email",
    de: "Compose-Vorgaben für eine Beleg-E-Mail ermitteln",
  },
  description: {
    en: "Resolves recipient, subject, body and attachment defaults for sending a document by email. Read-only — nothing is created or sent.",
    de: "Ermittelt Empfänger, Betreff, Text und Anhang-Vorgaben für den Belegversand per E-Mail. Nur lesend — es wird nichts angelegt oder versendet.",
  },
  input: z.object({
    documentId: z.uuid(),
    emailIdentityId: z.uuid(),
    templateId: z.uuid().nullable().optional(),
    language: z.string().nullable().optional(),
  }),
  output: looseRowSchema,
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) =>
    withEmailAuthMapped(() =>
      new EmailDocumentService(ctx.tenantId, actorUserId(ctx)).getDocumentEmailDefaults({
        documentId: input.documentId,
        emailIdentityId: input.emailIdentityId,
        templateId: input.templateId ?? null,
        language: input.language ?? null,
      }),
    ),
});

export const emailOutboxPrepareSend = defineCapability({
  module: "communication",
  entityName: "emailOutbox",
  operation: "prepareSend",
  kind: "create",
  summary: {
    en: "Prepare a document email draft (no send)",
    de: "Beleg-E-Mail-Entwurf vorbereiten (kein Versand)",
  },
  description: {
    en: "Creates a draft outbox entry with resolved recipients, body and the document PDF attachment reference. Sending requires communication.emailOutbox.confirmSend with the returned outbox id. The PDF file itself must already be materialized by the caller (web layer renders it).",
    de: "Erzeugt einen Outbox-Entwurf mit aufgelösten Empfängern, Text und PDF-Anhang-Referenz. Der Versand erfordert communication.emailOutbox.confirmSend mit der zurückgegebenen Outbox-Id. Die PDF-Datei selbst muss vom Aufrufer bereits materialisiert sein (Rendering liegt im Web-Layer).",
  },
  input: z.object({
    documentId: z.uuid(),
    emailIdentityId: z.uuid(),
    templateId: z.uuid().nullable().optional(),
    language: z.string().nullable().optional(),
    to: z.array(addressSchema).optional(),
    cc: z.array(addressSchema).optional(),
    bcc: z.array(addressSchema).optional(),
    subject: z.string().nullable().optional(),
    bodyText: z.string().nullable().optional(),
    bodyHtml: z.string().nullable().optional(),
  }),
  output: looseRowSchema,
  writesTables: ["emailThread", "emailMessage", "emailOutbox", "emailAttachment"],
  sideEffects: [],
  idempotent: false,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) =>
    withEmailAuthMapped(() =>
      new EmailDocumentService(ctx.tenantId, actorUserId(ctx)).prepareDocumentEmail({
        documentId: input.documentId,
        emailIdentityId: input.emailIdentityId,
        templateId: input.templateId ?? null,
        language: input.language ?? null,
        to: input.to?.map((entry) => ({ email: entry.email, name: entry.name ?? null })),
        cc: input.cc?.map((entry) => ({ email: entry.email, name: entry.name ?? null })),
        bcc: input.bcc?.map((entry) => ({ email: entry.email, name: entry.name ?? null })),
        subject: input.subject ?? null,
        bodyText: input.bodyText ?? null,
        bodyHtml: input.bodyHtml ?? null,
      }),
    ),
});

export const emailOutboxConfirmSend = defineCapability({
  module: "communication",
  entityName: "emailOutbox",
  operation: "confirmSend",
  kind: "process",
  summary: { en: "Send a prepared email draft", de: "Vorbereiteten E-Mail-Entwurf versenden" },
  description: {
    en: "Final, irreversible send of a draft created by prepareSend (or the drafts UI). The outbox id is the confirmation token.",
    de: "Finaler, nicht umkehrbarer Versand eines mit prepareSend (oder dem Drafts-UI) erzeugten Entwurfs. Die Outbox-Id ist das Bestätigungstoken.",
  },
  input: z.object({ outboxId: z.uuid() }),
  output: looseRowSchema,
  writesTables: ["emailOutbox", "emailMessage", "emailThread"],
  sideEffects: ["sends the email through the provider"],
  idempotent: false,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "confirm", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) =>
    withEmailAuthMapped(async () => {
      const result = await new EmailSendService(ctx.tenantId, actorUserId(ctx)).sendDraft(
        input.outboxId,
      );
      return result as z.output<typeof looseRowSchema>;
    }),
});

export const communicationEmailCapabilities = [
  emailThreadList,
  emailThreadGet,
  emailThreadArchive,
  emailThreadMarkRead,
  emailThreadLink,
  emailAccountList,
  emailOutboxComposeDefaults,
  emailOutboxPrepareSend,
  emailOutboxConfirmSend,
];
