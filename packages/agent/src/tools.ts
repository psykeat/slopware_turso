import { db } from "@repo/db";
import * as schema from "@repo/db/schema";
import { toolDefinition } from "@tanstack/ai";
import { and, eq, like, or, isNull, sql } from "drizzle-orm";
import { z } from "zod";

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

// ─── Mail Read Tools ─────────────────────────────────────────────────────────

export const listMailThreadsTool = toolDefinition({
  name: "listMailThreads",
  description: "List email threads with optional filters for a given tenant.",
  inputSchema: z.object({
    tenantId: z.string(),
    limit: z.number().optional().default(20),
    offset: z.number().optional().default(0),
  }),
}).server(async (args) => {
  const threads = await db
    .select()
    .from(schema.emailThread)
    .where(
      and(eq(schema.emailThread.tenantId, args.tenantId), eq(schema.emailThread.archived, false)),
    )
    .limit(args.limit ?? 20)
    .offset(args.offset ?? 0);
  return { threads };
});

export const getMailThreadTool = toolDefinition({
  name: "getMailThread",
  description: "Get detailed information about a single email thread including all messages.",
  inputSchema: z.object({
    tenantId: z.string(),
    threadId: z.string(),
  }),
}).server(async (args) => {
  const [thread] = await db
    .select()
    .from(schema.emailThread)
    .where(
      and(
        eq(schema.emailThread.emailThreadId, args.threadId),
        eq(schema.emailThread.tenantId, args.tenantId),
      ),
    )
    .limit(1);

  if (!thread) {
    throw new Error("Thread not found");
  }

  const messages = await db
    .select()
    .from(schema.emailMessage)
    .where(
      and(
        eq(schema.emailMessage.emailThreadId, args.threadId),
        eq(schema.emailMessage.tenantId, args.tenantId),
      ),
    );

  return { thread, messages };
});

// ─── Document Read Tools ─────────────────────────────────────────────────────

export const listDocumentsTool = toolDefinition({
  name: "listDocuments",
  description: "List documents (Offer, Order, Invoice, DeliveryNote) with optional type filter.",
  inputSchema: z.object({
    tenantId: z.string(),
    documentType: z.enum(["Offer", "Order", "Invoice", "DeliveryNote"]).optional(),
    limit: z.number().optional().default(20),
  }),
}).server(async (args) => {
  const docTypeChar = args.documentType
    ? {
        Offer: "N",
        Order: "A",
        DeliveryNote: "L",
        Invoice: "R",
      }[args.documentType]
    : undefined;

  const conditions = [
    eq(schema.document.tenantId, args.tenantId),
    isNull(schema.document.archivedAt),
  ];
  if (docTypeChar) {
    conditions.push(eq(schema.document.documentType, docTypeChar));
  }

  const documents = await db
    .select()
    .from(schema.document)
    .where(and(...conditions))
    .limit(args.limit ?? 20);

  return { documents };
});

export const getDocumentTool = toolDefinition({
  name: "getDocument",
  description: "Get details of a single document including its line items.",
  inputSchema: z.object({
    tenantId: z.string(),
    documentId: z.string(),
  }),
}).server(async (args) => {
  const [document] = await db
    .select()
    .from(schema.document)
    .where(
      and(
        eq(schema.document.documentId, args.documentId),
        eq(schema.document.tenantId, args.tenantId),
      ),
    )
    .limit(1);

  if (!document) {
    throw new Error("Document not found");
  }

  const lines = await db
    .select()
    .from(schema.documentLine)
    .where(
      and(
        eq(schema.documentLine.documentId, args.documentId),
        eq(schema.documentLine.tenantId, args.tenantId),
      ),
    );

  return { document, lines };
});

// ─── Address Read Tools ──────────────────────────────────────────────────────

export const listAddressesTool = toolDefinition({
  name: "listAddresses",
  description: "List address book records with customer/supplier and text search filters.",
  inputSchema: z.object({
    tenantId: z.string(),
    isCustomer: z.boolean().optional(),
    isSupplier: z.boolean().optional(),
    search: z.string().optional(),
    limit: z.number().optional().default(20),
  }),
}).server(async (args) => {
  const conditions = [
    eq(schema.address.tenantId, args.tenantId),
    isNull(schema.address.archivedAt),
  ];
  if (args.isCustomer !== undefined) {
    conditions.push(eq(schema.address.isCustomer, args.isCustomer));
  }
  if (args.isSupplier !== undefined) {
    conditions.push(eq(schema.address.isSupplier, args.isSupplier));
  }
  if (args.search) {
    conditions.push(
      or(
        like(schema.address.companyName, `%${args.search}%`),
        like(schema.address.firstName, `%${args.search}%`),
        like(schema.address.lastName, `%${args.search}%`),
        like(schema.address.addressNo, `%${args.search}%`),
      ) as any,
    );
  }

  const addresses = await db
    .select()
    .from(schema.address)
    .where(and(...conditions))
    .limit(args.limit ?? 20);

  return { addresses };
});

export const getAddressTool = toolDefinition({
  name: "getAddress",
  description: "Get details of a single address book entry.",
  inputSchema: z.object({
    tenantId: z.string(),
    addressId: z.string(),
  }),
}).server(async (args) => {
  const [address] = await db
    .select()
    .from(schema.address)
    .where(
      and(eq(schema.address.addressId, args.addressId), eq(schema.address.tenantId, args.tenantId)),
    )
    .limit(1);

  if (!address) {
    throw new Error("Address not found");
  }

  return { address };
});

// ─── Article Tools ───────────────────────────────────────────────────────────

export const listArticlesTool = toolDefinition({
  name: "listArticles",
  description: "List or search article registry entries.",
  inputSchema: z.object({
    tenantId: z.string(),
    search: z.string().optional(),
    limit: z.number().optional().default(20),
  }),
}).server(async (args) => {
  const conditions = [
    eq(schema.article.tenantId, args.tenantId),
    isNull(schema.article.archivedAt),
  ];
  if (args.search) {
    conditions.push(
      or(
        like(schema.article.name, `%${args.search}%`),
        like(schema.article.articleNo, `%${args.search}%`),
        like(schema.article.description, `%${args.search}%`),
      ) as any,
    );
  }

  const articles = await db
    .select()
    .from(schema.article)
    .where(and(...conditions))
    .limit(args.limit ?? 20);

  return { articles };
});

export const getArticleTool = toolDefinition({
  name: "getArticle",
  description: "Get detailed information about a single article.",
  inputSchema: z.object({
    tenantId: z.string(),
    articleId: z.string(),
  }),
}).server(async (args) => {
  const [article] = await db
    .select()
    .from(schema.article)
    .where(
      and(eq(schema.article.articleId, args.articleId), eq(schema.article.tenantId, args.tenantId)),
    )
    .limit(1);

  if (!article) {
    throw new Error("Article not found");
  }

  return { article };
});

// ─── Mail Resolution Tools ──────────────────────────────────────────────────

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

export const readTools = [
  listMailThreadsTool,
  getMailThreadTool,
  listDocumentsTool,
  getDocumentTool,
  listAddressesTool,
  getAddressTool,
  listArticlesTool,
  getArticleTool,
];
