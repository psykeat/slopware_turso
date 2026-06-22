// Client-side mirror of the server template renderer
// (packages/db/src/services/email/template-service.ts `renderString`). Keep the
// two in sync so the admin-route live preview matches what gets sent.

function lookup(data: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, part) => {
    if (current && typeof current === "object" && part in current) {
      return (current as Record<string, unknown>)[part];
    }
    return undefined;
  }, data);
}

/** Replaces `{{ path.to.value }}` placeholders with values from `data`. */
export function renderTemplatePreview(template: string, data: Record<string, unknown>): string {
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

/** Placeholders available in document email templates, for the help panel. */
export const DOCUMENT_TEMPLATE_VARIABLES: { token: string; description: string }[] = [
  { token: "documentNo", description: "Belegnummer" },
  { token: "documentType", description: "Belegart-Code (N/A/L/R/G)" },
  { token: "documentLabel", description: "Belegart + Nummer, z. B. „Angebot AN-1001“" },
  { token: "company.name", description: "Name der eigenen Firma" },
  { token: "customer.companyName", description: "Firmenname des Kunden" },
  { token: "customer.firstName", description: "Vorname des Kunden" },
  { token: "customer.lastName", description: "Nachname des Kunden" },
  { token: "recipientName", description: "Aufgelöster Empfängername" },
  { token: "recipientEmail", description: "E-Mail des Empfängers" },
  { token: "attachmentFileName", description: "Dateiname des PDF-Anhangs" },
];

/** Sample data used to render the live preview in the template editor. */
export const SAMPLE_TEMPLATE_DATA: Record<string, unknown> = {
  documentNo: "AN-1001",
  documentType: "N",
  documentLabel: "Angebot AN-1001",
  attachmentFileName: "AN-1001.pdf",
  recipientName: "Erika Mustermann",
  recipientEmail: "erika.mustermann@example.com",
  company: { name: "Slopware GmbH" },
  customer: {
    companyName: "Mustermann KG",
    firstName: "Erika",
    lastName: "Mustermann",
  },
};
