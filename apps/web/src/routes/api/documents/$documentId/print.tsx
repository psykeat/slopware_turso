import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@repo/auth/auth";
import { DocumentPdfService } from "@repo/db/services/document-pdf-service";
import { createFileRoute } from "@tanstack/react-router";

import { resolveTenantContext } from "#/lib/resolve-tenant";
import DocumentPDF, { TYPE_LABELS, type CompanyForPrint } from "#/pdf/document-pdf";

export const Route = createFileRoute("/api/documents/$documentId/print")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session || !session.user) {
          return new Response("Unauthorized", { status: 401 });
        }

        const isSystemAdmin = (session.user as any).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) {
          return new Response("No active tenant found", { status: 403 });
        }

        try {
          // Data-loading (incl. embedded primary-image base64) lives in the
          // capability runtime's domain service so this route and the
          // `sales.document.materializePdf` capability share one source of truth.
          const model = await new DocumentPdfService().loadPrintModel(
            context.tenantId,
            params.documentId,
          );
          if (!model) return new Response("Not found", { status: 404 });

          const typeLabel = TYPE_LABELS[model.doc.documentType] ?? model.typeLabel;
          const companyForPrint = {
            ...model.company,
            countryCode: model.company.countryCode ?? "",
            showArticleImageOnDocuments: model.company.showArticleImageOnDocuments ?? undefined,
          } as CompanyForPrint;
          const pdfBuffer = await renderToBuffer(
            <DocumentPDF doc={model.doc} company={companyForPrint} typeLabel={typeLabel} />,
          );
          const pdf = new Uint8Array(pdfBuffer);

          const filename = `${typeLabel}-${model.doc.documentNo}.pdf`;
          return new Response(pdf, {
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
            },
          });
        } catch (err: any) {
          console.error("[print] failed to render document PDF", err);
          return new Response("Internal Server Error", { status: 500 });
        }
      },
    },
  },
});
