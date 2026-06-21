import { z } from "zod";

import { DataService } from "../../services/data";
import { defineCapability } from "../core/define";
import { listInputSchema, listOutputSchema, looseRowSchema, runEntityList } from "../core/list";
import { CapabilityError } from "../core/types";

// Read-only reference data backing the documents UI (type/group pickers).
// These are seeded reference rows edited through dedicated admin flows, not the
// generic grid, so only list/get are exposed here.

const idInputSchema = z.object({ id: z.uuid() });

function readOnly(entityName: string, tableName: string, orderBy: string) {
  const list = defineCapability({
    module: "sales",
    entityName,
    operation: "list",
    kind: "read",
    summary: { en: `List ${entityName}`, de: `${entityName} auflisten` },
    input: listInputSchema,
    output: listOutputSchema,
    writesTables: [],
    sideEffects: [],
    idempotent: true,
    supportsDryRun: false,
    minRole: "tenant_user",
    exposure: { llm: "safe", http: true },
    schemaVersion: 1,
    handler: async (ctx, input) => runEntityList(tableName, input.filters, input, orderBy),
  });

  const get = defineCapability({
    module: "sales",
    entityName,
    operation: "get",
    kind: "read",
    summary: { en: `Get ${entityName}`, de: `${entityName} lesen` },
    input: idInputSchema,
    output: looseRowSchema,
    writesTables: [],
    sideEffects: [],
    idempotent: true,
    supportsDryRun: false,
    minRole: "tenant_user",
    exposure: { llm: "safe", http: true },
    schemaVersion: 1,
    handler: async (ctx, input) => {
      const row = await new DataService().get(tableName, input.id);
      if (!row) throw new CapabilityError("not_found", `${entityName} not found`);
      return row;
    },
  });

  return [list, get];
}

export const salesReferenceCapabilities = [
  ...readOnly("documentType", "documentType", "sortOrder:asc"),
  ...readOnly("documentGroup", "documentGroup", "sortOrder:asc"),
];
