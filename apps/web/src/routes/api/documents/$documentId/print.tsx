import { createFileRoute } from "@tanstack/react-router";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { db } from "@repo/db";
import { document, documentLine, company } from "@repo/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { auth } from "@repo/auth/auth";
import { resolveTenantContext } from "#/lib/resolve-tenant";
import DocumentPDF, { TYPE_LABELS } from "#/pdf/document-pdf";
import type { DocumentForPrint, CompanyForPrint, DocumentLine } from "#/pdf/document-pdf";

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
          const docs = await db
            .select()
            .from(document)
            .where(
              and(
                eq(document.documentId, params.documentId),
                eq(document.tenantId, context.tenantId),
              ),
            )
            .limit(1);
          const doc = docs[0];
          if (!doc) return new Response("Not found", { status: 404 });

          const lines = await db
            .select()
            .from(documentLine)
            .where(
              and(
                eq(documentLine.documentId, params.documentId),
                eq(documentLine.tenantId, context.tenantId),
              ),
            )
            .orderBy(asc(documentLine.lineNo));

          const companies = await db
            .select()
            .from(company)
            .where(
              and(
                eq(company.companyId, doc.companyId),
                eq(company.tenantId, context.tenantId),
              ),
            )
            .limit(1);
          const co = companies[0];
          if (!co) return new Response("Company not found", { status: 404 });

          const typeLabel = TYPE_LABELS[doc.documentType] ?? doc.documentType;

          const docForPrint: DocumentForPrint = {
            documentId: doc.documentId,
            documentNo: doc.documentNo,
            documentType: doc.documentType,
            documentDate: doc.documentDate,
            billingAddress: doc.billingAddress as Record<string, any> | null,
            deliveryAddress: doc.deliveryAddress as Record<string, any> | null,
            totalNet: doc.totalNet,
            totalTax: doc.totalTax,
            totalGross: doc.totalGross,
            currencyId: doc.currencyId,
            lines: lines.map(
              (line): DocumentLine => ({
                documentLineId: line.documentLineId,
                lineNo: line.lineNo,
                articleTextSnapshot: line.articleTextSnapshot,
                quantity: line.quantity,
                unit: line.unit,
                netPrice: line.netPrice,
                discountPercentage: line.discountPercentage,
                taxAmount: line.taxAmount,
                lineTotalNet: line.lineTotalNet,
                lineType: line.lineType,
              }),
            ),
          };

          const coForPrint: CompanyForPrint = {
            name: co.name,
            legalName: co.legalName,
            addressLine1: co.addressLine1,
            addressLine2: co.addressLine2,
            postalCode: co.postalCode,
            city: co.city,
            countryCode: co.countryCode,
            vatId: co.vatId,
            taxNumber: co.taxNumber,
            email: co.email,
            homepage: co.homepage,
            phoneLandline: co.phoneLandline,
            bankName: co.bankName,
            bankIban: co.bankIban,
            bankBic: co.bankBic,
          };

          const pdfBuffer = await renderToBuffer(
            <DocumentPDF doc={docForPrint} company={coForPrint} typeLabel={typeLabel} />,
          );
          const pdf = new Uint8Array(pdfBuffer);

          const filename = `${typeLabel}-${doc.documentNo}.pdf`;
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
