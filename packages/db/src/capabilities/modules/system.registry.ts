import {
  discoverEntities,
  explainConstraint,
  generateFixture,
  resolveProjection,
  validatePayload,
} from "@repo/registry";
import { z } from "zod";

import { defineCapability } from "../core/define";

const projectionKindSchema = z.enum(["list", "form", "lookup", "api", "ai"]);
const registryRecordSchema = z.looseObject({});
const validationIssueSchema = z.object({ path: z.string(), message: z.string() });

export const registryCapabilities = [
  defineCapability({
    module: "system",
    entityName: "registry",
    operation: "discoverEntities",
    kind: "read",
    summary: { en: "Discover entities", de: "Entitaeten entdecken" },
    description: {
      en: "Lists TypeScript registry entities and their stable metadata summary.",
      de: "Listet Entitaeten aus der TypeScript-Registry mit stabiler Metadaten-Zusammenfassung.",
    },
    input: z.object({
      module: z.string().optional(),
      entityName: z.string().optional(),
    }),
    output: z.object({ entities: z.array(registryRecordSchema) }),
    writesTables: [],
    sideEffects: [],
    idempotent: true,
    supportsDryRun: false,
    minRole: "tenant_user",
    exposure: {
      llm: "safe",
      http: true,
      ai: {
        group: "system",
        activeByDefault: true,
        useWhen: ["A caller needs to inspect available ERP entities or metadata."],
        resultShape: "{ entities: EntitySummary[] }",
      },
    },
    schemaVersion: 1,
    handler: async (_ctx, input) => ({ entities: discoverEntities(input) }),
  }),
  defineCapability({
    module: "system",
    entityName: "registry",
    operation: "resolveProjection",
    kind: "read",
    summary: { en: "Resolve projection", de: "Projektion aufloesen" },
    description: {
      en: "Returns list/form/lookup/api/ai projection metadata for one registry entity.",
      de: "Liefert List/Form/Lookup/API/AI-Projektionsmetadaten fuer eine Registry-Entitaet.",
    },
    input: z.object({
      entityName: z.string().trim().min(1),
      type: projectionKindSchema,
    }),
    output: z.object({ projection: registryRecordSchema.nullable() }),
    writesTables: [],
    sideEffects: [],
    idempotent: true,
    supportsDryRun: false,
    minRole: "tenant_user",
    exposure: {
      llm: "safe",
      http: true,
      ai: {
        group: "system",
        activeByDefault: true,
        useWhen: [
          "A caller needs fields for a form, table, lookup, API payload, or AI extraction.",
        ],
        resultShape: "{ projection: EntityProjection | null }",
      },
    },
    schemaVersion: 1,
    handler: async (_ctx, input) => ({
      projection: resolveProjection(input.entityName, input.type),
    }),
  }),
  defineCapability({
    module: "system",
    entityName: "registry",
    operation: "validatePayload",
    kind: "read",
    summary: { en: "Validate payload", de: "Payload pruefen" },
    description: {
      en: "Validates a payload against the registry-derived API schema for an entity.",
      de: "Prueft einen Payload gegen das aus der Registry abgeleitete API-Schema.",
    },
    input: z.object({
      entityName: z.string().trim().min(1),
      payload: z.record(z.string(), z.unknown()),
    }),
    output: z.object({
      valid: z.boolean(),
      data: z.record(z.string(), z.unknown()).optional(),
      issues: z.array(validationIssueSchema).optional(),
    }),
    writesTables: [],
    sideEffects: [],
    idempotent: true,
    supportsDryRun: false,
    minRole: "tenant_user",
    exposure: {
      llm: "safe",
      http: true,
      ai: {
        group: "system",
        activeByDefault: true,
        useWhen: ["A caller needs to check generated or imported entity data before saving."],
        resultShape: "{ valid: boolean, data?: object, issues?: ValidationIssue[] }",
      },
    },
    schemaVersion: 1,
    handler: async (_ctx, input) => {
      const result = validatePayload(input.entityName, input.payload);
      return result.ok
        ? { valid: true, data: result.data }
        : { valid: false, issues: result.issues };
    },
  }),
  defineCapability({
    module: "system",
    entityName: "registry",
    operation: "generateFixture",
    kind: "read",
    summary: { en: "Generate fixture", de: "Fixture erzeugen" },
    description: {
      en: "Creates a deterministic synthetic payload from the registry definition.",
      de: "Erzeugt einen deterministischen synthetischen Payload aus der Registry-Definition.",
    },
    input: z.object({ entityName: z.string().trim().min(1) }),
    output: z.object({ fixture: z.record(z.string(), z.unknown()).nullable() }),
    writesTables: [],
    sideEffects: [],
    idempotent: true,
    supportsDryRun: false,
    minRole: "tenant_user",
    exposure: {
      llm: "safe",
      http: true,
      ai: {
        group: "system",
        activeByDefault: false,
        useWhen: ["A caller needs synthetic entity test data."],
        resultShape: "{ fixture: object | null }",
      },
    },
    schemaVersion: 1,
    handler: async (_ctx, input) => ({ fixture: generateFixture(input.entityName) }),
  }),
  defineCapability({
    module: "system",
    entityName: "registry",
    operation: "explainConstraint",
    kind: "read",
    summary: { en: "Explain constraint", de: "Constraint erklaeren" },
    description: {
      en: "Explains a registry-known business constraint by id.",
      de: "Erklaert eine in der Registry bekannte fachliche Constraint anhand ihrer ID.",
    },
    input: z.object({ errorId: z.string().trim().min(1) }),
    output: z.object({
      found: z.boolean(),
      entityName: z.string().nullable(),
      constraint: registryRecordSchema.nullable(),
    }),
    writesTables: [],
    sideEffects: [],
    idempotent: true,
    supportsDryRun: false,
    minRole: "tenant_user",
    exposure: {
      llm: "safe",
      http: true,
      ai: {
        group: "system",
        activeByDefault: true,
        useWhen: ["A caller needs to explain a known validation or constraint error."],
        resultShape: "{ found: boolean, entityName: string | null, constraint: object | null }",
      },
    },
    schemaVersion: 1,
    handler: async (_ctx, input) => {
      const explanation = explainConstraint(input.errorId);
      return explanation
        ? { found: true, entityName: explanation.entityName, constraint: explanation.constraint }
        : { found: false, entityName: null, constraint: null };
    },
  }),
];
