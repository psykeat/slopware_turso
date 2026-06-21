import { and, isNull } from "drizzle-orm";
import { z } from "zod";

import { db, eq } from "../../index";
import { agent, address } from "../../schema/sqlite.schema";
import { DataService } from "../../services/data";
import { defineCapability } from "../core/define";
import { defineListCapability } from "../core/list";
import { CapabilityError } from "../core/types";

const agentRecordSchema = z.looseObject({
  agentId: z.uuid(),
  agentNo: z.string(),
  name: z.string().nullable().optional(),
  addressId: z.uuid().nullable().optional(),
  userId: z.string().nullable().optional(),
  commissionRate: z.string().nullable().optional(),
  active: z.boolean(),
  archivedAt: z.date().nullable().optional(),
  customAttributes: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date().nullable().optional(),
});

const agentWritableFields = z.object({
  name: z.string().nullable().optional(),
  addressId: z.uuid().nullable().optional(),
  userId: z.string().nullable().optional(),
  commissionRate: z.string().nullable().optional(),
  active: z.boolean().optional(),
  customAttributes: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const agentList = defineListCapability({
  module: "masterdata",
  entityName: "agent",
  summary: { en: "List sales agents", de: "Vertreter auflisten" },
  recordSchema: agentRecordSchema,
  defaultOrderBy: "agentNo:asc",
});

export const agentGet = defineCapability({
  module: "masterdata",
  entityName: "agent",
  operation: "get",
  kind: "read",
  summary: { en: "Get a sales agent by id", de: "Vertreter per ID lesen" },
  input: z.object({ agentId: z.uuid() }),
  output: agentRecordSchema,
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const row = await new DataService().get("agent", input.agentId);
    if (!row) throw new CapabilityError("not_found", "Agent not found");
    return row;
  },
});

export const agentUpsert = defineCapability({
  module: "masterdata",
  entityName: "agent",
  operation: "upsert",
  kind: "update",
  summary: { en: "Create or update a sales agent", de: "Vertreter anlegen oder ändern" },
  description: {
    en: "agentNo is the natural key. Optionally link to an address record (external agent) or a system user (internal rep).",
    de: "agentNo ist der natürliche Schlüssel. Optional kann eine Adresse (externer Vertreter) oder ein Systemuser (interner Mitarbeiter) verknüpft werden.",
  },
  input: z.object({
    agentNo: z.string().trim().min(1),
    ...agentWritableFields.shape,
  }),
  output: z.object({ agent: agentRecordSchema, created: z.boolean() }),
  writesTables: ["agent"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const service = new DataService();
    const [existing] = await db
      .select({ agentId: agent.agentId, archivedAt: agent.archivedAt })
      .from(agent)
      .where(eq(agent.agentNo, input.agentNo))
      .limit(1);

    if (existing?.archivedAt) {
      throw new CapabilityError(
        "conflict",
        `Agent "${input.agentNo}" is archived; unarchive it first`,
      );
    }

    if (existing) {
      const { agentNo: _no, ...patch } = input;
      const [updated] = await service.patch("agent", existing.agentId, patch);
      if (!updated) throw new CapabilityError("not_found", "Agent not found");
      return { agent: updated, created: false };
    }

    const [created] = await service.create("agent", input);
    return { agent: created, created: true };
  },
});

export const agentLinkAddresses = defineCapability({
  module: "masterdata",
  entityName: "agent",
  operation: "linkAddresses",
  kind: "update",
  summary: {
    en: "Link agent records to their address entries and populate address.agentId FKs",
    de: "Vertreter mit Adresseinträgen verknüpfen und address.agentId FKs befüllen",
  },
  description: {
    en: "Post-import reconciliation: for each address where customAttributes.agentNo is set, find the matching agent by agentNo and write address.agentId. Also ensures agent records exist for all referenced agentNos.",
    de: "Nach dem Import: für jede Adresse mit customAttributes.agentNo den passenden Vertreter suchen und address.agentId setzen.",
  },
  input: z.object({}),
  output: z.object({
    linked: z.number().int(),
    created: z.number().int(),
    unresolved: z.number().int(),
  }),
  writesTables: ["agent", "address"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_admin",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (_ctx, _input) => {
    // Find all addresses that have a pending agentNo in customAttributes
    const pending = await db
      .select({
        addressId: address.addressId,
        agentNo: address.customAttributes,
        companyName: address.companyName,
      })
      .from(address)
      .where(and(isNull(address.agentId), isNull(address.archivedAt)))
      .limit(1000);

    let linked = 0;
    let created = 0;
    let unresolved = 0;

    for (const row of pending) {
      const attrs = row.agentNo as Record<string, unknown> | null;
      const agentNo = attrs?.agentNo as string | undefined;
      if (!agentNo) continue;

      let [agentRow] = await db
        .select({ agentId: agent.agentId })
        .from(agent)
        .where(eq(agent.agentNo, agentNo))
        .limit(1);

      if (!agentRow) {
        // Find address record for this agent and create agent entry
        const [agentAddress] = await db
          .select({ addressId: address.addressId, companyName: address.companyName })
          .from(address)
          .where(eq(address.addressNo, agentNo))
          .limit(1);

        const [newAgent] = await db
          .insert(agent)
          .values({
            agentNo,
            name: agentAddress?.companyName ?? agentNo,
            addressId: agentAddress?.addressId ?? null,
            active: true,
          })
          .onConflictDoNothing()
          .returning({ agentId: agent.agentId });

        if (newAgent) {
          agentRow = newAgent;
          created++;
        } else {
          unresolved++;
          continue;
        }
      }

      await db
        .update(address)
        .set({ agentId: agentRow.agentId, updatedAt: new Date() })
        .where(eq(address.addressId, row.addressId));
      linked++;
    }

    return { linked, created, unresolved };
  },
});

export const agentArchive = defineCapability({
  module: "masterdata",
  entityName: "agent",
  operation: "archive",
  kind: "archive",
  summary: { en: "Archive a sales agent", de: "Vertreter archivieren" },
  description: {
    en: "Soft delete: the agent is archived via archivedAt, never hard-deleted.",
    de: "Soft Delete: der Vertreter wird über archivedAt archiviert, nie hart gelöscht.",
  },
  input: z.object({ agentId: z.uuid() }),
  output: z.object({ agentId: z.uuid(), archivedAt: z.date().nullable() }),
  writesTables: ["agent"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "confirm", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const [updated] = await new DataService().patch("agent", input.agentId, {
      archived: true,
    });
    if (!updated) throw new CapabilityError("not_found", "Agent not found");
    return { agentId: input.agentId, archivedAt: updated.archivedAt ?? new Date() };
  },
});

export const agentCapabilities = [
  agentList,
  agentGet,
  agentUpsert,
  agentArchive,
  agentLinkAddresses,
];
