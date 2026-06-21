import type { EntityDefinition, FieldDefinition } from "./types";

function assertNoDuplicateFields(fields: readonly FieldDefinition[], entityName: string) {
  const seen = new Set<string>();
  for (const field of fields) {
    if (seen.has(field.name)) {
      throw new Error(`Duplicate field "${field.name}" in entity "${entityName}"`);
    }
    seen.add(field.name);
  }
}

export function defineField<const Name extends string>(
  field: FieldDefinition<Name>,
): FieldDefinition<Name> {
  return field;
}

export function defineEntity<const Name extends string>(
  entity: EntityDefinition<Name>,
): EntityDefinition<Name> {
  assertNoDuplicateFields(entity.fields, entity.name);
  if (!entity.fields.some((field) => field.name === entity.primaryKey)) {
    throw new Error(`Entity "${entity.name}" primaryKey "${entity.primaryKey}" is not a field`);
  }
  return entity;
}
