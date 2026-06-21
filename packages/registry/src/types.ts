export type RegistryModule =
  | "masterdata"
  | "sales"
  | "logistics"
  | "accounting"
  | "communication"
  | "commerce"
  | "import"
  | "system";

export interface LocalizedText {
  en: string;
  de: string;
}

export type FieldType = "string" | "number" | "date" | "boolean" | "json";

export type FieldFormat =
  | "uuid"
  | "code"
  | "text"
  | "email"
  | "url"
  | "decimal"
  | "integer"
  | "currency"
  | "date"
  | "timestamp";

export interface FieldValidation {
  min?: number;
  max?: number;
  pattern?: string;
  values?: readonly string[];
}

export interface FieldProjectionDefinition {
  list: {
    visible: boolean;
    sortable: boolean;
    width?: number;
  };
  form: {
    component: string;
    readOnly?: boolean;
    validation?: FieldValidation;
  };
  lookup: {
    searchKey: boolean;
    display?: boolean;
  };
  api: {
    exposed: boolean;
  };
  ai: {
    description: string;
    extractable: boolean;
  };
}

export interface FieldDefinition<Name extends string = string> {
  name: Name;
  label: LocalizedText;
  type: FieldType;
  format?: FieldFormat;
  required: boolean;
  primary?: boolean;
  technical?: boolean;
  defaultValue?: unknown;
  projections: FieldProjectionDefinition;
}

export type RelationType = "one" | "many";

export interface RelationDefinition {
  type: RelationType;
  target: string;
  field?: string;
  inverseField?: string;
  required?: boolean;
}

export type SoftDeleteStrategy = "none" | "archived" | "archivedAt";

export interface EntityBehaviorDefinition {
  softDelete?: {
    strategy: SoftDeleteStrategy;
    field?: string;
  };
  posting?: {
    source: boolean;
    ledgerTarget?: string;
    immutableLedger?: boolean;
  };
  stateMachine?: {
    field: string;
    states: readonly string[];
  };
}

export interface EntityConstraintDefinition {
  id: string;
  message: LocalizedText;
  severity: "info" | "warning" | "error";
  fields?: readonly string[];
}

export interface EntityTestDefinition {
  crud?: boolean;
  validationSmoke?: boolean;
  fixture?: Record<string, unknown>;
}

export interface EntityDefinition<Name extends string = string> {
  name: Name;
  pluralName: string;
  label: LocalizedText;
  module: RegistryModule;
  primaryKey: string;
  tenantScoped: boolean;
  schemaVersion: number;
  fields: readonly FieldDefinition[];
  relations?: Record<string, RelationDefinition>;
  behaviors?: EntityBehaviorDefinition;
  constraints?: readonly EntityConstraintDefinition[];
  tests?: EntityTestDefinition;
}

export type ProjectionKind = keyof FieldProjectionDefinition;

export interface EntitySummary {
  name: string;
  pluralName: string;
  label: LocalizedText;
  module: RegistryModule;
  primaryKey: string;
  tenantScoped: boolean;
  schemaVersion: number;
  projections: ProjectionKind[];
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export type PayloadValidationResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; issues: ValidationIssue[] };
