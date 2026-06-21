import { z } from "zod";

import { coreEntityDefinitions } from "./entities";
import type {
  EntityConstraintDefinition,
  EntityDefinition,
  EntitySummary,
  FieldDefinition,
  PayloadValidationResult,
  ProjectionKind,
  RegistryModule,
} from "./types";

const projectionKinds: ProjectionKind[] = ["list", "form", "lookup", "api", "ai"];

const entityMap: ReadonlyMap<string, EntityDefinition> = new Map(
  coreEntityDefinitions.map((entity) => [entity.name, entity]),
);

function isRegistryModule(value: unknown): value is RegistryModule {
  return (
    value === "masterdata" ||
    value === "sales" ||
    value === "logistics" ||
    value === "accounting" ||
    value === "communication" ||
    value === "commerce" ||
    value === "import" ||
    value === "system"
  );
}

export function listEntityDefinitions(): readonly EntityDefinition[] {
  return coreEntityDefinitions;
}

export function getEntityDefinition(entityName: string): EntityDefinition | undefined {
  return entityMap.get(entityName);
}

export function discoverEntities(filter?: {
  module?: string;
  entityName?: string;
}): EntitySummary[] {
  let entities = [...coreEntityDefinitions];
  if (filter?.module && isRegistryModule(filter.module)) {
    entities = entities.filter((entity) => entity.module === filter.module);
  }
  if (filter?.entityName) {
    entities = entities.filter((entity) => entity.name === filter.entityName);
  }
  return entities.map((entity) => ({
    name: entity.name,
    pluralName: entity.pluralName,
    label: entity.label,
    module: entity.module,
    primaryKey: entity.primaryKey,
    tenantScoped: entity.tenantScoped,
    schemaVersion: entity.schemaVersion,
    projections: projectionKinds,
  }));
}

export function resolveProjection(entityName: string, type: ProjectionKind) {
  const entity = getEntityDefinition(entityName);
  if (!entity) return null;

  return {
    entityName: entity.name,
    type,
    fields: entity.fields
      .filter((field) => {
        const projection = field.projections[type];
        if (type === "list") return "visible" in projection && projection.visible;
        if (type === "api") return "exposed" in projection && projection.exposed;
        if (type === "ai") return "extractable" in projection && projection.extractable;
        return true;
      })
      .map((field) => ({
        name: field.name,
        label: field.label,
        type: field.type,
        format: field.format ?? null,
        required: field.required,
        primary: field.primary === true,
        technical: field.technical === true,
        projection: field.projections[type],
      })),
    relations: entity.relations ?? {},
    behaviors: entity.behaviors ?? {},
  };
}

function fieldSchema(field: FieldDefinition): z.ZodType {
  let schema: z.ZodType;

  switch (field.type) {
    case "string":
      schema = field.format === "uuid" ? z.uuid() : z.string();
      if (field.format === "email") schema = z.email();
      if (field.format === "url") schema = z.url();
      break;
    case "number":
      schema = z.union([z.number(), z.string().trim().min(1)]);
      break;
    case "date":
      schema = z.union([z.string().trim().min(1), z.date()]);
      break;
    case "boolean":
      schema = z.boolean();
      break;
    case "json":
      schema = z.unknown();
      break;
  }

  const validation = field.projections.form.validation;
  if (field.type === "string" && validation && schema instanceof z.ZodString) {
    let stringSchema = schema;
    if (validation.min !== undefined) stringSchema = stringSchema.min(validation.min);
    if (validation.max !== undefined) stringSchema = stringSchema.max(validation.max);
    if (validation.pattern) stringSchema = stringSchema.regex(new RegExp(validation.pattern));
    schema = stringSchema;
  }

  return field.required ? schema : schema.nullish().optional();
}

export function payloadSchemaForEntity(entityName: string) {
  const entity = getEntityDefinition(entityName);
  if (!entity) return null;

  const shape: Record<string, z.ZodType> = {};
  for (const field of entity.fields) {
    if (!field.projections.api.exposed) continue;
    if (field.projections.form.readOnly) continue;
    shape[field.name] = fieldSchema(field);
  }
  return z.looseObject(shape);
}

export function validatePayload(entityName: string, payload: unknown): PayloadValidationResult {
  const schema = payloadSchemaForEntity(entityName);
  if (!schema) {
    return { ok: false, issues: [{ path: "entityName", message: "Unknown entity" }] };
  }

  const parsed = schema.safeParse(payload);
  if (parsed.success) return { ok: true, data: parsed.data };

  return {
    ok: false,
    issues: parsed.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  };
}

function fixtureValue(field: FieldDefinition, entityName: string): unknown {
  if (field.defaultValue !== undefined) return field.defaultValue;
  if (field.format === "uuid") return "00000000-0000-7000-8000-000000000000";
  if (field.format === "email") return "sample@example.test";
  if (field.format === "url") return "https://example.test";
  if (field.format === "code") return `${entityName.toUpperCase()}-001`;

  switch (field.type) {
    case "string":
      return `Sample ${field.name}`;
    case "number":
      return field.format === "integer" ? 1 : "1.00";
    case "date":
      return "2026-01-01";
    case "boolean":
      return false;
    case "json":
      return {};
  }
}

export function generateFixture(entityName: string): Record<string, unknown> | null {
  const entity = getEntityDefinition(entityName);
  if (!entity) return null;

  const fixture: Record<string, unknown> = { ...(entity.tests?.fixture ?? {}) };
  for (const field of entity.fields) {
    if (!field.projections.api.exposed) continue;
    if (field.projections.form.readOnly) continue;
    if (!field.required && field.defaultValue === undefined) continue;
    fixture[field.name] = fixtureValue(field, entity.name);
  }
  return fixture;
}

export function explainConstraint(
  errorId: string,
): { entityName: string; constraint: EntityConstraintDefinition } | null {
  for (const entity of coreEntityDefinitions) {
    const constraint = entity.constraints?.find((candidate) => candidate.id === errorId);
    if (constraint) return { entityName: entity.name, constraint };
  }
  return null;
}
