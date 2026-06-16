import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { and, eq, isNull } from "drizzle-orm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from apps/web/.env
dotenv.config({ path: path.resolve(__dirname, "../../../../apps/web/.env") });

import { db } from "../index";
import * as schema from "../schema/app.schema";

// Default tenant email templates for document mail. Document reference goes into
// the subject (header); the body is static German prose with a few placeholders.
// Available placeholders are resolved by EmailDocumentService.getDocumentEmailDefaults:
//   documentNo, documentType, documentLabel, attachmentFileName,
//   company.name, customer.companyName/firstName/lastName, recipientName, ...
function body(intro: string): string {
  return [
    "<p>Sehr geehrte Damen und Herren,</p>",
    `<p>${intro} im Anhang als PDF-Dokument ({{attachmentFileName}}).</p>`,
    "<p>Für Rückfragen stehen wir Ihnen gerne zur Verfügung.</p>",
    "<p>Mit freundlichen Grüßen<br/>{{company.name}}</p>",
  ].join("");
}

type TemplateSeed = {
  code: string;
  name: string;
  subjectTemplate: string;
  bodyHtmlTemplate: string;
  // null documentType → generic fallback binding (no document-type scope)
  documentType: string | null;
};

const TEMPLATES: TemplateSeed[] = [
  {
    code: "document-N",
    name: "Angebot",
    subjectTemplate: "{{company.name}}: Angebot {{documentNo}}",
    bodyHtmlTemplate: body("anbei erhalten Sie unser Angebot {{documentNo}}"),
    documentType: "N",
  },
  {
    code: "document-A",
    name: "Auftragsbestätigung",
    subjectTemplate: "{{company.name}}: Auftragsbestätigung {{documentNo}}",
    bodyHtmlTemplate: body("anbei erhalten Sie unsere Auftragsbestätigung {{documentNo}}"),
    documentType: "A",
  },
  {
    code: "document-L",
    name: "Lieferschein",
    subjectTemplate: "{{company.name}}: Lieferschein {{documentNo}}",
    bodyHtmlTemplate: body("anbei erhalten Sie den Lieferschein {{documentNo}}"),
    documentType: "L",
  },
  {
    code: "document-R",
    name: "Rechnung",
    subjectTemplate: "{{company.name}}: Rechnung {{documentNo}}",
    bodyHtmlTemplate: body("anbei erhalten Sie unsere Rechnung {{documentNo}}"),
    documentType: "R",
  },
  {
    code: "document-G",
    name: "Gutschrift",
    subjectTemplate: "{{company.name}}: Gutschrift {{documentNo}}",
    bodyHtmlTemplate: body("anbei erhalten Sie die Gutschrift {{documentNo}}"),
    documentType: "G",
  },
  {
    code: "document-default",
    name: "Beleg (Standard)",
    subjectTemplate: "{{company.name}}: {{documentLabel}}",
    bodyHtmlTemplate: body("anbei erhalten Sie {{documentLabel}}"),
    documentType: null,
  },
];

const CATEGORY = "document";

async function ensureTemplate(tenantId: string, seed: TemplateSeed): Promise<string> {
  await db
    .insert(schema.emailTemplate)
    .values({
      tenantId,
      category: CATEGORY,
      code: seed.code,
      name: seed.name,
      subjectTemplate: seed.subjectTemplate,
      bodyHtmlTemplate: seed.bodyHtmlTemplate,
      bodyTextTemplate: null,
      language: "de",
    })
    .onConflictDoNothing();

  const [row] = await db
    .select({ id: schema.emailTemplate.emailTemplateId })
    .from(schema.emailTemplate)
    .where(
      and(
        eq(schema.emailTemplate.tenantId, tenantId),
        eq(schema.emailTemplate.category, CATEGORY),
        eq(schema.emailTemplate.code, seed.code),
      ),
    )
    .limit(1);

  if (!row) throw new Error(`Failed to upsert email template ${seed.code}`);
  return row.id;
}

async function ensureBinding(
  tenantId: string,
  emailTemplateId: string,
  documentType: string | null,
): Promise<boolean> {
  const [existing] = await db
    .select({ id: schema.emailTemplateBinding.emailTemplateBindingId })
    .from(schema.emailTemplateBinding)
    .where(
      and(
        eq(schema.emailTemplateBinding.tenantId, tenantId),
        eq(schema.emailTemplateBinding.emailTemplateId, emailTemplateId),
        documentType
          ? eq(schema.emailTemplateBinding.documentType, documentType)
          : isNull(schema.emailTemplateBinding.documentType),
      ),
    )
    .limit(1);

  if (existing) return false;

  await db.insert(schema.emailTemplateBinding).values({
    tenantId,
    emailTemplateId,
    documentType,
    priority: 100,
  });
  return true;
}

async function main() {
  const tenants = await db.select().from(schema.tenant);
  if (tenants.length === 0) {
    throw new Error("No tenants found in the database. Run seed first.");
  }

  console.log(`Seeding document email templates for ${tenants.length} tenant(s)...`);

  for (const tenant of tenants) {
    let createdBindings = 0;
    for (const seed of TEMPLATES) {
      const templateId = await ensureTemplate(tenant.tenantId, seed);
      const created = await ensureBinding(tenant.tenantId, templateId, seed.documentType);
      if (created) createdBindings += 1;
    }
    console.log(
      `  ${tenant.slug ?? tenant.tenantId}: ${TEMPLATES.length} templates ensured, ${createdBindings} binding(s) created`,
    );
  }

  console.log("Done.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
