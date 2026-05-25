import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { auth } from "@repo/auth/auth";
import { db } from "@repo/db";
import { document, documentLine, company, article, articleImage } from "@repo/db/schema";
import { createFileRoute } from "@tanstack/react-router";
import { eq, and, asc, inArray } from "drizzle-orm";
import React from "react";

import { resolveTenantContext } from "#/lib/resolve-tenant";
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

          // Join article to obtain primaryImageId for each document line
          const lines = await db
            .select({
              documentLineId: documentLine.documentLineId,
              lineNo: documentLine.lineNo,
              articleId: documentLine.articleId,
              articleTextSnapshot: documentLine.articleTextSnapshot,
              langText: documentLine.langText,
              quantity: documentLine.quantity,
              unit: documentLine.unit,
              netPrice: documentLine.netPrice,
              discountPercentage: documentLine.discountPercentage,
              taxAmount: documentLine.taxAmount,
              lineTotalNet: documentLine.lineTotalNet,
              lineType: documentLine.lineType,
              bomGroupId: documentLine.bomGroupId,
              primaryImageId: article.primaryImageId,
            })
            .from(documentLine)
            .leftJoin(article, eq(documentLine.articleId, article.articleId))
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
              and(eq(company.companyId, doc.companyId), eq(company.tenantId, context.tenantId)),
            )
            .limit(1);
          const co = companies[0];
          if (!co) return new Response("Company not found", { status: 404 });

          // Load image binary files from disk and encode as base64 for PDF rendering
          const primaryImageIds = lines
            .map((l) => l.primaryImageId)
            .filter((id): id is string => !!id);

          const imageBase64s: Record<string, string> = {};
          if (primaryImageIds.length > 0) {
            const imageRecords = await db
              .select()
              .from(articleImage)
              .where(
                and(
                  inArray(articleImage.articleImageId, primaryImageIds),
                  eq(articleImage.tenantId, context.tenantId),
                ),
              );

            const storageRoot = process.env.STORAGE_PATH || "/home/joerg/slopware/storage";
            const baseDir = join(storageRoot, "..");

            for (const imgRec of imageRecords) {
              try {
                const absolutePath = join(baseDir, imgRec.storageKey);
                const fileData = await readFile(absolutePath);
                const base64 = fileData.toString("base64");
                imageBase64s[imgRec.articleImageId] = `data:${imgRec.mimeType};base64,${base64}`;
              } catch (e) {
                console.error(`Failed to read image for print: ${imgRec.articleImageId}`, e);
              }
            }
          }

          // Lazy-load PDF engine and component
          const [pdfRenderer, pdfComponent] = await Promise.all([
            import("@react-pdf/renderer"),
            import("#/pdf/document-pdf"),
          ]);
          const { renderToBuffer } = pdfRenderer;
          const { default: DocumentPDF, TYPE_LABELS } = pdfComponent as unknown as {
            default: React.ComponentType<any>;
            TYPE_LABELS: Record<string, string>;
          };

          const typeLabel = TYPE_LABELS[doc.documentType] ?? doc.documentType;
          const printOptions = ((doc.customAttributes as any)?.documentPrintOptions ?? {}) as {
            noteText?: boolean;
            preText?: boolean;
            postText?: boolean;
            stornoText?: boolean;
            lineTexts?: boolean;
          };

          const docForPrint: DocumentForPrint = {
            documentId: doc.documentId,
            documentNo: doc.documentNo,
            documentType: doc.documentType,
            documentDate: doc.documentDate,
            billingAddress: doc.billingAddress as Record<string, any> | null,
            deliveryAddress: doc.deliveryAddress as Record<string, any> | null,
            noteText: doc.noteText ?? null,
            preText: doc.preText ?? null,
            postText: doc.postText ?? null,
            stornoText: doc.stornoText ?? null,
            totalNet: doc.totalNet,
            totalTax: doc.totalTax,
            totalGross: doc.totalGross,
            currencyId: doc.currencyId,
            printOptions: {
              noteText: printOptions.noteText ?? co.printAddressLongText ?? true,
              preText: printOptions.preText ?? co.printPreText ?? true,
              postText: printOptions.postText ?? co.printPostText ?? true,
              stornoText: printOptions.stornoText ?? true,
              lineTexts: printOptions.lineTexts ?? co.printPositionTexts ?? true,
            },
            lines: lines.map(
              (line): DocumentLine => ({
                documentLineId: line.documentLineId,
                lineNo: line.lineNo,
                articleTextSnapshot: line.articleTextSnapshot,
                langText: line.langText ?? null,
                quantity: line.quantity,
                unit: line.unit,
                netPrice: line.netPrice,
                discountPercentage: line.discountPercentage,
                taxAmount: line.taxAmount,
                lineTotalNet: line.lineTotalNet,
                lineType: line.lineType,
                bomGroupId: line.bomGroupId ?? null,
                primaryImageBase64: line.primaryImageId
                  ? (imageBase64s[line.primaryImageId] ?? null)
                  : null,
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
            showArticleImageOnDocuments: co.showArticleImageOnDocuments,
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
