import { z } from "zod";

import { DataService } from "../../services/data";
import { defineCapability } from "../core/define";
import { listInputSchema, listOutputSchema, looseRowSchema, runEntityList } from "../core/list";
import { CapabilityError } from "../core/types";

const idInputSchema = z.object({ id: z.uuid() });

const patchInputSchema = z.object({
  id: z.uuid(),
  patch: z
    .record(z.string(), z.unknown())
    .refine((patch) => Object.keys(patch).length > 0, { message: "patch must not be empty" }),
});

function crud(
  entityName: string,
  tableName: string,
  orderBy: string,
  minRole: "tenant_user" | "tenant_admin" = "tenant_user",
  archivable = true,
) {
  const list = defineCapability({
    module: "masterdata",
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
    minRole,
    exposure: { llm: "safe", http: true },
    schemaVersion: 1,
    handler: async (ctx, input) => runEntityList(tableName, input.filters, input, orderBy),
  });

  const get = defineCapability({
    module: "masterdata",
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
    minRole,
    exposure: { llm: "safe", http: true },
    schemaVersion: 1,
    handler: async (ctx, input) => {
      const row = await new DataService().get(tableName, input.id);
      if (!row) throw new CapabilityError("not_found", `${entityName} not found`);
      return row;
    },
  });

  const create = defineCapability({
    module: "masterdata",
    entityName,
    operation: "create",
    kind: "create",
    summary: { en: `Create ${entityName}`, de: `${entityName} anlegen` },
    input: z.record(z.string(), z.unknown()),
    output: looseRowSchema,
    writesTables: [tableName],
    sideEffects: [],
    idempotent: false,
    supportsDryRun: false,
    minRole,
    exposure: { llm: "safe", http: true },
    schemaVersion: 1,
    handler: async (ctx, input) => {
      const [created] = await new DataService().create(tableName, input);
      return created;
    },
  });

  const update = defineCapability({
    module: "masterdata",
    entityName,
    operation: "update",
    kind: "update",
    summary: { en: `Update ${entityName}`, de: `${entityName} ändern` },
    input: patchInputSchema,
    output: looseRowSchema,
    writesTables: [tableName],
    sideEffects: [],
    idempotent: true,
    supportsDryRun: false,
    minRole,
    exposure: { llm: "safe", http: true },
    schemaVersion: 1,
    handler: async (ctx, input) => {
      const [updated] = await new DataService().patch(tableName, input.id, input.patch);
      if (!updated) throw new CapabilityError("not_found", `${entityName} not found`);
      return updated;
    },
  });

  const archive = archivable
    ? defineCapability({
        module: "masterdata",
        entityName,
        operation: "archive",
        kind: "archive",
        summary: { en: `Archive ${entityName}`, de: `${entityName} archivieren` },
        input: idInputSchema,
        output: z.object({ id: z.uuid(), archived: z.literal(true) }),
        writesTables: [tableName],
        sideEffects: [],
        idempotent: true,
        supportsDryRun: false,
        minRole,
        exposure: { llm: "confirm", http: true },
        schemaVersion: 1,
        handler: async (ctx, input) => {
          const [updated] = await new DataService().patch(tableName, input.id, {
            archived: true,
          });
          if (!updated) throw new CapabilityError("not_found", `${entityName} not found`);
          return { id: input.id, archived: true as const };
        },
      })
    : null;

  return { list, get, create, update, archive };
}

const costCenter = crud("costCenter", "costCenter", "code:asc");
const incoterm = crud("incoterm", "incoterm", "code:asc", "tenant_admin");
const industry = crud("industry", "industry", "createdAt:desc");
const warehouse = crud("warehouse", "warehouse", "code:asc");
const numberSequence = crud("numberSequence", "numberSequence", "prefix:asc");
const shippingMethod = crud("shippingMethod", "shippingMethod", "createdAt:desc");
const taxClass = crud("taxClass", "taxClass", "code:asc");
const taxCode = crud("taxCode", "taxCode", "code:asc");
const taxRule = crud("taxRule", "taxRule", "validFrom:desc", "tenant_user", false);
const bankAccount = crud("bankAccount", "bankAccount", "createdAt:desc");
const postalCode = crud("postalCode", "postalCode", "countryCode:asc");
const productionOrder = crud("productionOrder", "productionOrder", "createdAt:desc");
const addressCategory = crud("addressCategory", "addressCategory", "createdAt:desc");
const addressContact = crud("addressContact", "addressContact", "lastName:asc");
const priceListItem = crud(
  "priceListItem",
  "priceListItem",
  "createdAt:desc",
  "tenant_user",
  false,
);
const fiscalPeriodList = defineCapability({
  module: "masterdata",
  entityName: "fiscalPeriod",
  operation: "list",
  kind: "read",
  summary: { en: "List fiscal periods", de: "Geschäftsperioden auflisten" },
  input: listInputSchema,
  output: listOutputSchema,
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_admin",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) =>
    runEntityList("fiscalPeriod", input.filters, input, "fiscalYear:desc"),
});

const fiscalPeriodGet = defineCapability({
  module: "masterdata",
  entityName: "fiscalPeriod",
  operation: "get",
  kind: "read",
  summary: { en: "Get a fiscal period", de: "Geschäftsperiode lesen" },
  input: idInputSchema,
  output: looseRowSchema,
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_admin",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const row = await new DataService().get("fiscalPeriod", input.id);
    if (!row) throw new CapabilityError("not_found", "Fiscal period not found");
    return row;
  },
});

const fiscalPeriodCreate = defineCapability({
  module: "masterdata",
  entityName: "fiscalPeriod",
  operation: "create",
  kind: "create",
  summary: { en: "Create a fiscal period", de: "Geschäftsperiode anlegen" },
  input: z.object({
    companyId: z.uuid(),
    fiscalYear: z.number().int(),
    periodNo: z.number().int(),
    startDate: z.string(),
    endDate: z.string(),
    isClosed: z.boolean().optional(),
  }),
  output: looseRowSchema,
  writesTables: ["fiscalPeriod"],
  sideEffects: [],
  idempotent: false,
  supportsDryRun: false,
  minRole: "tenant_admin",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const [created] = await new DataService().create("fiscalPeriod", input);
    return created;
  },
});

const fiscalPeriodUpdate = defineCapability({
  module: "masterdata",
  entityName: "fiscalPeriod",
  operation: "update",
  kind: "update",
  summary: { en: "Update a fiscal period", de: "Geschäftsperiode ändern" },
  input: z.object({
    id: z.uuid(),
    patch: z
      .object({
        companyId: z.uuid().optional(),
        fiscalYear: z.number().int().optional(),
        periodNo: z.number().int().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        isClosed: z.boolean().optional(),
      })
      .refine((patch) => Object.keys(patch).length > 0, { message: "patch must not be empty" }),
  }),
  output: looseRowSchema,
  writesTables: ["fiscalPeriod"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_admin",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const [updated] = await new DataService().patch("fiscalPeriod", input.id, input.patch);
    if (!updated) throw new CapabilityError("not_found", "Fiscal period not found");
    return updated;
  },
});

export const masterdataRemainingCapabilities = [
  costCenter.list,
  costCenter.get,
  costCenter.create,
  costCenter.update,
  ...(costCenter.archive ? [costCenter.archive] : []),
  incoterm.list,
  incoterm.get,
  incoterm.create,
  incoterm.update,
  ...(incoterm.archive ? [incoterm.archive] : []),
  industry.list,
  industry.get,
  industry.create,
  industry.update,
  ...(industry.archive ? [industry.archive] : []),
  warehouse.list,
  warehouse.get,
  warehouse.create,
  warehouse.update,
  ...(warehouse.archive ? [warehouse.archive] : []),
  numberSequence.list,
  numberSequence.get,
  numberSequence.create,
  numberSequence.update,
  ...(numberSequence.archive ? [numberSequence.archive] : []),
  shippingMethod.list,
  shippingMethod.get,
  shippingMethod.create,
  shippingMethod.update,
  ...(shippingMethod.archive ? [shippingMethod.archive] : []),
  taxClass.list,
  taxClass.get,
  taxClass.create,
  taxClass.update,
  ...(taxClass.archive ? [taxClass.archive] : []),
  taxCode.list,
  taxCode.get,
  taxCode.create,
  taxCode.update,
  ...(taxCode.archive ? [taxCode.archive] : []),
  taxRule.list,
  taxRule.get,
  taxRule.create,
  taxRule.update,
  bankAccount.list,
  bankAccount.get,
  bankAccount.create,
  bankAccount.update,
  ...(bankAccount.archive ? [bankAccount.archive] : []),
  addressCategory.list,
  addressCategory.get,
  addressCategory.create,
  addressCategory.update,
  ...(addressCategory.archive ? [addressCategory.archive] : []),
  addressContact.list,
  addressContact.get,
  addressContact.create,
  addressContact.update,
  ...(addressContact.archive ? [addressContact.archive] : []),
  postalCode.list,
  postalCode.get,
  postalCode.create,
  postalCode.update,
  ...(postalCode.archive ? [postalCode.archive] : []),
  priceListItem.list,
  priceListItem.get,
  priceListItem.create,
  priceListItem.update,
  productionOrder.list,
  productionOrder.get,
  productionOrder.create,
  productionOrder.update,
  ...(productionOrder.archive ? [productionOrder.archive] : []),
  fiscalPeriodList,
  fiscalPeriodGet,
  fiscalPeriodCreate,
  fiscalPeriodUpdate,
];
