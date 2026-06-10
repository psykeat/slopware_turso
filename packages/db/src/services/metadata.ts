import { and, desc, eq, getColumns } from "drizzle-orm";

import { db } from "../index";
import {
  helperTableRegistry,
  metadataHistory,
  schemaAnnotations,
  systemSettings,
  tenantFields,
  tenantGroups,
  tenantLayouts,
} from "../schema/app.schema";
import * as schema from "../schema/index";

export interface MetadataContext {
  tenantId: string;
  organizationId?: string;
  userId?: string;
}

export type DesignerSurfaceKind =
  | "triview-tree"
  | "triview-grid"
  | "triview-detail"
  | "inspector-panel"
  | "dependent-grid"
  | "document-header"
  | "document-lines";

export type DesignerNodeKind =
  | "field-ref"
  | "jsonb-field"
  | "group-frame"
  | "tab-container"
  | "tab-pane"
  | "column-container"
  | "column"
  | "grid-column"
  | "surface";

export type DesignerConflictState =
  | "clean"
  | "deprecated"
  | "tombstoned"
  | "conflicted"
  | "needs_review";

export type DesignerOverrideMode = "base" | "global" | "org" | "tenant" | "derived" | "draft";

export interface DesignerVersionInfo {
  baseVersion: string | null;
  derivedFromVersion: string | null;
  overrideMode: DesignerOverrideMode;
  conflictState: DesignerConflictState;
  reconciliationRequired: boolean;
  supersededFieldRef: string | null;
  clientRevision: string | null;
}

export interface DesignerNode {
  id: string;
  kind: DesignerNodeKind;
  surface: DesignerSurfaceKind;
  entityName: string;
  parentId: string | null;
  children: string[];
  placement: {
    parentId: string | null;
    index: number;
  };
  displayOrder: number;
  label: string;
  visible: boolean;
  readonly: boolean;
  required: boolean;
  styleTokenBinding: string | null;
  ruleBinding: string | null;
  conflictState: DesignerConflictState;
  versionInfo: DesignerVersionInfo;
  reconciliationRequired?: boolean;
  fieldName?: string | null;
  groupKey?: string | null;
  layoutKey?: string | null;
  lookupTable?: string | null;
  path?: string | null;
  metadataRef?: {
    metadataType: "field" | "group" | "layout";
    metadataKey: string;
  };
  customAttributes?: Record<string, unknown> | null;
}

export interface DesignerPatchOperationSet {
  op: "set";
  nodeKey: string;
  path: string;
  value: unknown;
}

export interface DesignerPatchOperationMove {
  op: "move";
  nodeKey: string;
  parentKey?: string | null;
  index: number;
}

export interface DesignerPatchOperationInsert {
  op: "insert";
  nodeKey: string;
  kind: DesignerNodeKind;
  parentKey?: string | null;
  index?: number | null;
  data?: Record<string, unknown> | null;
}

export interface DesignerPatchOperationDelete {
  op: "delete";
  nodeKey: string;
  reason?: string | null;
}

export interface DesignerPatchOperationReconcile {
  op: "reconcile";
  nodeKey: string;
  targetKey?: string | null;
  note?: string | null;
}

export type DesignerPatchOperation =
  | DesignerPatchOperationSet
  | DesignerPatchOperationMove
  | DesignerPatchOperationInsert
  | DesignerPatchOperationDelete
  | DesignerPatchOperationReconcile;

export interface DesignerPatch {
  baseVersion: string | null;
  derivedFromVersion: string | null;
  surface: DesignerSurfaceKind;
  ops: DesignerPatchOperation[];
  clientRevision?: string | null;
}

export interface DesignerRemapSuggestion {
  from: string;
  to: string;
  reason: string;
}

export interface DesignerSurfaceContract {
  entityName: string;
  surface: DesignerSurfaceKind;
  nodes: DesignerNode[];
  rootIds: string[];
  versionInfo: DesignerVersionInfo;
  conflictState: DesignerConflictState;
  reconciliationRequired: boolean;
  requiredFollowUpActions: string[];
  autoAppliedRemaps: DesignerRemapSuggestion[];
  effectiveFields: Array<Record<string, any>>;
  effectiveGroups: Array<Record<string, any>>;
  effectiveLayout: Record<string, any>;
}

const designerNodeKinds = new Set<DesignerNodeKind>([
  "field-ref",
  "jsonb-field",
  "group-frame",
  "tab-container",
  "tab-pane",
  "column-container",
  "column",
  "grid-column",
  "surface",
]);

const technicalFieldNames = new Set([
  "tenantId",
  "createdAt",
  "updatedAt",
  "archived",
  "archivedAt",
  "isActive",
]);

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toLocalizedRecord(value: unknown) {
  if (isRecord(value)) return value;
  if (typeof value !== "string") return undefined;

  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return { en: value, de: value };
  }
}

function toTimestampString(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
}

function isDesignerNodeKind(value: unknown): value is DesignerNodeKind {
  return typeof value === "string" && designerNodeKinds.has(value as DesignerNodeKind);
}

function resolveLookupTable(entityName: string, colName: string) {
  if (colName === "variantId") {
    return "articleVariant";
  }

  if (colName === "optionId") {
    return "articleOption";
  }

  if (colName === "valueId") {
    return "articleOptionValue";
  }

  if (entityName === "inventoryLevel" && colName === "itemId") {
    return "inventoryItem";
  }

  if (entityName === "inventoryLevel" && colName === "locationId") {
    return "warehouse";
  }

  if (entityName === "documentGroup" && colName === "nextGroupId") {
    return "documentGroup";
  }

  if (colName === "baseUnitId" || colName === "salesUnitId" || colName === "purchaseUnitId") {
    return "unit";
  }

  if (colName.endsWith("Id") && colName !== "tenantId") {
    const potentialEntity = colName.slice(0, -2);
    if ((schema as any)[potentialEntity] && potentialEntity !== entityName) {
      return potentialEntity;
    }
  }

  return undefined;
}

function getFieldType(columnType: string | undefined) {
  return columnType === "PgNumeric"
    ? "numeric"
    : columnType === "PgInteger"
      ? "integer"
      : columnType === "PgBoolean"
        ? "boolean"
        : columnType === "PgTimestamp" || columnType === "PgDate"
          ? "timestamp"
          : "text";
}

export function resolveLookupMetadata(f: Record<string, any>, registries: any[]) {
  const registry = registries.find((r) => r.tableName === f.lookupTable);
  const lookupSchemaTable = f.lookupTable ? (schema as any)[f.lookupTable] : undefined;
  const lookupColumns = lookupSchemaTable ? getColumns(lookupSchemaTable) : undefined;
  const tableColumns = lookupColumns ? Object.keys(lookupColumns) : [];
  const variantLookupTable = f.lookupTable === "articleVariant" || f.lookupTable === "inventoryItem";
  const variantLookupDisplayColumn =
    f.lookupTable === "articleVariant"
      ? "lookupLabel"
      : f.lookupTable === "inventoryItem"
        ? "sku"
        : undefined;

  const inferredPkColumn =
    registry?.pkColumn ??
    tableColumns.find((columnName) => {
      const col = (lookupColumns as any)[columnName];
      return (col as any)?.primary || false;
    }) ??
    tableColumns.find((columnName) => columnName.toLowerCase().endsWith("id")) ??
    tableColumns[0];

  const inferredCodeColumn =
    registry?.codeColumn ??
    (tableColumns.includes("code")
      ? "code"
      : tableColumns.includes("iso2Code")
        ? "iso2Code"
        : tableColumns.includes("iso3Code")
          ? "iso3Code"
          : variantLookupTable
            ? "sku"
            : undefined);

  const inferredDisplayColumn =
    registry?.displayColumn ??
    variantLookupDisplayColumn ??
    (tableColumns.includes("name")
      ? "name"
      : tableColumns.includes("code")
        ? "code"
        : tableColumns[0]);

  return {
    inferredPkColumn,
    inferredCodeColumn,
    inferredDisplayColumn,
    inferredValueColumn: registry?.valueColumn ?? inferredPkColumn ?? inferredCodeColumn,
    lookupSortColumn:
      registry?.sortColumn ?? (variantLookupTable ? "sku" : inferredDisplayColumn),
    lookupIsI18n: registry?.displayIsI18n,
  };
}

type LayoutScope = "global" | "org" | "tenant" | "user";

function scopeMatches(context: MetadataContext, scopeRow: Record<string, any>) {
  if (scopeRow.scope === "global") return true;
  if (scopeRow.scope === "org") return scopeRow.organizationId === context.organizationId;
  if (scopeRow.scope === "tenant") return scopeRow.tenantId === context.tenantId;
  if (scopeRow.scope === "user") {
    return scopeRow.tenantId === context.tenantId && scopeRow.userId === context.userId;
  }
  return false;
}

function scopePriority(scope: unknown) {
  return scope === "global"
    ? 0
    : scope === "org"
      ? 1
      : scope === "tenant"
        ? 2
        : scope === "user"
          ? 3
          : 4;
}

export function mergeLayoutDefinitionsByScope(rows: Array<Record<string, any>>) {
  const rowsByScope = new Map<LayoutScope, Record<string, any>>();

  for (const row of rows) {
    if (
      row.scope === "global" ||
      row.scope === "org" ||
      row.scope === "tenant" ||
      row.scope === "user"
    ) {
      rowsByScope.set(row.scope, row);
    }
  }

  let effectiveLayout: Record<string, any> = {};
  for (const scope of ["global", "org", "tenant", "user"] as const) {
    const row = rowsByScope.get(scope);
    if (!row) continue;
    effectiveLayout = {
      ...effectiveLayout,
      ...(row.layoutDefinition as Record<string, any>),
    };
  }

  const effectiveScope = (["global", "org", "tenant", "user"] as const).reduce<LayoutScope>(
    (current, scope) => (rowsByScope.has(scope) ? scope : current),
    "global",
  );
  return {
    effectiveLayout,
    rowsByScope,
    effectiveScope,
  };
}

function inferOverrideMode(scope: unknown): DesignerOverrideMode {
  if (scope === "global" || scope === "org" || scope === "tenant") return scope;
  if (scope === "user") return "draft";
  return "derived";
}

function mapConflictState(value: unknown): DesignerConflictState {
  return value === "deprecated" ||
    value === "tombstoned" ||
    value === "conflicted" ||
    value === "needs_review"
    ? value
    : "clean";
}

function aggregateConflictState(states: DesignerConflictState[]): DesignerConflictState {
  if (states.includes("conflicted")) return "conflicted";
  if (states.includes("needs_review")) return "needs_review";
  if (states.includes("tombstoned")) return "tombstoned";
  if (states.includes("deprecated")) return "deprecated";
  return "clean";
}

function buildVersionInfo(params: {
  baseVersion: string | null;
  derivedFromVersion: string | null;
  overrideMode: DesignerOverrideMode;
  conflictState: DesignerConflictState;
  reconciliationRequired: boolean;
  supersededFieldRef?: string | null;
  clientRevision?: string | null;
}): DesignerVersionInfo {
  return {
    baseVersion: params.baseVersion,
    derivedFromVersion: params.derivedFromVersion,
    overrideMode: params.overrideMode,
    conflictState: params.conflictState,
    reconciliationRequired: params.reconciliationRequired,
    supersededFieldRef: params.supersededFieldRef ?? null,
    clientRevision: params.clientRevision ?? null,
  };
}

function resolveSurfaceLayoutKey(surface: DesignerSurfaceKind) {
  switch (surface) {
    case "triview-tree":
      return "tree";
    case "triview-grid":
      return "grid";
    case "triview-detail":
      return "detail";
    case "inspector-panel":
      return "inspector-panel";
    case "dependent-grid":
      return "dependent-grid";
    case "document-header":
      return "document-header";
    case "document-lines":
      return "document-lines";
    default:
      return surface;
  }
}

function inferLayoutKind(surface: DesignerSurfaceKind, raw: Record<string, any>) {
  if (isDesignerNodeKind(raw.kind)) return raw.kind;
  if (raw.type === "tab") return "tab-container";
  if (raw.type === "pane") return "tab-pane";
  if (raw.type === "column-container") return "column-container";
  if (raw.type === "column") return "column";
  if (surface === "triview-grid" || surface === "dependent-grid") return "grid-column";
  return "surface";
}

function getRawNodeId(
  surface: DesignerSurfaceKind,
  entityName: string,
  raw: Record<string, any>,
  index: number,
) {
  if (typeof raw.id === "string" && raw.id.length > 0) return raw.id;
  if (typeof raw.nodeKey === "string" && raw.nodeKey.length > 0) return raw.nodeKey;
  if (typeof raw.fieldName === "string" && raw.fieldName.length > 0) {
    return `field:${entityName}:${raw.fieldName}`;
  }
  if (typeof raw.groupKey === "string" && raw.groupKey.length > 0) {
    return `group:${entityName}:${raw.groupKey}`;
  }
  if (typeof raw.layoutKey === "string" && raw.layoutKey.length > 0) {
    return `layout:${entityName}:${raw.layoutKey}`;
  }
  return `layout:${entityName}:${surface}:${index}`;
}

function getLayoutChildren(raw: Record<string, any>) {
  if (Array.isArray(raw.children)) return raw.children;
  if (Array.isArray(raw.nodes)) return raw.nodes;
  if (Array.isArray(raw.items)) return raw.items;
  return [];
}

function mergeOverrides(baseFields: Map<string, any>, overrides: any[], context: MetadataContext) {
  const merged = new Map<string, any>(baseFields);
  const scopes: Array<"global" | "org" | "tenant"> = ["global", "org", "tenant"];

  for (const scope of scopes) {
    const scopeOverrides = overrides.filter((o) => {
      if (o.scope !== scope) return false;
      if (scope === "org") return o.organizationId === context.organizationId;
      if (scope === "tenant") return o.tenantId === context.tenantId;
      return true;
    });

    for (const o of scopeOverrides) {
      if (!merged.has(o.fieldName)) continue;
      merged.set(o.fieldName, { ...merged.get(o.fieldName), ...o });
    }
  }

  return merged;
}

function buildLatestHistoryMap(
  historyRows: Array<Record<string, any>>,
  metadataType: "field" | "group" | "layout",
) {
  const latest = new Map<string, Record<string, any>>();

  for (const row of historyRows) {
    if (row.metadataType !== metadataType) continue;
    const key = `${row.metadataType}:${row.metadataKey}`;
    if (!latest.has(key)) {
      latest.set(key, row);
    }
  }

  return latest;
}

function finalizeLocalizedField(
  f: Record<string, any>,
  registries: any[],
  latestHistory?: Record<string, any>,
) {
  const designerMeta = isRecord(f.customAttributes)
    ? (f.customAttributes as any).designer
    : undefined;
  const labelData = toLocalizedRecord(f.label);
  const helpData = toLocalizedRecord(f.helpText);
  const lookupMetadata = resolveLookupMetadata(f, registries);
  const conflictState = mapConflictState(f.conflictState ?? designerMeta?.conflictState);
  const baseVersion =
    typeof f.annotationId === "string"
      ? `annotation:${f.annotationId}`
      : `schema:${f.entityName}:${f.fieldName}`;
  const derivedFromVersion =
    toTimestampString(f.createdAt) ??
    toTimestampString(latestHistory?.createdAt) ??
    toTimestampString(designerMeta?.derivedFromVersion) ??
    baseVersion;

  return {
    ...f,
    labelEn: labelData?.en || labelData?.de || f.fieldName,
    labelDe: labelData?.de || labelData?.en || f.fieldName,
    helpTextEn: helpData?.en || "",
    helpTextDe: helpData?.de || "",
    isVisible: f.isVisible !== false && !technicalFieldNames.has(f.fieldName),
    lookupTable: f.lookupTable,
    lookupFilter: f.lookupFilter,
    lookupPkColumn: lookupMetadata.inferredPkColumn,
    lookupDisplayColumn: lookupMetadata.inferredDisplayColumn,
    lookupCodeColumn: lookupMetadata.inferredCodeColumn,
    lookupValueColumn: lookupMetadata.inferredValueColumn,
    lookupSortColumn: lookupMetadata.lookupSortColumn,
    lookupIsI18n: lookupMetadata.lookupIsI18n,
    conflictState,
    reconciliationRequired: conflictState !== "clean",
    versionInfo: buildVersionInfo({
      baseVersion,
      derivedFromVersion,
      overrideMode: inferOverrideMode(f.scope),
      conflictState,
      reconciliationRequired: conflictState !== "clean",
      supersededFieldRef: designerMeta?.supersededFieldRef ?? null,
      clientRevision: designerMeta?.clientRevision ?? null,
    }),
  };
}

function finalizeLocalizedGroup(group: Record<string, any>, latestHistory?: Record<string, any>) {
  const designerMeta = isRecord(group.customAttributes)
    ? (group.customAttributes as any).designer
    : undefined;
  const labelData = toLocalizedRecord(group.label);
  const conflictState = mapConflictState(group.conflictState ?? designerMeta?.conflictState);
  const derivedFromVersion =
    toTimestampString(group.createdAt) ??
    toTimestampString(latestHistory?.createdAt) ??
    toTimestampString(designerMeta?.derivedFromVersion) ??
    `group:${group.entityName}:${group.groupKey}`;

  return {
    ...group,
    labelEn: labelData?.en || labelData?.de || group.groupKey,
    labelDe: labelData?.de || labelData?.en || group.groupKey,
    conflictState,
    reconciliationRequired: conflictState !== "clean",
    versionInfo: buildVersionInfo({
      baseVersion: `group:${group.entityName}:${group.groupKey}`,
      derivedFromVersion,
      overrideMode: inferOverrideMode(group.scope),
      conflictState,
      reconciliationRequired: conflictState !== "clean",
      supersededFieldRef: designerMeta?.supersededFieldRef ?? null,
      clientRevision: designerMeta?.clientRevision ?? null,
    }),
  };
}

function normalizeLayoutTree(
  value: unknown,
  params: {
    entityName: string;
    surface: DesignerSurfaceKind;
    parentId: string | null;
    nextOrder: number;
    latestHistory?: Record<string, any>;
  },
  nodes = new Map<string, DesignerNode>(),
): { nodes: Map<string, DesignerNode>; rootIds: string[] } {
  if (Array.isArray(value)) {
    const rootIds: string[] = [];
    let index = params.nextOrder;

    for (const item of value) {
      const result = normalizeLayoutTree(
        item,
        {
          ...params,
          parentId: params.parentId,
          nextOrder: index,
        },
        nodes,
      );
      rootIds.push(...result.rootIds);
      index += result.rootIds.length || 1;
    }

    return { nodes, rootIds };
  }

  if (!isRecord(value)) {
    return { nodes, rootIds: [] };
  }

  const raw = value as Record<string, any>;
  const id = getRawNodeId(params.surface, params.entityName, raw, params.nextOrder);
  const kind = inferLayoutKind(params.surface, raw);
  const childValues = getLayoutChildren(raw);
  const baseVersion =
    typeof raw.baseVersion === "string"
      ? raw.baseVersion
      : `layout:${params.entityName}:${params.surface}`;
  const latestDerived =
    toTimestampString(raw.derivedFromVersion) ??
    toTimestampString(params.latestHistory?.createdAt) ??
    baseVersion;
  const conflictState = mapConflictState(raw.conflictState ?? raw.designerConflictState);
  const versionInfo = buildVersionInfo({
    baseVersion,
    derivedFromVersion: latestDerived,
    overrideMode: inferOverrideMode(raw.scope),
    conflictState,
    reconciliationRequired: conflictState !== "clean",
    supersededFieldRef: typeof raw.supersededFieldRef === "string" ? raw.supersededFieldRef : null,
    clientRevision: typeof raw.clientRevision === "string" ? raw.clientRevision : null,
  });
  const placementIndex = typeof raw.displayOrder === "number" ? raw.displayOrder : params.nextOrder;
  const node: DesignerNode = {
    id,
    kind,
    surface: params.surface,
    entityName: params.entityName,
    parentId: params.parentId,
    children: [],
    placement: {
      parentId: params.parentId,
      index: placementIndex,
    },
    displayOrder: placementIndex,
    label:
      (typeof raw.label === "string" && raw.label) ||
      (typeof raw.title === "string" && raw.title) ||
      (typeof raw.name === "string" && raw.name) ||
      id,
    visible: raw.visible !== false,
    readonly: raw.readonly === true,
    required: raw.required === true,
    styleTokenBinding: typeof raw.styleTokenBinding === "string" ? raw.styleTokenBinding : null,
    ruleBinding: typeof raw.ruleBinding === "string" ? raw.ruleBinding : null,
    conflictState,
    versionInfo,
    fieldName: typeof raw.fieldName === "string" ? raw.fieldName : null,
    groupKey: typeof raw.groupKey === "string" ? raw.groupKey : null,
    layoutKey: typeof raw.layoutKey === "string" ? raw.layoutKey : null,
    lookupTable: typeof raw.lookupTable === "string" ? raw.lookupTable : null,
    path: typeof raw.path === "string" ? raw.path : null,
    metadataRef:
      typeof raw.fieldName === "string"
        ? { metadataType: "field", metadataKey: raw.fieldName }
        : typeof raw.groupKey === "string"
          ? { metadataType: "group", metadataKey: raw.groupKey }
          : typeof raw.layoutKey === "string"
            ? { metadataType: "layout", metadataKey: raw.layoutKey }
            : undefined,
    customAttributes: isRecord(raw.customAttributes) ? raw.customAttributes : null,
  };

  nodes.set(id, node);

  const childRootIds: string[] = [];
  let childIndex = 0;
  for (const childValue of childValues) {
    const result = normalizeLayoutTree(
      childValue,
      {
        ...params,
        parentId: id,
        nextOrder: childIndex,
      },
      nodes,
    );
    childRootIds.push(...result.rootIds);
    childIndex += result.rootIds.length || 1;
  }

  node.children = childRootIds;
  return {
    nodes,
    rootIds: [id],
  };
}

function extractLayoutDefinition(layout: Record<string, any> | undefined | null) {
  if (!layout) return {};
  if (isRecord(layout.layoutDefinition)) {
    return layout.layoutDefinition;
  }

  if (isRecord(layout)) {
    const stripped = { ...layout };
    delete stripped.versionInfo;
    delete stripped.conflictState;
    delete stripped.reconciliationRequired;
    delete stripped.effectiveFields;
    delete stripped.effectiveGroups;
    delete stripped.autoAppliedRemaps;
    delete stripped.requiredFollowUpActions;
    return stripped;
  }

  return {};
}

export class MetadataResolver {
  private context: MetadataContext;

  constructor(context: MetadataContext) {
    this.context = context;
  }

  private async getLatestHistory(entityName: string, metadataType: "field" | "group" | "layout") {
    try {
      const rows = await db
        .select()
        .from(metadataHistory)
        .where(
          and(
            eq(metadataHistory.entityName, entityName),
            eq(metadataHistory.metadataType, metadataType),
          ),
        )
        .orderBy(desc(metadataHistory.createdAt));

      return buildLatestHistoryMap(rows as Array<Record<string, any>>, metadataType);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const cause = error && typeof error === "object" ? (error as any).cause : null;
      const causeCode = cause && typeof cause === "object" ? (cause as any).code : null;
      const isMissingHistoryTable =
        message.includes('relation "metadata_history" does not exist') || causeCode === "42P01";

      if (isMissingHistoryTable) {
        return new Map();
      }

      throw error;
    }
  }

  private async getDesignerGroups(entityName: string) {
    const rows = await db
      .select()
      .from(tenantGroups)
      .where(eq(tenantGroups.entityName, entityName));

    const filtered = (rows as Array<Record<string, any>>).filter((row) =>
      scopeMatches(this.context, row),
    );
    const ordered = filtered.sort(
      (left, right) => scopePriority(left.scope) - scopePriority(right.scope),
    );
    const latestHistory = await this.getLatestHistory(entityName, "group");
    const merged = new Map<string, Record<string, any>>();

    for (const row of ordered) {
      const existing = merged.get(row.groupKey);
      if (!existing) {
        merged.set(row.groupKey, row);
      } else {
        merged.set(row.groupKey, { ...existing, ...row });
      }
    }

    return Array.from(merged.values()).map((group) =>
      finalizeLocalizedGroup(group, latestHistory.get(`group:${group.groupKey}`)),
    );
  }

  private async resolveDesignerLayoutState(entityName: string, layoutKey: string) {
    const rawLayouts = await db
      .select()
      .from(tenantLayouts)
      .where(and(eq(tenantLayouts.entityName, entityName), eq(tenantLayouts.layoutKey, layoutKey)));

    const filtered = (rawLayouts as Array<Record<string, any>>).filter((row) =>
      scopeMatches(this.context, row),
    );
    const ordered = filtered.sort(
      (left, right) => scopePriority(left.scope) - scopePriority(right.scope),
    );

    const layoutMergeState = mergeLayoutDefinitionsByScope(ordered);

    const latestHistory = await this.getLatestHistory(entityName, "layout");
    const historyEntry = latestHistory.get(`layout:${layoutKey}`);
    const conflictState = mapConflictState(
      ordered.some((layout) => layout.conflictState)
        ? ordered.find((layout) => layout.conflictState)?.conflictState
        : historyEntry?.changeType === "delete"
          ? "tombstoned"
          : "clean",
    );
    const lastLayoutRow = ordered.length > 0 ? ordered[ordered.length - 1] : undefined;
    const derivedFromVersion =
      toTimestampString(historyEntry?.createdAt) ??
      toTimestampString(lastLayoutRow?.createdAt) ??
      `layout:${entityName}:${layoutKey}`;

    return {
      effectiveLayout: layoutMergeState.effectiveLayout,
      layoutRowsByScope: layoutMergeState.rowsByScope,
      effectiveScope: layoutMergeState.effectiveScope,
      conflictState,
      reconciliationRequired: conflictState !== "clean",
      versionInfo: buildVersionInfo({
        baseVersion: `layout:${entityName}:${layoutKey}`,
        derivedFromVersion,
        overrideMode: lastLayoutRow?.scope ? inferOverrideMode(lastLayoutRow.scope) : "base",
        conflictState,
        reconciliationRequired: conflictState !== "clean",
        supersededFieldRef: null,
        clientRevision: null,
      }),
      historyEntry,
      rows: ordered,
    };
  }

  private buildDesignerNodes(params: {
    entityName: string;
    surface: DesignerSurfaceKind;
    fields: Array<Record<string, any>>;
    groups: Array<Record<string, any>>;
    layout: Record<string, any>;
    layoutVersionInfo: DesignerVersionInfo;
  }) {
    const nodes = new Map<string, DesignerNode>();
    const rootId = `surface:${params.entityName}:${params.surface}`;
    const rootChildren = new Set<string>();
    const rootConflictStates: DesignerConflictState[] = [params.layoutVersionInfo.conflictState];
    const rootVersionCandidates = [params.layoutVersionInfo.derivedFromVersion];
    const surfaceRoot: DesignerNode = {
      id: rootId,
      kind: "surface",
      surface: params.surface,
      entityName: params.entityName,
      parentId: null,
      children: [],
      placement: {
        parentId: null,
        index: 0,
      },
      displayOrder: 0,
      label: `${params.entityName}:${params.surface}`,
      visible: true,
      readonly: false,
      required: false,
      styleTokenBinding: null,
      ruleBinding: null,
      conflictState: params.layoutVersionInfo.conflictState,
      versionInfo: params.layoutVersionInfo,
    };

    nodes.set(rootId, surfaceRoot);

    const layoutNodes = normalizeLayoutTree(
      params.layout,
      {
        entityName: params.entityName,
        surface: params.surface,
        parentId: rootId,
        nextOrder: 0,
        latestHistory: undefined,
      },
      nodes,
    );

    for (const layoutNodeId of layoutNodes.rootIds) {
      rootChildren.add(layoutNodeId);
    }

    const groupsByKey = new Map<string, DesignerNode>();

    params.groups
      .slice()
      .sort((left, right) => {
        const leftOrder = typeof left.displayOrder === "number" ? left.displayOrder : 0;
        const rightOrder = typeof right.displayOrder === "number" ? right.displayOrder : 0;
        return leftOrder - rightOrder;
      })
      .forEach((group, index) => {
        const groupKey = String(group.groupKey);
        const groupId = `group:${params.entityName}:${groupKey}`;
        const designerMeta = isRecord(group.customAttributes)
          ? (group.customAttributes as any).designer
          : undefined;
        const kind = isDesignerNodeKind(designerMeta?.kind) ? designerMeta.kind : "group-frame";
        const node: DesignerNode = {
          id: groupId,
          kind,
          surface: params.surface,
          entityName: params.entityName,
          parentId: typeof designerMeta?.parentId === "string" ? designerMeta.parentId : rootId,
          children: [],
          placement: {
            parentId: typeof designerMeta?.parentId === "string" ? designerMeta.parentId : rootId,
            index: typeof group.displayOrder === "number" ? group.displayOrder : index,
          },
          displayOrder: typeof group.displayOrder === "number" ? group.displayOrder : index,
          label: group.labelEn || group.labelDe || groupKey,
          visible: group.isVisible !== false,
          readonly: false,
          required: false,
          styleTokenBinding:
            typeof designerMeta?.styleTokenBinding === "string"
              ? designerMeta.styleTokenBinding
              : null,
          ruleBinding:
            typeof designerMeta?.ruleBinding === "string" ? designerMeta.ruleBinding : null,
          conflictState: group.conflictState,
          versionInfo: group.versionInfo,
          groupKey,
          metadataRef: {
            metadataType: "group",
            metadataKey: groupKey,
          },
          customAttributes: isRecord(group.customAttributes) ? group.customAttributes : null,
        };

        groupsByKey.set(groupKey, node);
        nodes.set(groupId, node);
        rootConflictStates.push(node.conflictState);
        rootVersionCandidates.push(node.versionInfo.derivedFromVersion);
      });

    params.fields
      .slice()
      .sort((left, right) => {
        const leftOrder = typeof left.displayOrder === "number" ? left.displayOrder : 0;
        const rightOrder = typeof right.displayOrder === "number" ? right.displayOrder : 0;
        return leftOrder - rightOrder;
      })
      .forEach((field, index) => {
        const fieldName = String(field.fieldName);
        const fieldId = `field:${params.entityName}:${fieldName}`;
        const designerMeta = isRecord(field.customAttributes)
          ? (field.customAttributes as any).designer
          : undefined;
        const parentGroupKey =
          typeof field.groupId === "string"
            ? field.groupId
            : typeof designerMeta?.groupKey === "string"
              ? designerMeta.groupKey
              : null;
        const parentNode =
          (parentGroupKey && groupsByKey.get(parentGroupKey)) || nodes.get(rootId) || null;
        const kind = isDesignerNodeKind(designerMeta?.kind)
          ? designerMeta.kind
          : params.surface === "triview-grid" || params.surface === "dependent-grid"
            ? "grid-column"
            : field.lookupTable || designerMeta?.path
              ? "jsonb-field"
              : "field-ref";
        const node: DesignerNode = {
          id: fieldId,
          kind,
          surface: params.surface,
          entityName: params.entityName,
          parentId: parentNode?.id ?? rootId,
          children: [],
          placement: {
            parentId: parentNode?.id ?? rootId,
            index: typeof field.displayOrder === "number" ? field.displayOrder : index,
          },
          displayOrder: typeof field.displayOrder === "number" ? field.displayOrder : index,
          label: field.labelEn || field.labelDe || fieldName,
          visible: field.isVisible !== false,
          readonly: designerMeta?.readonly === true,
          required: field.isRequired === true,
          styleTokenBinding:
            typeof designerMeta?.styleTokenBinding === "string"
              ? designerMeta.styleTokenBinding
              : null,
          ruleBinding:
            typeof designerMeta?.ruleBinding === "string" ? designerMeta.ruleBinding : null,
          conflictState: field.conflictState,
          versionInfo: field.versionInfo,
          fieldName,
          lookupTable: typeof field.lookupTable === "string" ? field.lookupTable : null,
          path: typeof designerMeta?.path === "string" ? designerMeta.path : null,
          metadataRef: {
            metadataType: "field",
            metadataKey: fieldName,
          },
          customAttributes: isRecord(field.customAttributes) ? field.customAttributes : null,
        };

        nodes.set(fieldId, node);
        rootConflictStates.push(node.conflictState);
        rootVersionCandidates.push(node.versionInfo.derivedFromVersion);

        if (parentNode) {
          parentNode.children.push(node.id);
        }

        if (!parentNode || parentNode.id === rootId) {
          rootChildren.add(node.id);
        }
      });

    surfaceRoot.children = Array.from(rootChildren);
    surfaceRoot.conflictState = aggregateConflictState(rootConflictStates);
    surfaceRoot.reconciliationRequired = surfaceRoot.conflictState !== "clean";
    surfaceRoot.versionInfo = buildVersionInfo({
      baseVersion: `surface:${params.entityName}:${params.surface}`,
      derivedFromVersion:
        rootVersionCandidates.find((version) => Boolean(version)) ??
        `surface:${params.entityName}:${params.surface}`,
      overrideMode: "derived",
      conflictState: surfaceRoot.conflictState,
      reconciliationRequired: surfaceRoot.conflictState !== "clean",
      supersededFieldRef: null,
      clientRevision: null,
    });

    return {
      nodes: Array.from(nodes.values()),
      rootIds: [rootId],
      rootNode: surfaceRoot,
    };
  }

  /**
   * Resolves effective fields by combining schema introspection with persistent annotations and tenant overrides.
   */
  async getEffectiveFields(entityName: string) {
    const table = (schema as any)[entityName];
    const introspectedFields = new Map<string, any>();

    if (table) {
      const columns = getColumns(table);
      for (const [colName, col] of Object.entries(columns)) {
        const columnType = (col as any).columnType;
        const isPk = (col as any).primary || false;
        const isUuid = columnType === "PgUUID" || (col as any).dataType === "uuid";
        const lookupTable = resolveLookupTable(entityName, colName);

        introspectedFields.set(colName, {
          fieldName: colName,
          entityName,
          fieldType: getFieldType(columnType),
          isVisible:
            (!isPk &&
              !technicalFieldNames.has(colName) &&
              (!colName.endsWith("Id") || !!lookupTable) &&
              !/SourceEntity$|SourceId$|SourceField$|LinkedAt$|OverriddenAt$/.test(colName)) ||
            (entityName === "documentGroup" && colName === "nextGroupId"),
          isRequired: (col as any).notNull || false,
          label: { en: colName, de: colName },
          scope: "introspection",
          lookupTable,
          isUuid,
          isPk,
          customAttributes: null,
          conflictState: "clean",
          reconciliationRequired: false,
          versionInfo: buildVersionInfo({
            baseVersion: `schema:${entityName}:${colName}`,
            derivedFromVersion: `schema:${entityName}:${colName}`,
            overrideMode: "base",
            conflictState: "clean",
            reconciliationRequired: false,
          }),
        });
      }
    }

    const annotations = await db
      .select()
      .from(schemaAnnotations)
      .where(eq(schemaAnnotations.tableName, entityName));

    for (const ann of annotations) {
      const field = introspectedFields.get(ann.columnName);
      if (field) {
        field.label = { en: ann.businessName, de: ann.businessName };
        field.helpText = { en: ann.description, de: ann.description };
        field.scope = "annotation";
        field.annotationId = ann.id;
        field.annotationVersion = ann.aiGeneratedAt ? ann.aiGeneratedAt.toISOString() : null;
        field.versionInfo = buildVersionInfo({
          baseVersion: `annotation:${ann.id}`,
          derivedFromVersion: field.annotationVersion ?? `annotation:${ann.id}`,
          overrideMode: "base",
          conflictState: field.conflictState ?? "clean",
          reconciliationRequired: false,
        });
      }
    }

    const overrides = await db
      .select()
      .from(tenantFields)
      .where(eq(tenantFields.entityName, entityName));

    const merged = mergeOverrides(introspectedFields, overrides, this.context);
    const registries = await db.select().from(helperTableRegistry);
    const latestHistory = await this.getLatestHistory(entityName, "field");
    const latestHistoryByField = latestHistory;
    const result = Array.from(merged.values()).map((field) =>
      finalizeLocalizedField(
        field,
        registries,
        latestHistoryByField.get(`field:${field.fieldName}`),
      ),
    );

    const orphanFields = new Map<string, Record<string, any>>();
    for (const scope of ["global", "org", "tenant"] as const) {
      for (const override of overrides) {
        if (override.scope !== scope) continue;
        if (scope === "org" && override.organizationId !== this.context.organizationId) continue;
        if (scope === "tenant" && override.tenantId !== this.context.tenantId) continue;
        if (merged.has(override.fieldName) || orphanFields.has(override.fieldName)) continue;

        const conflictState: DesignerConflictState = (override as any).conflictState
          ? mapConflictState((override as any).conflictState)
          : "tombstoned";
        const designerMeta = isRecord(override.customAttributes)
          ? (override.customAttributes as any).designer
          : undefined;
        orphanFields.set(override.fieldName, {
          ...override,
          entityName,
          fieldType: override.fieldType || "text",
          isVisible: false,
          conflictState,
          reconciliationRequired: true,
          versionInfo: buildVersionInfo({
            baseVersion: `schema:${entityName}:${override.fieldName}`,
            derivedFromVersion:
              toTimestampString(override.createdAt) ??
              toTimestampString(
                latestHistoryByField.get(`field:${override.fieldName}`)?.createdAt,
              ) ??
              `schema:${entityName}:${override.fieldName}`,
            overrideMode: inferOverrideMode(override.scope),
            conflictState,
            reconciliationRequired: true,
            supersededFieldRef: designerMeta?.supersededFieldRef ?? null,
            clientRevision: designerMeta?.clientRevision ?? null,
          }),
        });
      }
    }

    return result.concat(
      Array.from(orphanFields.values()).map((field) =>
        finalizeLocalizedField(
          field,
          registries,
          latestHistoryByField.get(`field:${field.fieldName}`),
        ),
      ),
    );
  }

  async getEffectiveGroups(entityName: string) {
    return await this.getDesignerGroups(entityName);
  }

  /**
   * Resolves effective layout definition.
   */
  async getEffectiveLayout(entityName: string, layoutKey: string) {
    const state = await this.resolveDesignerLayoutState(entityName, layoutKey);
    return {
      ...state.effectiveLayout,
      conflictState: state.conflictState,
      reconciliationRequired: state.reconciliationRequired,
      versionInfo: state.versionInfo,
      resolution: {
        effectiveScope: state.effectiveScope,
        scopes: {
          global: extractLayoutDefinition(state.layoutRowsByScope.get("global")?.layoutDefinition),
          org: extractLayoutDefinition(state.layoutRowsByScope.get("org")?.layoutDefinition),
          tenant: extractLayoutDefinition(state.layoutRowsByScope.get("tenant")?.layoutDefinition),
          user: extractLayoutDefinition(state.layoutRowsByScope.get("user")?.layoutDefinition),
        },
      },
    };
  }

  async getDesignerSurface(
    entityName: string,
    surface: DesignerSurfaceKind,
  ): Promise<DesignerSurfaceContract> {
    const layoutKey = resolveSurfaceLayoutKey(surface);
    const [fields, groups, layoutState] = await Promise.all([
      this.getEffectiveFields(entityName),
      this.getEffectiveGroups(entityName),
      this.resolveDesignerLayoutState(entityName, layoutKey),
    ]);

    const normalized = this.buildDesignerNodes({
      entityName,
      surface,
      fields,
      groups,
      layout: extractLayoutDefinition(layoutState.effectiveLayout),
      layoutVersionInfo: layoutState.versionInfo,
    });
    const conflictState = aggregateConflictState(
      normalized.nodes.map((node) => node.conflictState),
    );
    const reconciliationRequired = conflictState !== "clean";
    const derivedFromVersion =
      normalized.nodes
        .map((node) => node.versionInfo.derivedFromVersion)
        .find((version) => Boolean(version)) ?? layoutState.versionInfo.derivedFromVersion;

    return {
      entityName,
      surface,
      nodes: normalized.nodes,
      rootIds: normalized.rootIds,
      versionInfo: buildVersionInfo({
        baseVersion: `surface:${entityName}:${surface}`,
        derivedFromVersion,
        overrideMode: "derived",
        conflictState,
        reconciliationRequired,
      }),
      conflictState,
      reconciliationRequired,
      requiredFollowUpActions: reconciliationRequired ? ["review-conflicts"] : [],
      autoAppliedRemaps: [],
      effectiveFields: fields,
      effectiveGroups: groups,
      effectiveLayout: extractLayoutDefinition(layoutState.effectiveLayout),
    };
  }

  async getDesignerFieldSurface(entityName: string) {
    return await this.getDesignerSurface(entityName, "triview-detail");
  }

  async getDesignerGridSurface(entityName: string) {
    return await this.getDesignerSurface(entityName, "triview-grid");
  }

  async getDesignerDocumentHeaderSurface(entityName: string) {
    return await this.getDesignerSurface(entityName, "document-header");
  }

  /**
   * Resolves system settings by key.
   */
  async getEffectiveSetting(key: string) {
    const rawSettings = await db.select().from(systemSettings).where(eq(systemSettings.key, key));

    let effectiveValue = rawSettings.find((s) => s.scope === "global")?.value;

    if (this.context.organizationId) {
      const orgSetting = rawSettings.find(
        (s) => s.scope === "org" && s.organizationId === this.context.organizationId,
      );
      if (orgSetting) effectiveValue = orgSetting.value;
    }

    const tenantSetting = rawSettings.find(
      (s) => s.scope === "tenant" && s.tenantId === this.context.tenantId,
    );
    if (tenantSetting) effectiveValue = tenantSetting.value;

    return effectiveValue;
  }

  async getSettingsRegistry() {
    return await db
      .select()
      .from(helperTableRegistry)
      .where(eq(helperTableRegistry.category, "settings"));
  }
}
