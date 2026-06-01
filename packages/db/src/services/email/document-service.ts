import { and, eq } from "drizzle-orm";

import { db } from "../../index";
import { address, addressContact, company, document, emailIdentity } from "../../schema/app.schema";
import { EmailSendService } from "./send-service";
import { EmailTemplateService } from "./template-service";
import type { EmailAddress } from "./types";

function documentLabel(type: string | null | undefined, no: string | null | undefined) {
  return [type, no].filter(Boolean).join(" ");
}

function fallbackRecipientName(customer: {
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}) {
  const companyName = customer.companyName?.trim() || "";
  const personName = [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim();
  return companyName || personName || null;
}

export class EmailDocumentService {
  constructor(
    private tenantId: string,
    private userId: string,
  ) {}

  private async getDocumentMailContext(input: { documentId: string; emailIdentityId: string }) {
    const [row] = await db
      .select({
        doc: document,
        customer: address,
        company: company,
        contact: addressContact,
        identity: emailIdentity,
      })
      .from(document)
      .innerJoin(company, eq(company.companyId, document.companyId))
      .innerJoin(emailIdentity, eq(emailIdentity.emailIdentityId, input.emailIdentityId))
      .leftJoin(address, eq(address.addressId, document.customerId))
      .leftJoin(
        addressContact,
        and(
          eq(addressContact.tenantId, this.tenantId),
          eq(addressContact.addressId, document.customerId),
          eq(addressContact.isPrimary, true),
          eq(addressContact.archived, false),
        ),
      )
      .where(
        and(
          eq(document.tenantId, this.tenantId),
          eq(document.documentId, input.documentId),
          eq(emailIdentity.tenantId, this.tenantId),
          eq(emailIdentity.canSend, true),
          eq(emailIdentity.archived, false),
        ),
      )
      .limit(1);

    if (!row) throw new Error("Document or sending identity not found");
    return row;
  }

  async getDocumentEmailDefaults(input: {
    documentId: string;
    emailIdentityId: string;
    templateId?: string | null;
    language?: string | null;
  }) {
    const row = await this.getDocumentMailContext(input);

    const recipientEmail = row.contact?.email?.trim() || null;

    const documentLabelText =
      documentLabel(row.doc.documentType, row.doc.documentNo) ||
      row.doc.documentNo ||
      row.doc.documentId;
    const recipientName = fallbackRecipientName(row.customer ?? {});
    const attachmentFileName = row.doc.documentNo
      ? `${row.doc.documentNo}.pdf`
      : `${row.doc.documentId}.pdf`;
    const warnings: string[] = [];
    if (!recipientEmail) {
      warnings.push(
        "Document customer has no email address. Add a recipient in the composer before sending.",
      );
    }
    const templateData = {
      document: row.doc,
      customer: row.customer,
      company: row.company,
      documentLabel: documentLabelText,
      documentId: row.doc.documentId,
      documentNo: row.doc.documentNo,
      documentType: row.doc.documentType,
      companyName: row.company.name,
      recipientEmail,
      recipientName,
      attachmentFileName,
    };

    let rendered: Awaited<ReturnType<EmailTemplateService["render"]>> | null = null;

    try {
      rendered = await new EmailTemplateService(this.tenantId, this.userId).render({
        category: "document",
        templateId: input.templateId?.trim() || null,
        documentType: row.doc.documentType,
        companyId: row.doc.companyId,
        language: input.language?.trim() || null,
        emailIdentityId: input.emailIdentityId,
        documentId: input.documentId,
        data: templateData,
      });
    } catch {
      rendered = null;
    }

    const subject = rendered?.subject || `${row.company.name}: ${documentLabelText}`;
    const bodyText = rendered?.bodyText || `Hello,\n\nattached is ${documentLabelText}.\n`;
    const bodyHtml = rendered?.bodyHtml || `<p>Hello,</p><p>attached is ${documentLabelText}.</p>`;

    const attachment = {
      fileName: attachmentFileName,
      contentType: "application/pdf",
      storageKey: `tenant-${this.tenantId}/documents/${row.doc.documentId}.pdf`,
      sizeBytes: null,
    };

    return {
      accountId: row.identity.emailAccountId,
      emailIdentityId: input.emailIdentityId,
      to: recipientEmail ? [{ email: recipientEmail, name: recipientName ?? undefined }] : [],
      cc: [] as EmailAddress[],
      bcc: [] as EmailAddress[],
      subject,
      bodyHtml,
      bodyText,
      templateId: rendered?.template.emailTemplateId ?? null,
      bindingId: rendered?.binding?.emailTemplateBindingId ?? null,
      recipient: {
        email: recipientEmail,
        name: recipientName,
      },
      warnings,
      attachments: [attachment],
      document: {
        documentId: row.doc.documentId,
        documentNo: row.doc.documentNo,
        documentType: row.doc.documentType,
      },
    };
  }

  async prepareDocumentEmail(input: {
    documentId: string;
    emailIdentityId: string;
    templateId?: string | null;
    language?: string | null;
    to?: EmailAddress[];
    cc?: EmailAddress[];
    bcc?: EmailAddress[];
    subject?: string | null;
    bodyText?: string | null;
    bodyHtml?: string | null;
  }) {
    const defaults = await this.getDocumentEmailDefaults(input);

    const draft = await new EmailSendService(this.tenantId, this.userId).saveDraft({
      accountId: defaults.accountId,
      identityId: input.emailIdentityId,
      to: input.to ?? defaults.to,
      cc: input.cc ?? defaults.cc,
      bcc: input.bcc ?? defaults.bcc,
      subject: input.subject?.trim() || defaults.subject,
      bodyHtml: input.bodyHtml ?? defaults.bodyHtml,
      bodyText: input.bodyText ?? defaults.bodyText,
      attachments: defaults.attachments,
      relatedDocumentId: input.documentId,
    });

    return {
      draft,
      subject: input.subject?.trim() || defaults.subject,
      bodyHtml: input.bodyHtml ?? defaults.bodyHtml,
      bodyText: input.bodyText ?? defaults.bodyText,
      templateId: defaults.templateId,
      bindingId: defaults.bindingId,
      recipient: defaults.recipient,
      warnings: defaults.warnings,
      attachments: defaults.attachments,
    };
  }
}
