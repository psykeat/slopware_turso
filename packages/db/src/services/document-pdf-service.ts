import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "../index";
import { article, articleImage, company, document, documentLine } from "../schema/sqlite.schema";

// ---------------------------------------------------------------------------
// Render port (dependency injection)
//
// The capability runtime lives in `packages/db`, but the React-PDF renderer and
// its document component live in `apps/web` (they pull in `@repo/ui`, which
// already depends on `@repo/db` — importing them here would create a cycle).
// So data-loading and storage stay in this domain service, and the actual
// rendering is supplied as a port that the web layer registers at server start.
// In-process tests register a trivial fake renderer.
// ---------------------------------------------------------------------------

export interface DocumentPdfLine {
  documentLineId: string;
  lineNo: number;
  articleTextSnapshot: string | null;
  langText: string | null;
  quantity: string | null;
  unit: string | null;
  netPrice: string | null;
  discountPercentage: string | null;
  taxAmount: string | null;
  lineTotalNet: string | null;
  lineType: string;
  bomGroupId?: string | null;
  primaryImageBase64?: string | null;
}

export interface DocumentPdfPrintOptions {
  noteText: boolean;
  preText: boolean;
  postText: boolean;
  stornoText: boolean;
  lineTexts: boolean;
  lineImages: boolean;
}

export interface DocumentPdfDoc {
  documentId: string;
  documentNo: string;
  documentType: string;
  documentDate: string | null;
  billingAddress: Record<string, unknown> | null;
  deliveryAddress: Record<string, unknown> | null;
  noteText: string | null;
  preText: string | null;
  postText: string | null;
  stornoText: string | null;
  totalNet: string | null;
  totalTax: string | null;
  totalGross: string | null;
  currencyId: string | null;
  printOptions: DocumentPdfPrintOptions;
  lines: DocumentPdfLine[];
}

export interface DocumentPdfCompany {
  name: string;
  legalName: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  countryCode: string | null;
  vatId: string | null;
  taxNumber: string | null;
  email: string | null;
  homepage: string | null;
  phoneLandline: string | null;
  bankName: string | null;
  bankIban: string | null;
  bankBic: string | null;
  showArticleImageOnDocuments: boolean | null;
}

export interface DocumentPdfPrintModel {
  doc: DocumentPdfDoc;
  company: DocumentPdfCompany;
  typeLabel: string;
}

export type DocumentPdfRenderer = (model: DocumentPdfPrintModel) => Promise<Uint8Array>;

let registeredRenderer: DocumentPdfRenderer | null = null;

/**
 * Register the server-side PDF renderer. Called once by the web layer at server
 * start; tests register a fake. Idempotent — last registration wins.
 */
export function registerDocumentPdfRenderer(renderer: DocumentPdfRenderer): void {
  registeredRenderer = renderer;
}

export function storageRoot(): string {
  return process.env.STORAGE_PATH || join(homedir(), "slopware/storage");
}

export function documentPdfStorageKey(tenantId: string, documentId: string): string {
  return `tenant-${tenantId}/documents/${documentId}.pdf`;
}

export class DocumentPdfNotRenderableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentPdfNotRenderableError";
  }
}

export class DocumentPdfService {
  /**
   * Load the print model (document header, lines incl. embedded primary-image
   * base64, and company) for a tenant-scoped document. Tenant isolation is
   * enforced on every query. Returns null when the document does not exist.
   */
  async loadPrintModel(
    tenantId: string,
    documentId: string,
  ): Promise<DocumentPdfPrintModel | null> {
    const docs = await db
      .select()
      .from(document)
      .where(eq(document.documentId, documentId))
      .limit(1);
    const doc = docs[0];
    if (!doc) return null;

    const lines = await db
      .select({
        documentLineId: documentLine.documentLineId,
        lineNo: documentLine.lineNo,
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
      .leftJoin(article, eq(documentLine.variantId, article.articleId))
      .where(eq(documentLine.documentId, documentId))
      .orderBy(asc(documentLine.lineNo));

    const companies = await db
      .select()
      .from(company)
      .where(eq(company.companyId, doc.companyId))
      .limit(1);
    const co = companies[0];
    if (!co) throw new DocumentPdfNotRenderableError("Company not found for document");

    const imageBase64s = await this.loadPrimaryImageBase64s(
      tenantId,
      lines.map((l) => l.primaryImageId).filter((id): id is string => !!id),
    );

    const printOptions = ((doc.customAttributes as Record<string, unknown> | null)
      ?.documentPrintOptions ?? {}) as Partial<DocumentPdfPrintOptions>;

    const docForPrint: DocumentPdfDoc = {
      documentId: doc.documentId,
      documentNo: doc.documentNo,
      documentType: doc.documentType,
      documentDate: doc.documentDate,
      billingAddress: doc.billingAddress as Record<string, unknown> | null,
      deliveryAddress: doc.deliveryAddress as Record<string, unknown> | null,
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
        lineImages: printOptions.lineImages ?? co.showArticleImageOnDocuments ?? false,
      },
      lines: lines.map((line) => ({
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
      })),
    };

    const coForPrint: DocumentPdfCompany = {
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

    // The renderer owns human-readable type labels; the model carries the raw
    // documentType as a stable fallback so loading never depends on the port.
    return { doc: docForPrint, company: coForPrint, typeLabel: doc.documentType };
  }

  private async loadPrimaryImageBase64s(
    tenantId: string,
    primaryImageIds: string[],
  ): Promise<Record<string, string>> {
    const imageBase64s: Record<string, string> = {};
    if (primaryImageIds.length === 0) return imageBase64s;

    const imageRecords = await db
      .select()
      .from(articleImage)
      .where(inArray(articleImage.articleImageId, primaryImageIds));

    const baseDir = join(storageRoot(), "..");
    for (const imgRec of imageRecords) {
      try {
        const fileData = await readFile(join(baseDir, imgRec.storageKey));
        imageBase64s[imgRec.articleImageId] =
          `data:${imgRec.mimeType};base64,${fileData.toString("base64")}`;
      } catch (e) {
        console.error(`Failed to read image for print: ${imgRec.articleImageId}`, e);
      }
    }
    return imageBase64s;
  }

  /**
   * Render the document PDF and persist it at the deterministic storage key that
   * `emailOutbox.prepareSend` references. Returns the storage key as `fileId`.
   * This is its own verb — never an implicit side effect of prepareSend.
   */
  async materialize(tenantId: string, documentId: string): Promise<{ fileId: string }> {
    if (!registeredRenderer) {
      throw new DocumentPdfNotRenderableError(
        "No document PDF renderer registered. The web layer must call registerDocumentPdfRenderer at server start.",
      );
    }

    const model = await this.loadPrintModel(tenantId, documentId);
    if (!model) throw new DocumentPdfNotRenderableError("Document not found");

    const pdf = await registeredRenderer(model);

    const storageKey = documentPdfStorageKey(tenantId, documentId);
    await mkdir(join(storageRoot(), `tenant-${tenantId}`, "documents"), { recursive: true });
    await writeFile(join(storageRoot(), storageKey), pdf);

    return { fileId: storageKey };
  }
}
