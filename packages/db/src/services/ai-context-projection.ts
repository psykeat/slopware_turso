import { and, eq } from "drizzle-orm";

import { db } from "../index";
import { aiContextProjection } from "../schema/app.schema";
import * as schema from "../schema/index";

// Helper to format recipient list/object safely
function formatMailPerson(person: any): string {
  if (!person) return "";
  if (typeof person === "string") return person;
  if (person.name && person.address) return `${person.name} <${person.address}>`;
  if (person.address) return person.address;
  return JSON.stringify(person);
}

function parseMailRecipients(recipients: any): string {
  if (!recipients) return "";
  if (typeof recipients === "string") return recipients;
  if (Array.isArray(recipients)) {
    return recipients.map(formatMailPerson).join(", ");
  }
  return formatMailPerson(recipients);
}

function stripEmailQuotes(text: string): string {
  if (!text) return "";
  return text
    .split("\n")
    .filter((line) => !line.trim().startsWith(">") && !line.trim().match(/^On .* wrote:$/i))
    .join("\n")
    .trim();
}

export async function buildMailThreadProjection(threadId: string, tenantId: string) {
  const [thread] = await db
    .select()
    .from(schema.emailThread)
    .where(
      and(
        eq(schema.emailThread.emailThreadId, threadId),
        eq(schema.emailThread.tenantId, tenantId),
      ),
    )
    .limit(1);

  if (!thread) return null;

  const messages = await db
    .select()
    .from(schema.emailMessage)
    .where(
      and(
        eq(schema.emailMessage.emailThreadId, threadId),
        eq(schema.emailMessage.tenantId, tenantId),
      ),
    );

  const recentMessages = messages.slice(-5);
  const skippedCount = Math.max(0, messages.length - 5);

  let messagesText = recentMessages
    .map((msg: any) => {
      const from = formatMailPerson(msg.fromJson);
      const to = parseMailRecipients(msg.toJson);
      const cleanBody = stripEmailQuotes(msg.bodyText);
      let text = `From: ${from}\nTo: ${to}`;
      if (msg.subject) text += `\nSubject: ${msg.subject}`;
      text += `\n\n${cleanBody}`;
      return text;
    })
    .join("\n\n---\n\n");

  if (skippedCount > 0) {
    messagesText =
      `[... ${skippedCount} ältere Nachrichten ausgeblendet ...]\n\n---\n\n` + messagesText;
  }

  return {
    threadId: thread.emailThreadId,
    subject: thread.subject,
    relatedDocumentId: thread.relatedDocumentId,
    relatedAddressId: thread.relatedAddressId,
    messages: messages.map((m: any) => ({
      messageId: m.emailMessageId,
      direction: m.direction,
      fromJson: m.fromJson,
      toJson: m.toJson,
      subject: m.subject,
      bodyText: m.bodyText,
    })),
    contentText: `Subject: ${thread.subject || "(no subject)"}\nMessages:\n${messagesText}`,
  };
}

export async function buildDocumentProjection(documentId: string, tenantId: string) {
  const [doc] = await db
    .select()
    .from(schema.document)
    .where(and(eq(schema.document.documentId, documentId), eq(schema.document.tenantId, tenantId)))
    .limit(1);

  if (!doc) return null;

  const lines = await db
    .select()
    .from(schema.documentLine)
    .where(
      and(
        eq(schema.documentLine.documentId, documentId),
        eq(schema.documentLine.tenantId, tenantId),
      ),
    );

  return {
    documentId: doc.documentId,
    documentNo: doc.documentNo,
    documentType: doc.documentType,
    documentDirection: doc.documentDirection,
    status: doc.status,
    customerId: doc.customerId,
    currencyId: doc.currencyId,
    documentDate: doc.documentDate,
    totalNet: doc.totalNet,
    totalTax: doc.totalTax,
    totalGross: doc.totalGross,
    billingAddress: doc.billingAddress,
    deliveryAddress: doc.deliveryAddress,
    noteText: doc.noteText,
    preText: doc.preText,
    lines: lines.map((l: any) => ({
      documentLineId: l.documentLineId,
      lineNo: l.lineNo,
      articleId: l.articleId,
      articleTextSnapshot: l.articleTextSnapshot,
      langText: l.langText,
      quantity: l.quantity,
      unit: l.unit,
      netPrice: l.netPrice,
      lineTotalNet: l.lineTotalNet,
    })),
    contentText: `Document Type: ${doc.documentType || "Unknown"}\nDocument No: ${doc.documentNo || "Unknown"}\nDate: ${doc.documentDate ? String(doc.documentDate).split("T")[0] : "Unknown"}\nTotal Net: ${doc.totalNet}\nTotal Gross: ${doc.totalGross}\n\nLines:\n${lines.map((l: any) => `- ${l.quantity || 1}x ${l.unit || ""} ${l.langText || "Item"} (Total Net: ${l.lineTotalNet || 0})`).join("\n")}`,
  };
}

export async function buildAddressProjection(addressId: string, tenantId: string) {
  const [addr] = await db
    .select()
    .from(schema.address)
    .where(and(eq(schema.address.addressId, addressId), eq(schema.address.tenantId, tenantId)))
    .limit(1);

  if (!addr) return null;

  return {
    addressId: addr.addressId,
    addressNo: addr.addressNo,
    isCustomer: addr.isCustomer,
    isSupplier: addr.isSupplier,
    companyName: addr.companyName,
    firstName: addr.firstName,
    lastName: addr.lastName,
    addressLine1: addr.addressLine1,
    addressLine2: addr.addressLine2,
    postalCode: addr.postalCode,
    city: addr.city,
    countryCode: addr.countryCode,
    vatId: addr.vatId,
    notiztext: addr.notiztext,
    langtext: addr.langtext,
    contentText: [
      addr.companyName ? `Company: ${addr.companyName}` : "",
      addr.firstName || addr.lastName
        ? `Contact: ${addr.firstName || ""} ${addr.lastName || ""}`.trim()
        : "",
      addr.addressLine1 ? `Address: ${addr.addressLine1}` : "",
      addr.addressLine2 ? `Address 2: ${addr.addressLine2}` : "",
      addr.city || addr.postalCode
        ? `City/ZIP: ${addr.postalCode || ""} ${addr.city || ""}`.trim()
        : "",
      addr.countryCode ? `Country: ${addr.countryCode}` : "",
      addr.vatId ? `VAT ID: ${addr.vatId}` : "",
      addr.notiztext ? `Notes:\n${addr.notiztext}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export async function buildArticleProjection(articleId: string, tenantId: string) {
  const [art] = await db
    .select()
    .from(schema.article)
    .where(and(eq(schema.article.articleId, articleId), eq(schema.article.tenantId, tenantId)))
    .limit(1);

  if (!art) return null;

  return {
    articleId: art.articleId,
    articleNo: art.articleNo,
    name: art.name,
    kurzbeschreibung: art.kurzbeschreibung,
    description: art.description,
    notiztext: art.notiztext,
    langtext: art.langtext,
    contentText: [
      art.articleNo ? `Article No: ${art.articleNo}` : "",
      art.name ? `Name: ${art.name}` : "",
      art.kurzbeschreibung ? `Short Desc: ${art.kurzbeschreibung}` : "",
      art.description ? `Description:\n${art.description}` : "",
      art.notiztext ? `Notes:\n${art.notiztext}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export async function getOrCreateContextProjection(params: {
  sessionId: string;
  tenantId: string;
  focusType: string;
  focusId: string;
  editorSelectionPayload?: any;
}) {
  const { sessionId, tenantId, focusType, focusId, editorSelectionPayload } = params;

  // Check if projection already exists in db
  const [existing] = await db
    .select()
    .from(aiContextProjection)
    .where(
      and(
        eq(aiContextProjection.sessionId, sessionId),
        eq(aiContextProjection.tenantId, tenantId),
        eq(aiContextProjection.focusType, focusType),
        eq(aiContextProjection.focusId, focusId),
      ),
    )
    .limit(1);

  if (existing) {
    return existing.snapshot;
  }

  let snapshot: any = null;

  if (focusType === "mail_thread" || focusType === "emailThread") {
    snapshot = await buildMailThreadProjection(focusId, tenantId);
  } else if (focusType === "document") {
    snapshot = await buildDocumentProjection(focusId, tenantId);
  } else if (focusType === "address") {
    snapshot = await buildAddressProjection(focusId, tenantId);
  } else if (focusType === "article") {
    snapshot = await buildArticleProjection(focusId, tenantId);
  } else if (focusType === "editor_selection") {
    snapshot = {
      editorSelectionId: focusId,
      payload: editorSelectionPayload || {},
    };
  }

  if (!snapshot) {
    throw new Error(`Context projection source not found: ${focusType}/${focusId}`);
  }

  // Persist projection snapshot
  await db.insert(aiContextProjection).values({
    sessionId,
    tenantId,
    focusType,
    focusId,
    snapshot,
    createdAt: new Date(),
  });

  return snapshot;
}
