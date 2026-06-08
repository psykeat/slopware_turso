import { db } from "@repo/db";
import * as schema from "@repo/db/schema";
import { DocumentService } from "@repo/db/services/document-service";
import { toolDefinition } from "@tanstack/ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

// Helper to resolve document type char
function getDocTypeChar(type: string): string {
  return (
    {
      Offer: "N",
      Order: "A",
      DeliveryNote: "L",
      Invoice: "R",
    }[type] || "A"
  );
}

// ─── Mail Mutation Tools ─────────────────────────────────────────────────────

export const archiveMailThreadTool = toolDefinition({
  name: "archiveMailThread",
  description: "Soft delete / archive an email thread.",
  inputSchema: z.object({
    tenantId: z.string(),
    threadId: z.string(),
  }),
}).server(async (args) => {
  await db
    .update(schema.emailThread)
    .set({ archived: true })
    .where(
      and(
        eq(schema.emailThread.emailThreadId, args.threadId),
        eq(schema.emailThread.tenantId, args.tenantId),
      ),
    );
  return { success: true };
});

export const linkMailThreadToEntityTool = toolDefinition({
  name: "linkMailThreadToEntity",
  description: "Link an email thread to a customer address or a document reference.",
  inputSchema: z.object({
    tenantId: z.string(),
    threadId: z.string(),
    addressId: z.string().optional(),
    documentId: z.string().optional(),
  }),
}).server(async (args) => {
  const updateData: any = {};
  if (args.addressId !== undefined) {
    updateData.relatedAddressId = args.addressId;
  }
  if (args.documentId !== undefined) {
    updateData.relatedDocumentId = args.documentId;
  }

  await db
    .update(schema.emailThread)
    .set(updateData)
    .where(
      and(
        eq(schema.emailThread.emailThreadId, args.threadId),
        eq(schema.emailThread.tenantId, args.tenantId),
      ),
    );
  return { success: true };
});

// ─── Address Mutation Tools ──────────────────────────────────────────────────

export const createAddressTool = toolDefinition({
  name: "createAddress",
  description: "Create a new customer or supplier address book entry.",
  inputSchema: z.object({
    tenantId: z.string(),
    companyName: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    addressLine1: z.string(),
    addressLine2: z.string().optional(),
    postalCode: z.string(),
    city: z.string(),
    countryCode: z.string().max(2),
    isCustomer: z.boolean().optional().default(true),
    isSupplier: z.boolean().optional().default(false),
  }),
}).server(async (args) => {
  // Query next address number sequence if possible, or generate random/fixed one
  const addressNo = "ADR-" + Math.floor(100000 + Math.random() * 900000);

  const [inserted] = await db
    .insert(schema.address)
    .values({
      tenantId: args.tenantId,
      addressNo,
      companyName: args.companyName ?? null,
      firstName: args.firstName ?? null,
      lastName: args.lastName ?? null,
      addressLine1: args.addressLine1,
      addressLine2: args.addressLine2 ?? null,
      postalCode: args.postalCode,
      city: args.city,
      countryCode: args.countryCode,
      isCustomer: args.isCustomer,
      isSupplier: args.isSupplier,
    })
    .returning();

  return {
    addressId: inserted.addressId,
    addressNo: inserted.addressNo,
  };
});

export const updateAddressTool = toolDefinition({
  name: "updateAddress",
  description: "Update details of an existing address book entry.",
  inputSchema: z.object({
    tenantId: z.string(),
    addressId: z.string(),
    companyName: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    addressLine1: z.string().optional(),
    postalCode: z.string().optional(),
    city: z.string().optional(),
    countryCode: z.string().max(2).optional(),
  }),
}).server(async (args) => {
  const updateData: any = {};
  if (args.companyName !== undefined) updateData.companyName = args.companyName;
  if (args.firstName !== undefined) updateData.firstName = args.firstName;
  if (args.lastName !== undefined) updateData.lastName = args.lastName;
  if (args.addressLine1 !== undefined) updateData.addressLine1 = args.addressLine1;
  if (args.postalCode !== undefined) updateData.postalCode = args.postalCode;
  if (args.city !== undefined) updateData.city = args.city;
  if (args.countryCode !== undefined) updateData.countryCode = args.countryCode;

  await db
    .update(schema.address)
    .set(updateData)
    .where(
      and(eq(schema.address.addressId, args.addressId), eq(schema.address.tenantId, args.tenantId)),
    );

  return { success: true };
});

// ─── Document Mutation Tools ─────────────────────────────────────────────────

export const createDocumentDraftTool = toolDefinition({
  name: "createDocumentDraft",
  description: "Create a new document draft (Offer, Order, Invoice) with lines.",
  inputSchema: z.object({
    tenantId: z.string(),
    companyId: z.string().optional(),
    documentType: z.enum(["Offer", "Order", "Invoice", "DeliveryNote"]),
    customerId: z.string(),
    lines: z.array(
      z.object({
        variantId: z.string(),
        quantity: z.number(),
        netPrice: z.number(),
        unit: z.string().optional().default("Stk"),
      }),
    ),
  }),
}).server(async (args) => {
  const docTypeChar = getDocTypeChar(args.documentType);
  const direction =
    docTypeChar === "R" || docTypeChar === "A" || docTypeChar === "N" ? "out" : "in";

  // Resolve companyId
  let companyId = args.companyId;
  if (!companyId) {
    const [comp] = await db
      .select()
      .from(schema.company)
      .where(eq(schema.company.tenantId, args.tenantId))
      .limit(1);
    if (!comp) throw new Error("No company found for tenant");
    companyId = comp.companyId;
  }

  // Resolve documentGroupId
  const grps = await db
    .select()
    .from(schema.documentGroup)
    .where(
      and(
        eq(schema.documentGroup.tenantId, args.tenantId),
        eq(schema.documentGroup.documentType, docTypeChar),
      ),
    )
    .limit(1);

  if (grps.length === 0) {
    throw new Error(`No document group found for type ${args.documentType}`);
  }
  const documentGroupId = grps[0].documentGroupId;

  const docService = new DocumentService();
  const docResult = await docService.createDocument(args.tenantId, {
    documentGroupId,
    documentType: docTypeChar,
    documentDirection: direction,
    documentDate: new Date().toISOString().split("T")[0],
    status: "draft",
    customerId: args.customerId,
    companyId,
  } as any);

  // Add document lines
  for (let i = 0; i < args.lines.length; i++) {
    const line = args.lines[i];
    await docService.createDocumentLine(args.tenantId, {
      documentId: docResult.documentId,
      lineNo: (i + 1) * 10,
      variantId: line.variantId,
      quantity: line.quantity,
      netPrice: line.netPrice,
      unit: line.unit,
      lineType: "article",
    });
  }

  return {
    documentId: docResult.documentId,
    documentNo: docResult.documentNo,
  };
});

export const updateDocumentDraftTool = toolDefinition({
  name: "updateDocumentDraft",
  description: "Update details of an existing document draft.",
  inputSchema: z.object({
    tenantId: z.string(),
    documentId: z.string(),
    status: z.string().optional(),
    customerId: z.string().optional(),
    noteText: z.string().optional(),
  }),
}).server(async (args) => {
  const updateData: any = {};
  if (args.status !== undefined) updateData.status = args.status;
  if (args.customerId !== undefined) updateData.customerId = args.customerId;
  if (args.noteText !== undefined) updateData.noteText = args.noteText;

  await db
    .update(schema.document)
    .set(updateData)
    .where(
      and(
        eq(schema.document.documentId, args.documentId),
        eq(schema.document.tenantId, args.tenantId),
      ),
    );

  return { success: true };
});

export const mutationTools = [
  archiveMailThreadTool,
  linkMailThreadToEntityTool,
  createAddressTool,
  updateAddressTool,
  createDocumentDraftTool,
  updateDocumentDraftTool,
];
