import { z } from "zod";

import { DataService } from "../../services/data";
import { defineCapability } from "../core/define";
import { listInputSchema, listOutputSchema, looseRowSchema, runEntityList } from "../core/list";
import { CapabilityError } from "../core/types";

// Read-only template surfaces backing the email-templates admin page and the
// render-log viewer. Templates/bindings are authored through dedicated flows;
// here we only expose the list/get reads the UI uses.

const idInputSchema = z.object({ id: z.uuid() });

function readOnly(entityName: string, tableName: string, orderBy: string) {
  const list = defineCapability({
    module: "communication",
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
    handler: async (ctx, input) =>
      runEntityList(ctx.tenantId, tableName, input.filters, input, orderBy),
  });

  const get = defineCapability({
    module: "communication",
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
      const row = await new DataService(ctx.tenantId).get(tableName, input.id);
      if (!row) throw new CapabilityError("not_found", `${entityName} not found`);
      return row;
    },
  });

  return [list, get];
}

export const emailTemplateCapabilities = [
  ...readOnly("emailTemplate", "emailTemplate", "updatedAt:desc"),
  ...readOnly("emailTemplateBinding", "emailTemplateBinding", "priority:asc"),
  ...readOnly("emailTemplateRenderLog", "emailTemplateRenderLog", "createdAt:desc"),
];
