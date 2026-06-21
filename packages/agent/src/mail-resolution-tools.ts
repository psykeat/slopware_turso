import { db } from "@repo/db";
import * as schema from "@repo/db/schema";
import { toolDefinition } from "@tanstack/ai";
import { and, eq, like, or, isNull, sql } from "drizzle-orm";
import { z } from "zod";

// Bespoke mail candidate-resolution tools: they rank address/document matches
// with scores and human-readable reasons, which is a read-layer concern that
// the generic capability projection does not model. Everything else the agent
// touches goes through buildCapabilityTools (capability-tools.ts).

type MailLookupCandidate = {
  id: string;
  label: string;
  score: number;
  recommended: boolean;
  reasons: string[];
};

function normalizeLookupText(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function dedupeCandidates(candidates: MailLookupCandidate[]) {
  const map = new Map<string, MailLookupCandidate>();
  for (const candidate of candidates) {
    const existing = map.get(candidate.id);
    if (!existing || candidate.score > existing.score) {
      map.set(candidate.id, candidate);
    }
  }
  return Array.from(map.values()).sort((left, right) => right.score - left.score);
}

function candidateStatus(candidates: MailLookupCandidate[]) {
  if (candidates.length === 1) return "unique_match";
  if (candidates.length > 1) return "multiple_matches";
  return "no_match";
}

function addressLabel(address: {
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  addressNo: string | null;
  city: string | null;
}) {
  const label =
    address.companyName?.trim() ||
    [address.firstName, address.lastName].filter(Boolean).join(" ").trim() ||
    address.addressNo?.trim() ||
    "Unbekannter Geschäftspartner";
  return address.city?.trim() ? `${label} (${address.city.trim()})` : label;
}

function documentLabel(document: {
  documentType: string;
  documentNo: string;
  documentDate: string | Date | null;
  totalGross: string | number | null;
}) {
  const typeName =
    {
      N: "Offer",
      A: "Order",
      L: "DeliveryNote",
      R: "Invoice",
    }[document.documentType] ?? document.documentType;
  const gross = document.totalGross ?? "0.00";
  const dateText =
    document.documentDate instanceof Date
      ? document.documentDate.toISOString().slice(0, 10)
      : (document.documentDate ?? "");
  return `${typeName} ${document.documentNo}${dateText ? ` vom ${dateText}` : ""} (Betrag: ${gross})`;
}

function candidateMatchResult(candidates: MailLookupCandidate[], attempt: string) {
  const ordered = dedupeCandidates(candidates);
  return {
    status: candidateStatus(ordered),
    candidates: ordered.map((candidate) => ({
      id: candidate.id,
      label: candidate.label,
      score: candidate.score,
      recommended: candidate.recommended,
      reasons: candidate.reasons,
    })),
    attempt,
  };
}

export function createMailCustomerLookupTool(params: { tenantId: string }) {
  return toolDefinition({
    name: "lookupMailCustomerCandidates",
    description:
      "Resolve likely customer candidates for an incoming mail thread using sender email, sender name, company name, or a related document reference.",
    inputSchema: z.object({
      senderEmail: z.string().optional(),
      senderName: z.string().optional(),
      companyName: z.string().optional(),
      documentNo: z.string().optional(),
      documentTypeHint: z.enum(["Offer", "Order", "DeliveryNote", "Invoice"]).optional(),
      limit: z.number().int().min(1).max(10).optional().default(5),
    }),
  }).server(async (args) => {
    const limit = args.limit ?? 5;
    const candidates: MailLookupCandidate[] = [];
    const senderEmail = normalizeLookupText(args.senderEmail);
    const senderName = normalizeLookupText(args.senderName);
    const companyName = normalizeLookupText(args.companyName);
    const documentNo = normalizeLookupText(args.documentNo);

    if (senderEmail) {
      const contacts = await db
        .select({
          addressId: schema.addressContact.addressId,
          email: schema.addressContact.email,
          firstName: schema.addressContact.firstName,
          lastName: schema.addressContact.lastName,
        })
        .from(schema.addressContact)
        .where(
          and(
            eq(schema.addressContact.tenantId, params.tenantId),
            eq(schema.addressContact.archived, false),
            sql`lower(${schema.addressContact.email}) = ${senderEmail}`,
          ),
        )
        .limit(limit);

      for (const contact of contacts) {
        const [address] = await db
          .select()
          .from(schema.address)
          .where(
            and(
              eq(schema.address.addressId, contact.addressId),
              eq(schema.address.tenantId, params.tenantId),
              isNull(schema.address.archivedAt),
            ),
          )
          .limit(1);
        if (!address) continue;
        candidates.push({
          id: address.addressId,
          label: addressLabel(address),
          score: 1,
          recommended: true,
          reasons: [`Direkter Treffer über Kontakt-E-Mail: ${args.senderEmail}`],
        });
      }
    }

    if (candidates.length === 0 && companyName) {
      const matches = await db
        .select()
        .from(schema.address)
        .where(
          and(
            eq(schema.address.tenantId, params.tenantId),
            isNull(schema.address.archivedAt),
            or(
              like(schema.address.companyName, `%${args.companyName ?? ""}%`),
              like(schema.address.firstName, `%${args.companyName ?? ""}%`),
              like(schema.address.lastName, `%${args.companyName ?? ""}%`),
              like(schema.address.addressNo, `%${args.companyName ?? ""}%`),
            ) as any,
          ),
        )
        .limit(limit);

      for (const address of matches) {
        candidates.push({
          id: address.addressId,
          label: addressLabel(address),
          score: 0.85,
          recommended: false,
          reasons: [`Fuzzy-Match über Firmennamen: ${args.companyName}`],
        });
      }
    }

    if (candidates.length === 0 && senderName) {
      const matches = await db
        .select()
        .from(schema.address)
        .where(
          and(
            eq(schema.address.tenantId, params.tenantId),
            isNull(schema.address.archivedAt),
            or(
              like(schema.address.companyName, `%${args.senderName ?? ""}%`),
              like(schema.address.firstName, `%${args.senderName ?? ""}%`),
              like(schema.address.lastName, `%${args.senderName ?? ""}%`),
            ) as any,
          ),
        )
        .limit(limit);

      for (const address of matches) {
        candidates.push({
          id: address.addressId,
          label: addressLabel(address),
          score: 0.7,
          recommended: false,
          reasons: [`Fuzzy-Match über Sendername: ${args.senderName}`],
        });
      }
    }

    if (candidates.length === 0 && documentNo) {
      const conditions = [
        eq(schema.document.tenantId, params.tenantId),
        isNull(schema.document.archivedAt),
        eq(schema.document.documentNo, args.documentNo ?? ""),
      ];
      if (args.documentTypeHint) {
        const docTypeChar = {
          Offer: "N",
          Order: "A",
          DeliveryNote: "L",
          Invoice: "R",
        }[args.documentTypeHint];
        if (docTypeChar) {
          conditions.push(eq(schema.document.documentType, docTypeChar));
        }
      }

      const documents = await db
        .select()
        .from(schema.document)
        .where(and(...conditions))
        .limit(limit);

      for (const document of documents) {
        if (!document.customerId) continue;
        const [address] = await db
          .select()
          .from(schema.address)
          .where(
            and(
              eq(schema.address.addressId, document.customerId),
              eq(schema.address.tenantId, params.tenantId),
              isNull(schema.address.archivedAt),
            ),
          )
          .limit(1);
        if (!address) continue;
        candidates.push({
          id: address.addressId,
          label: addressLabel(address),
          score: 0.95,
          recommended: true,
          reasons: [`Kunde aus referenziertem Beleg ${document.documentNo} abgeleitet`],
        });
      }
    }

    return candidateMatchResult(candidates, "customer_lookup");
  });
}

export function createMailDocumentLookupTool(params: { tenantId: string }) {
  return toolDefinition({
    name: "lookupMailReferenceDocumentCandidates",
    description:
      "Resolve likely document candidates for an incoming mail thread using document numbers and type hints.",
    inputSchema: z.object({
      documentNo: z.string().optional(),
      documentTypeHint: z.enum(["Offer", "Order", "DeliveryNote", "Invoice"]).optional(),
      companyName: z.string().optional(),
      subject: z.string().optional(),
      limit: z.number().int().min(1).max(10).optional().default(5),
    }),
  }).server(async (args) => {
    const limit = args.limit ?? 5;
    const candidates: MailLookupCandidate[] = [];
    const documentNo = normalizeLookupText(args.documentNo);

    if (documentNo) {
      const conditions = [
        eq(schema.document.tenantId, params.tenantId),
        isNull(schema.document.archivedAt),
        eq(schema.document.documentNo, args.documentNo ?? ""),
      ];
      if (args.documentTypeHint) {
        const docTypeChar = {
          Offer: "N",
          Order: "A",
          DeliveryNote: "L",
          Invoice: "R",
        }[args.documentTypeHint];
        if (docTypeChar) {
          conditions.push(eq(schema.document.documentType, docTypeChar));
        }
      }

      const documents = await db
        .select()
        .from(schema.document)
        .where(and(...conditions))
        .limit(limit);

      for (const document of documents) {
        candidates.push({
          id: document.documentId,
          label: documentLabel(document),
          score: 1,
          recommended: true,
          reasons: [`Direkter Treffer auf Belegnummer: ${args.documentNo}`],
        });
      }
    }

    if (candidates.length === 0 && args.companyName) {
      const matches = await db
        .select()
        .from(schema.document)
        .where(
          and(
            eq(schema.document.tenantId, params.tenantId),
            isNull(schema.document.archivedAt),
            or(
              like(schema.document.documentNo, `%${args.companyName}%`),
              like(schema.document.noteText, `%${args.companyName}%`),
              like(schema.document.preText, `%${args.companyName}%`),
            ) as any,
          ),
        )
        .limit(limit);

      for (const document of matches) {
        candidates.push({
          id: document.documentId,
          label: documentLabel(document),
          score: 0.8,
          recommended: false,
          reasons: [`Fuzzy-Match über Firma/Begleittext: ${args.companyName}`],
        });
      }
    }

    if (candidates.length === 0 && args.subject) {
      const matches = await db
        .select()
        .from(schema.document)
        .where(
          and(
            eq(schema.document.tenantId, params.tenantId),
            isNull(schema.document.archivedAt),
            or(
              like(schema.document.documentNo, `%${args.subject}%`),
              like(schema.document.noteText, `%${args.subject}%`),
              like(schema.document.preText, `%${args.subject}%`),
            ) as any,
          ),
        )
        .limit(limit);

      for (const document of matches) {
        candidates.push({
          id: document.documentId,
          label: documentLabel(document),
          score: 0.65,
          recommended: false,
          reasons: [`Fuzzy-Match über Betreff: ${args.subject}`],
        });
      }
    }

    return candidateMatchResult(candidates, "document_lookup");
  });
}

export function createMailResolutionTools(params: { tenantId: string }) {
  return [createMailCustomerLookupTool(params), createMailDocumentLookupTool(params)];
}
