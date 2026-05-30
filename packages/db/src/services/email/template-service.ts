import { and, asc, eq, isNull, or } from "drizzle-orm";

import { db } from "../../index";
import {
  emailTemplate,
  emailTemplateBinding,
  emailTemplateRenderLog,
} from "../../schema/app.schema";

function lookup(data: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, part) => {
    if (current && typeof current === "object" && part in current) {
      return (current as Record<string, unknown>)[part];
    }
    return undefined;
  }, data);
}

function renderString(template: string, data: Record<string, unknown>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key: string) => {
    const value = lookup(data, key);
    if (value == null) return "";
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    if (value instanceof Date) return value.toISOString();
    return JSON.stringify(value);
  });
}

function htmlToText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function bindingSpecificity(binding: {
  documentType: string | null;
  companyId: string | null;
  language: string | null;
  emailIdentityId: string | null;
}) {
  return [
    binding.documentType,
    binding.companyId,
    binding.language,
    binding.emailIdentityId,
  ].filter(Boolean).length;
}

export class EmailTemplateService {
  constructor(
    private tenantId: string,
    private userId: string,
  ) {}

  async render(input: {
    category?: string | null;
    templateId?: string | null;
    documentType?: string | null;
    companyId?: string | null;
    language?: string | null;
    emailIdentityId?: string | null;
    documentId?: string | null;
    data?: Record<string, unknown>;
  }) {
    const templateId = input.templateId?.trim() || null;
    const resolved = templateId
      ? await this.getTemplateById(templateId, input.category?.trim() || "document")
      : await this.resolveTemplate({
          category: input.category?.trim() || "document",
          documentType: input.documentType?.trim() || null,
          companyId: input.companyId?.trim() || null,
          language: input.language?.trim() || null,
          emailIdentityId: input.emailIdentityId?.trim() || null,
        });
    if (!resolved) throw new Error("Email template not found");

    const data = input.data ?? {};
    const subject = renderString(resolved.template.subjectTemplate, data);
    const bodyHtml = renderString(resolved.template.bodyHtmlTemplate, data);
    const bodyText = resolved.template.bodyTextTemplate
      ? renderString(resolved.template.bodyTextTemplate, data)
      : htmlToText(bodyHtml);

    await db.insert(emailTemplateRenderLog).values({
      tenantId: this.tenantId,
      emailTemplateId: resolved.template.emailTemplateId,
      emailTemplateBindingId: resolved.binding?.emailTemplateBindingId,
      documentId: input.documentId ?? null,
      emailIdentityId: input.emailIdentityId ?? null,
      language: input.language ?? resolved.template.language,
      subject,
      renderedHash: null,
      createdBy: this.userId,
    });

    return { subject, bodyHtml, bodyText, template: resolved.template, binding: resolved.binding };
  }

  private async getTemplateById(templateId: string, category: string) {
    const [template] = await db
      .select()
      .from(emailTemplate)
      .where(
        and(
          eq(emailTemplate.tenantId, this.tenantId),
          eq(emailTemplate.emailTemplateId, templateId),
          eq(emailTemplate.category, category),
          eq(emailTemplate.archived, false),
        ),
      )
      .limit(1);
    return template ? { template, binding: null } : null;
  }

  private async resolveTemplate(input: {
    category?: string | null;
    documentType?: string | null;
    companyId?: string | null;
    language?: string | null;
    emailIdentityId?: string | null;
  }) {
    const rows = await db
      .select({ template: emailTemplate, binding: emailTemplateBinding })
      .from(emailTemplateBinding)
      .innerJoin(
        emailTemplate,
        eq(emailTemplate.emailTemplateId, emailTemplateBinding.emailTemplateId),
      )
      .where(
        and(
          eq(emailTemplateBinding.tenantId, this.tenantId),
          eq(emailTemplate.category, input.category?.trim() || "document"),
          eq(emailTemplateBinding.archived, false),
          eq(emailTemplate.archived, false),
          input.documentType
            ? or(
                eq(emailTemplateBinding.documentType, input.documentType),
                isNull(emailTemplateBinding.documentType),
              )
            : isNull(emailTemplateBinding.documentType),
          input.companyId
            ? or(
                eq(emailTemplateBinding.companyId, input.companyId),
                isNull(emailTemplateBinding.companyId),
              )
            : isNull(emailTemplateBinding.companyId),
          input.language
            ? or(
                eq(emailTemplateBinding.language, input.language),
                isNull(emailTemplateBinding.language),
              )
            : isNull(emailTemplateBinding.language),
          input.emailIdentityId
            ? or(
                eq(emailTemplateBinding.emailIdentityId, input.emailIdentityId),
                isNull(emailTemplateBinding.emailIdentityId),
              )
            : isNull(emailTemplateBinding.emailIdentityId),
        ),
      )
      .orderBy(asc(emailTemplateBinding.priority), asc(emailTemplate.createdAt));

    const resolved = rows.sort((left, right) => {
      const specificityDelta = bindingSpecificity(right.binding) - bindingSpecificity(left.binding);
      if (specificityDelta !== 0) return specificityDelta;
      if (left.binding.priority !== right.binding.priority)
        return left.binding.priority - right.binding.priority;
      return Number(left.template.createdAt) - Number(right.template.createdAt);
    });

    return resolved[0] ?? null;
  }
}
