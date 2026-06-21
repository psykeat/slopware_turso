import { renderToBuffer } from "@react-pdf/renderer";
import {
  registerDocumentPdfRenderer,
  type DocumentPdfPrintModel,
} from "@repo/db/services/document-pdf-service";

import DocumentPDF, { TYPE_LABELS, type CompanyForPrint } from "#/pdf/document-pdf";

// Server-side wiring for the capability runtime's document-PDF render port.
// `packages/db` cannot import the React-PDF component (it pulls in `@repo/ui`,
// which depends on `@repo/db`), so the web layer supplies the renderer here and
// the capability (`sales.document.materializePdf`) calls it through the port.
// Imported for its side effect from `lib/capability-auth.ts`, the single place
// where HTTP callers become an ExecutionContext — so it is registered before any
// server-side capability execution.
registerDocumentPdfRenderer(async (model: DocumentPdfPrintModel) => {
  const typeLabel = TYPE_LABELS[model.doc.documentType] ?? model.typeLabel;
  const company = {
    ...model.company,
    countryCode: model.company.countryCode ?? "",
    showArticleImageOnDocuments: model.company.showArticleImageOnDocuments ?? undefined,
  } as CompanyForPrint;
  const buffer = await renderToBuffer(
    <DocumentPDF doc={model.doc} company={company} typeLabel={typeLabel} />,
  );
  return new Uint8Array(buffer);
});
