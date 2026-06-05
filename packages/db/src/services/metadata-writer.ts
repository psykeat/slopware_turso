import { isDeepStrictEqual } from "node:util";

import { and, eq } from "drizzle-orm";

import { db } from "../index";
import { metadataHistory, tenantFields, tenantGroups, tenantLayouts } from "../schema/app.schema";
import * as schema from "../schema/index";
import {
  MetadataResolver,
  type DesignerConflictState,
  type DesignerPatch,
  type DesignerPatchOperation,
  type DesignerRemapSuggestion,
  type DesignerSurfaceContract,
  type DesignerSurfaceKind,
  type DesignerVersionInfo,
} from "./metadata";

export interface MetadataWriterContext {
  tenantId: string;
  userId: string;
  isSystemAdmin: boolean;
  isBaseTenant: boolean;
  organizationId?: string;
}

type MetadataScope = "global" | "org" | "tenant";

export interface DesignerPatchResult {
  entityName: string;
  surface: DesignerSurfaceKind;
  patch: DesignerPatch;
  scope: MetadataScope;
  status: "saved" | "applied" | "reconciled" | "needs_review";
  conflictState: DesignerConflictState;
  reconciliationRequired: boolean;
  versionInfo: DesignerVersionInfo;
  requiredFollowUpActions: string[];
  suggestedRemaps: DesignerRemapSuggestion[];
  appliedOps: string[];
  skippedOps: Array<{ nodeKey: string; reason: string }>;
  updatedContract?: DesignerSurfaceContract;
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toLocalizedValue(value: unknown, fallback: string) {
  if (isRecord(value)) return value;
  if (typeof value === "string" && value.length > 0) {
    return { en: value, de: value };
  }
  return { en: fallback, de: fallback };
}

function mergeCustomAttributes(
  existing: unknown,
  incoming: unknown,
  patchMeta?: Record<string, unknown>,
) {
  const base = isRecord(existing) ? { ...existing } : {};
  const next = isRecord(incoming) ? { ...incoming } : {};
  const existingDesigner = isRecord(base.designer) ? { ...base.designer } : {};
  const incomingDesigner = isRecord(next.designer) ? { ...next.designer } : {};

  return {
    ...base,
    ...next,
    designer: {
      ...existingDesigner,
      ...incomingDesigner,
      ...(patchMeta ?? {}),
    },
  };
}

function pickDefined<T extends Record<string, any>>(value: T, keys: string[]) {
  const picked: Record<string, any> = {};
  for (const key of keys) {
    const nextValue = value[key];
    if (nextValue !== undefined) {
      picked[key] = nextValue;
    }
  }
  return picked;
}

function normalizeDesignerPatch(
  entityName: string,
  surface: DesignerSurfaceKind,
  patch: DesignerPatch,
): DesignerPatch {
  if (!surface) {
    throw new Error("Designer surface is required");
  }
  if (patch.surface !== surface) {
    throw new Error(`Patch surface mismatch: expected ${surface}, received ${patch.surface}`);
  }
  if (!Array.isArray(patch.ops) || patch.ops.length === 0) {
    throw new Error("Designer patch requires at least one operation");
  }
  if (!(schema as any)[entityName]) {
    throw new Error(`Unknown metadata entity: ${entityName}`);
  }

  for (const op of patch.ops) {
    if (!op || typeof op !== "object" || typeof (op as any).op !== "string") {
      throw new Error("Invalid designer patch operation");
    }

    if (typeof (op as any).nodeKey !== "string" || !(op as any).nodeKey) {
      throw new Error("Designer patch operation requires nodeKey");
    }

    if ((op as any).op === "set") {
      if (typeof (op as any).path !== "string" || !(op as any).path) {
        throw new Error("Designer set operation requires path");
      }
      if (
        ["tenantId", "organizationId", "scope", "createdAt", "updatedAt"].includes((op as any).path)
      ) {
        throw new Error(`Designer patch path is not allowed: ${(op as any).path}`);
      }
    }

    if ((op as any).op === "move" && typeof (op as any).index !== "number") {
      throw new Error("Designer move operation requires an index");
    }
  }

  return {
    ...patch,
    surface,
    baseVersion: patch.baseVersion ?? null,
    derivedFromVersion: patch.derivedFromVersion ?? null,
    clientRevision: patch.clientRevision ?? null,
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

function parseNodeKey(nodeKey: string) {
  const parts = nodeKey.split(":").filter(Boolean);
  const kind = parts.length > 1 ? parts[0] : null;
  const key = parts.length > 1 ? parts[parts.length - 1] : nodeKey;
  return { kind, key };
}

function setDeep(target: Record<string, any>, path: string, value: unknown) {
  const segments = path.split(".").filter(Boolean);
  if (segments.length === 0) return target;

  const next = { ...target };
  let cursor: Record<string, any> = next;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    const current = cursor[segment];
    cursor[segment] = isRecord(current) ? { ...current } : {};
    cursor = cursor[segment];
  }

  cursor[segments[segments.length - 1]] = value;
  return next;
}

function extractLayoutDefinition(layoutDefinition: unknown) {
  if (isRecord(layoutDefinition)) return layoutDefinition;
  return {};
}

function deriveConflictStateFromDesignerMeta(
  current: unknown,
  fallback: DesignerConflictState = "clean",
) {
  if (
    current === "clean" ||
    current === "deprecated" ||
    current === "tombstoned" ||
    current === "conflicted" ||
    current === "needs_review"
  ) {
    return current;
  }
  return fallback;
}

function mapScope(scope: unknown): MetadataScope {
  return scope === "global" || scope === "org" ? scope : "tenant";
}

function buildPatchMeta(
  patch: DesignerPatch,
  scope: MetadataScope,
  conflictState: DesignerConflictState,
) {
  return {
    baseVersion: patch.baseVersion,
    derivedFromVersion: patch.derivedFromVersion,
    clientRevision: patch.clientRevision ?? null,
    scope,
    conflictState,
  };
}

export class MetadataWriter {
  private context: MetadataWriterContext;

  constructor(context: MetadataWriterContext) {
    this.context = context;
  }

  private getScope() {
    if (this.context.isBaseTenant) {
      return "global";
    }

    if (this.context.isSystemAdmin && this.context.organizationId) {
      return "org";
    }

    return "tenant";
  }

  private getResolver() {
    return new MetadataResolver({
      tenantId: this.context.tenantId,
      organizationId: this.context.organizationId,
    });
  }

  private assertKnownEntity(entityName: string) {
    if (!(schema as any)[entityName]) {
      throw new Error(`Unknown metadata entity: ${entityName}`);
    }
  }

  private async logHistory(
    tx: any,
    params: {
      entityName: string;
      metadataType: string;
      metadataKey: string;
      oldValue: any;
      newValue: any;
      changeType: "insert" | "update" | "delete";
    },
  ) {
    try {
      await tx.insert(metadataHistory).values({
        tenantId: this.context.tenantId,
        userId: this.context.userId,
        entityName: params.entityName,
        metadataType: params.metadataType,
        metadataKey: params.metadataKey,
        oldValue: params.oldValue,
        newValue: params.newValue,
        changeType: params.changeType,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const cause = error && typeof error === "object" ? (error as any).cause : null;
      const causeCode = cause && typeof cause === "object" ? (cause as any).code : null;
      const isMissingHistoryTable =
        message.includes('relation "metadata_history" does not exist') || causeCode === "42P01";

      if (!isMissingHistoryTable) {
        throw error;
      }
    }
  }

  private async getCurrentFieldRow(
    tx: any,
    entityName: string,
    fieldName: string,
    scope: MetadataScope,
  ) {
    const where = [
      eq(tenantFields.entityName, entityName),
      eq(tenantFields.fieldName, fieldName),
      eq(tenantFields.scope, scope),
    ];

    if (scope === "tenant") {
      where.push(eq(tenantFields.tenantId, this.context.tenantId));
    } else if (scope === "org") {
      where.push(eq(tenantFields.organizationId, this.context.organizationId ?? ""));
    }

    const rows = await tx
      .select()
      .from(tenantFields)
      .where(and(...where))
      .limit(1);
    return rows[0] ?? null;
  }

  private async getCurrentGroupRow(
    tx: any,
    entityName: string,
    groupKey: string,
    scope: MetadataScope,
  ) {
    const where = [
      eq(tenantGroups.entityName, entityName),
      eq(tenantGroups.groupKey, groupKey),
      eq(tenantGroups.scope, scope),
    ];

    if (scope === "tenant") {
      where.push(eq(tenantGroups.tenantId, this.context.tenantId));
    } else if (scope === "org") {
      where.push(eq(tenantGroups.organizationId, this.context.organizationId ?? ""));
    }

    const rows = await tx
      .select()
      .from(tenantGroups)
      .where(and(...where))
      .limit(1);
    return rows[0] ?? null;
  }

  private async getCurrentLayoutRow(
    tx: any,
    entityName: string,
    layoutKey: string,
    scope: MetadataScope,
  ) {
    const where = [
      eq(tenantLayouts.entityName, entityName),
      eq(tenantLayouts.layoutKey, layoutKey),
      eq(tenantLayouts.scope, scope),
    ];

    if (scope === "tenant") {
      where.push(eq(tenantLayouts.tenantId, this.context.tenantId));
    } else if (scope === "org") {
      where.push(eq(tenantLayouts.organizationId, this.context.organizationId ?? ""));
    }

    const rows = await tx
      .select()
      .from(tenantLayouts)
      .where(and(...where))
      .limit(1);
    return rows[0] ?? null;
  }

  private buildFieldWriteData(existing: any, data: any, patchMeta?: Record<string, unknown>) {
    const nextCustomAttributes = mergeCustomAttributes(
      existing?.customAttributes,
      data?.customAttributes,
      patchMeta,
    );

    return pickDefined(
      {
        fieldType: data?.fieldType ?? existing?.fieldType ?? "text",
        isRequired: data?.isRequired ?? existing?.isRequired ?? false,
        label:
          data?.label !== undefined
            ? toLocalizedValue(data.label, existing?.fieldName ?? "")
            : existing?.label,
        helpText:
          data?.helpText !== undefined
            ? toLocalizedValue(data.helpText, existing?.fieldName ?? "")
            : existing?.helpText,
        isVisible: data?.isVisible ?? existing?.isVisible ?? true,
        displayOrder: data?.displayOrder ?? existing?.displayOrder,
        importColumn: data?.importColumn ?? existing?.importColumn,
        importType: data?.importType ?? existing?.importType,
        importRequired: data?.importRequired ?? existing?.importRequired ?? false,
        importTransform: data?.importTransform ?? existing?.importTransform,
        groupId: data?.groupId ?? existing?.groupId ?? null,
        lookupTable: data?.lookupTable ?? existing?.lookupTable,
        lookupFilter: data?.lookupFilter ?? existing?.lookupFilter,
        customAttributes: nextCustomAttributes,
      },
      [
        "fieldType",
        "isRequired",
        "label",
        "helpText",
        "isVisible",
        "displayOrder",
        "importColumn",
        "importType",
        "importRequired",
        "importTransform",
        "groupId",
        "lookupTable",
        "lookupFilter",
        "customAttributes",
      ],
    );
  }

  private buildGroupWriteData(existing: any, data: any, patchMeta?: Record<string, unknown>) {
    const nextCustomAttributes = mergeCustomAttributes(
      existing?.customAttributes,
      data?.customAttributes,
      patchMeta,
    );

    return pickDefined(
      {
        label:
          data?.label !== undefined
            ? toLocalizedValue(data.label, existing?.groupKey ?? "")
            : existing?.label,
        displayOrder: data?.displayOrder ?? existing?.displayOrder ?? 0,
        isVisible: data?.isVisible ?? existing?.isVisible ?? true,
        customAttributes: nextCustomAttributes,
      },
      ["label", "displayOrder", "isVisible", "customAttributes"],
    );
  }

  private buildLayoutWriteData(existing: any, data: any, patchMeta?: Record<string, unknown>) {
    const nextLayoutDefinition = isRecord(data?.layoutDefinition)
      ? data.layoutDefinition
      : isRecord(data)
        ? data
        : {};
    const next = mergeCustomAttributes(existing?.layoutDefinition, nextLayoutDefinition, patchMeta);
    return next;
  }

  private async upsertFieldOverrideTx(
    tx: any,
    entityName: string,
    fieldName: string,
    data: any,
    patchMeta?: Record<string, unknown>,
  ) {
    const scope = this.getScope();
    const scopeIdentity = {
      scope,
      organizationId:
        scope === "org"
          ? (this.context.organizationId ?? null)
          : (this.context.organizationId ?? null),
      tenantId: scope === "tenant" ? this.context.tenantId : null,
    };

    const where = [
      eq(tenantFields.entityName, entityName),
      eq(tenantFields.fieldName, fieldName),
      eq(tenantFields.scope, scope),
    ];

    if (scope === "tenant") {
      where.push(eq(tenantFields.tenantId, this.context.tenantId));
    } else if (scope === "org") {
      where.push(eq(tenantFields.organizationId, this.context.organizationId ?? ""));
    }

    const existingRows = await tx
      .select()
      .from(tenantFields)
      .where(and(...where))
      .limit(1);
    const existing = existingRows[0] ?? null;
    const values = this.buildFieldWriteData(existing, data, patchMeta);

    if (existing) {
      const old = existing;
      await tx
        .update(tenantFields)
        .set(values)
        .where(and(...where));
      await this.logHistory(tx, {
        entityName,
        metadataType: "field",
        metadataKey: fieldName,
        oldValue: old,
        newValue: { ...values, ...scopeIdentity },
        changeType: "update",
      });
      return;
    }

    await tx.insert(tenantFields).values({
      entityName,
      fieldName,
      scope,
      organizationId: scopeIdentity.organizationId,
      tenantId: scopeIdentity.tenantId,
      ...values,
    });

    await this.logHistory(tx, {
      entityName,
      metadataType: "field",
      metadataKey: fieldName,
      oldValue: null,
      newValue: { ...values, ...scopeIdentity },
      changeType: "insert",
    });
  }

  private async upsertGroupOverrideTx(
    tx: any,
    entityName: string,
    groupKey: string,
    data: any,
    patchMeta?: Record<string, unknown>,
  ) {
    const scope = this.getScope();
    const scopeIdentity = {
      scope,
      organizationId:
        scope === "org"
          ? (this.context.organizationId ?? null)
          : (this.context.organizationId ?? null),
      tenantId: scope === "tenant" ? this.context.tenantId : null,
    };

    const where = [
      eq(tenantGroups.entityName, entityName),
      eq(tenantGroups.groupKey, groupKey),
      eq(tenantGroups.scope, scope),
    ];

    if (scope === "tenant") {
      where.push(eq(tenantGroups.tenantId, this.context.tenantId));
    } else if (scope === "org") {
      where.push(eq(tenantGroups.organizationId, this.context.organizationId ?? ""));
    }

    const existingRows = await tx
      .select()
      .from(tenantGroups)
      .where(and(...where))
      .limit(1);
    const existing = existingRows[0] ?? null;
    const values = this.buildGroupWriteData(existing, data, patchMeta);

    if (existing) {
      const old = existing;
      await tx
        .update(tenantGroups)
        .set(values)
        .where(and(...where));
      await this.logHistory(tx, {
        entityName,
        metadataType: "group",
        metadataKey: groupKey,
        oldValue: old,
        newValue: { ...values, ...scopeIdentity },
        changeType: "update",
      });
      return;
    }

    await tx.insert(tenantGroups).values({
      entityName,
      groupKey,
      scope,
      organizationId: scopeIdentity.organizationId,
      tenantId: scopeIdentity.tenantId,
      ...values,
    });

    await this.logHistory(tx, {
      entityName,
      metadataType: "group",
      metadataKey: groupKey,
      oldValue: null,
      newValue: { ...values, ...scopeIdentity },
      changeType: "insert",
    });
  }

  private async upsertLayoutOverrideTx(
    tx: any,
    entityName: string,
    layoutKey: string,
    data: any,
    patchMeta?: Record<string, unknown>,
  ) {
    const scope = this.getScope();
    const scopeIdentity = {
      scope,
      organizationId:
        scope === "org"
          ? (this.context.organizationId ?? null)
          : (this.context.organizationId ?? null),
      tenantId: scope === "tenant" ? this.context.tenantId : null,
    };

    const where = [
      eq(tenantLayouts.entityName, entityName),
      eq(tenantLayouts.layoutKey, layoutKey),
      eq(tenantLayouts.scope, scope),
    ];

    if (scope === "tenant") {
      where.push(eq(tenantLayouts.tenantId, this.context.tenantId));
    } else if (scope === "org") {
      where.push(eq(tenantLayouts.organizationId, this.context.organizationId ?? ""));
    }

    const existingRows = await tx
      .select()
      .from(tenantLayouts)
      .where(and(...where))
      .limit(1);
    const existing = existingRows[0] ?? null;
    const values = this.buildLayoutWriteData(existing, data, patchMeta);

    if (existing) {
      if (isDeepStrictEqual(existing.layoutDefinition, values)) {
        return;
      }
      const old = existing;
      await tx
        .update(tenantLayouts)
        .set({
          layoutDefinition: values,
        })
        .where(and(...where));
      await this.logHistory(tx, {
        entityName,
        metadataType: "layout",
        metadataKey: layoutKey,
        oldValue: old,
        newValue: { layoutDefinition: values, ...scopeIdentity },
        changeType: "update",
      });
      return;
    }

    await tx.insert(tenantLayouts).values({
      entityName,
      layoutKey,
      scope,
      organizationId: scopeIdentity.organizationId,
      tenantId: scopeIdentity.tenantId,
      layoutDefinition: values,
    });

    await this.logHistory(tx, {
      entityName,
      metadataType: "layout",
      metadataKey: layoutKey,
      oldValue: null,
      newValue: { layoutDefinition: values, ...scopeIdentity },
      changeType: "insert",
    });
  }

  private async appendDesignerPatchHistory(
    tx: any,
    entityName: string,
    patch: DesignerPatch,
    status: string,
  ) {
    await this.logHistory(tx, {
      entityName,
      metadataType: "designer_patch",
      metadataKey: patch.surface,
      oldValue: null,
      newValue: {
        ...patch,
        status,
        scope: this.getScope(),
      },
      changeType: "update",
    });
  }

  private async applyFieldPatchOpTx(
    tx: any,
    entityName: string,
    patch: DesignerPatch,
    op: DesignerPatchOperation,
  ) {
    if (op.op === "insert") {
      const fieldName =
        typeof op.data?.fieldName === "string" ? op.data.fieldName : parseNodeKey(op.nodeKey).key;
      await this.upsertFieldOverrideTx(
        tx,
        entityName,
        fieldName,
        {
          ...op.data,
          fieldType: op.data?.fieldType ?? "text",
          isVisible: op.data?.isVisible ?? true,
        },
        buildPatchMeta(patch, this.getScope(), "clean"),
      );
      return { applied: true };
    }

    const fieldName = parseNodeKey(op.nodeKey).key;
    const existing = await this.getCurrentFieldRow(
      tx,
      entityName,
      fieldName,
      mapScope(this.getScope()),
    );
    const baseData = existing ? { ...existing } : { fieldName, entityName };

    if (op.op === "delete") {
      const nextData = {
        ...baseData,
        isVisible: false,
        customAttributes: mergeCustomAttributes(existing?.customAttributes, {
          designer: {
            conflictState: "tombstoned",
            reason: op.reason ?? "designer-delete",
          },
        }),
      };
      await this.upsertFieldOverrideTx(
        tx,
        entityName,
        fieldName,
        nextData,
        buildPatchMeta(patch, this.getScope(), "tombstoned"),
      );
      return { applied: true };
    }

    if (op.op === "move") {
      const parentGroupKey = op.parentKey
        ? parseNodeKey(op.parentKey).key
        : (existing?.groupId ?? null);
      await this.upsertFieldOverrideTx(
        tx,
        entityName,
        fieldName,
        {
          ...baseData,
          displayOrder: op.index,
          groupId: parentGroupKey,
        },
        buildPatchMeta(patch, this.getScope(), "clean"),
      );
      return { applied: true };
    }

    if (op.op === "set") {
      const path = op.path;
      const nextData: Record<string, any> = { ...baseData };
      switch (path) {
        case "label":
        case "helpText":
          nextData[path] = toLocalizedValue(op.value, fieldName);
          break;
        case "visible":
          nextData.isVisible = Boolean(op.value);
          break;
        case "readonly":
          nextData.customAttributes = mergeCustomAttributes(existing?.customAttributes, undefined, {
            readonly: Boolean(op.value),
          });
          break;
        case "required":
          nextData.isRequired = Boolean(op.value);
          break;
        case "displayOrder":
          nextData.displayOrder = typeof op.value === "number" ? op.value : Number(op.value);
          break;
        case "styleTokenBinding":
        case "ruleBinding":
        case "path":
          nextData.customAttributes = mergeCustomAttributes(existing?.customAttributes, undefined, {
            [path]: op.value,
          });
          break;
        case "groupId":
          nextData.groupId = typeof op.value === "string" ? op.value : null;
          break;
        case "lookupTable":
          nextData.lookupTable = typeof op.value === "string" ? op.value : null;
          break;
        case "lookupFilter":
          nextData.lookupFilter = isRecord(op.value) ? op.value : null;
          break;
        case "customAttributes":
          nextData.customAttributes = mergeCustomAttributes(
            existing?.customAttributes,
            op.value,
            buildPatchMeta(patch, this.getScope(), "clean"),
          );
          break;
        case "conflictState":
          nextData.customAttributes = mergeCustomAttributes(existing?.customAttributes, undefined, {
            conflictState: op.value,
          });
          break;
        default:
          return {
            applied: false,
            reason: `unsupported field path: ${path}`,
          };
      }

      await this.upsertFieldOverrideTx(
        tx,
        entityName,
        fieldName,
        nextData,
        buildPatchMeta(
          patch,
          this.getScope(),
          deriveConflictStateFromDesignerMeta(op.value as any),
        ),
      );
      return { applied: true };
    }

    return { applied: false, reason: `unsupported field op: ${(op as any).op}` };
  }

  private async applyGroupPatchOpTx(
    tx: any,
    entityName: string,
    patch: DesignerPatch,
    op: DesignerPatchOperation,
  ) {
    if (op.op === "insert") {
      const groupKey =
        typeof op.data?.groupKey === "string" ? op.data.groupKey : parseNodeKey(op.nodeKey).key;
      await this.upsertGroupOverrideTx(
        tx,
        entityName,
        groupKey,
        {
          ...op.data,
          label: op.data?.label ?? groupKey,
          displayOrder: op.data?.displayOrder ?? 0,
          isVisible: op.data?.isVisible ?? true,
        },
        buildPatchMeta(patch, this.getScope(), "clean"),
      );
      return { applied: true };
    }

    const groupKey = parseNodeKey(op.nodeKey).key;
    const existing = await this.getCurrentGroupRow(
      tx,
      entityName,
      groupKey,
      mapScope(this.getScope()),
    );
    const baseData = existing ? { ...existing } : { groupKey, entityName };

    if (op.op === "delete") {
      await this.upsertGroupOverrideTx(
        tx,
        entityName,
        groupKey,
        {
          ...baseData,
          isVisible: false,
          customAttributes: mergeCustomAttributes(existing?.customAttributes, undefined, {
            conflictState: "tombstoned",
            reason: op.reason ?? "designer-delete",
          }),
        },
        buildPatchMeta(patch, this.getScope(), "tombstoned"),
      );
      return { applied: true };
    }

    if (op.op === "move") {
      await this.upsertGroupOverrideTx(
        tx,
        entityName,
        groupKey,
        {
          ...baseData,
          displayOrder: op.index,
          customAttributes: mergeCustomAttributes(existing?.customAttributes, undefined, {
            parentId: op.parentKey ?? null,
          }),
        },
        buildPatchMeta(patch, this.getScope(), "clean"),
      );
      return { applied: true };
    }

    if (op.op === "set") {
      const nextData: Record<string, any> = { ...baseData };
      switch (op.path) {
        case "label":
          nextData.label = toLocalizedValue(op.value, groupKey);
          break;
        case "visible":
          nextData.isVisible = Boolean(op.value);
          break;
        case "displayOrder":
          nextData.displayOrder = typeof op.value === "number" ? op.value : Number(op.value);
          break;
        case "styleTokenBinding":
        case "ruleBinding":
        case "parentId":
          nextData.customAttributes = mergeCustomAttributes(existing?.customAttributes, undefined, {
            [op.path]: op.value,
          });
          break;
        case "customAttributes":
          nextData.customAttributes = mergeCustomAttributes(
            existing?.customAttributes,
            op.value,
            buildPatchMeta(patch, this.getScope(), "clean"),
          );
          break;
        case "conflictState":
          nextData.customAttributes = mergeCustomAttributes(existing?.customAttributes, undefined, {
            conflictState: op.value,
          });
          break;
        default:
          return {
            applied: false,
            reason: `unsupported group path: ${op.path}`,
          };
      }

      await this.upsertGroupOverrideTx(
        tx,
        entityName,
        groupKey,
        nextData,
        buildPatchMeta(
          patch,
          this.getScope(),
          deriveConflictStateFromDesignerMeta(op.value as any),
        ),
      );
      return { applied: true };
    }

    return { applied: false, reason: `unsupported group op: ${(op as any).op}` };
  }

  private async applyLayoutPatchOpTx(
    tx: any,
    entityName: string,
    surface: DesignerSurfaceKind,
    patch: DesignerPatch,
    op: DesignerPatchOperation,
  ) {
    const layoutKey = resolveSurfaceLayoutKey(surface);
    const existing = await this.getCurrentLayoutRow(
      tx,
      entityName,
      layoutKey,
      mapScope(this.getScope()),
    );
    const currentLayout = extractLayoutDefinition(existing?.layoutDefinition);

    const nextLayout = { ...currentLayout };

    if (op.op === "insert") {
      const nodes = Array.isArray(nextLayout.nodes) ? [...nextLayout.nodes] : [];
      nodes.push({
        id: op.nodeKey,
        kind: op.kind,
        parentKey: op.parentKey ?? null,
        index: op.index ?? nodes.length,
        ...(op.data ?? {}),
      });
      nextLayout.nodes = nodes;
      await this.upsertLayoutOverrideTx(
        tx,
        entityName,
        layoutKey,
        { layoutDefinition: nextLayout },
        buildPatchMeta(patch, this.getScope(), "clean"),
      );
      return { applied: true };
    }

    if (op.op === "delete") {
      nextLayout.designer = mergeCustomAttributes(nextLayout.designer, undefined, {
        conflictState: "tombstoned",
        reason: op.reason ?? "designer-delete",
        nodeKey: op.nodeKey,
      });
      nextLayout.visible = false;
      await this.upsertLayoutOverrideTx(
        tx,
        entityName,
        layoutKey,
        { layoutDefinition: nextLayout },
        buildPatchMeta(patch, this.getScope(), "tombstoned"),
      );
      return { applied: true };
    }

    if (op.op === "move") {
      nextLayout.displayOrder = op.index;
      nextLayout.designer = mergeCustomAttributes(nextLayout.designer, undefined, {
        parentId: op.parentKey ?? null,
        nodeKey: op.nodeKey,
      });
      await this.upsertLayoutOverrideTx(
        tx,
        entityName,
        layoutKey,
        { layoutDefinition: nextLayout },
        buildPatchMeta(patch, this.getScope(), "clean"),
      );
      return { applied: true };
    }

    if (op.op === "set") {
      if (op.path.startsWith("layoutDefinition.")) {
        const path = op.path.slice("layoutDefinition.".length);
        const setLayout = setDeep(nextLayout, path, op.value);
        await this.upsertLayoutOverrideTx(
          tx,
          entityName,
          layoutKey,
          { layoutDefinition: setLayout },
          buildPatchMeta(patch, this.getScope(), "clean"),
        );
        return { applied: true };
      }

      const setLayout = setDeep(nextLayout, op.path, op.value);
      await this.upsertLayoutOverrideTx(
        tx,
        entityName,
        layoutKey,
        { layoutDefinition: setLayout },
        buildPatchMeta(
          patch,
          this.getScope(),
          deriveConflictStateFromDesignerMeta(op.value as any),
        ),
      );
      return { applied: true };
    }

    if (op.op === "reconcile") {
      nextLayout.designer = mergeCustomAttributes(nextLayout.designer, undefined, {
        reconcileTarget: op.targetKey ?? null,
        note: op.note ?? null,
        nodeKey: op.nodeKey,
      });
      await this.upsertLayoutOverrideTx(
        tx,
        entityName,
        layoutKey,
        { layoutDefinition: nextLayout },
        buildPatchMeta(patch, this.getScope(), "needs_review"),
      );
      return { applied: true };
    }

    return { applied: false, reason: `unsupported layout op: ${(op as any).op}` };
  }

  private async executePatch(
    tx: any,
    entityName: string,
    surface: DesignerSurfaceKind,
    patch: DesignerPatch,
  ) {
    const appliedOps: string[] = [];
    const skippedOps: Array<{ nodeKey: string; reason: string }> = [];

    for (const op of patch.ops) {
      const parsed = parseNodeKey(op.nodeKey);
      let result: { applied: boolean; reason?: string };

      if (parsed.kind === "group" || parsed.kind === "group-frame") {
        result = await this.applyGroupPatchOpTx(tx, entityName, patch, op);
      } else if (
        parsed.kind === "field" ||
        parsed.kind === "grid-column" ||
        parsed.kind === null ||
        surface === "triview-detail" ||
        surface === "triview-grid" ||
        surface === "dependent-grid" ||
        surface === "document-header" ||
        surface === "document-lines"
      ) {
        result = await this.applyFieldPatchOpTx(tx, entityName, patch, op);
      } else {
        result = await this.applyLayoutPatchOpTx(tx, entityName, surface, patch, op);
      }

      if (result.applied) {
        appliedOps.push(`${op.op}:${op.nodeKey}`);
      } else {
        skippedOps.push({ nodeKey: op.nodeKey, reason: result.reason ?? "unsupported" });
      }
    }

    return { appliedOps, skippedOps };
  }

  private async buildPatchResult(
    entityName: string,
    surface: DesignerSurfaceKind,
    patch: DesignerPatch,
    status: DesignerPatchResult["status"],
    appliedOps: string[],
    skippedOps: Array<{ nodeKey: string; reason: string }>,
    suggestedRemaps: DesignerRemapSuggestion[],
    updatedContract?: DesignerSurfaceContract,
  ): Promise<DesignerPatchResult> {
    const currentContract =
      updatedContract ?? (await this.getResolver().getDesignerSurface(entityName, surface));
    const conflictState = currentContract.conflictState;
    const reconciliationRequired =
      currentContract.reconciliationRequired || suggestedRemaps.length > 0;
    return {
      entityName,
      surface,
      patch,
      scope: this.getScope(),
      status,
      conflictState,
      reconciliationRequired,
      versionInfo: currentContract.versionInfo,
      requiredFollowUpActions: currentContract.requiredFollowUpActions,
      suggestedRemaps,
      appliedOps,
      skippedOps,
      updatedContract: currentContract,
    };
  }

  async saveDesignerPatch(entityName: string, surface: DesignerSurfaceKind, patch: DesignerPatch) {
    const normalizedPatch = normalizeDesignerPatch(entityName, surface, patch);
    const resolver = this.getResolver();
    const currentContract = await resolver.getDesignerSurface(entityName, surface);
    const suggestedRemaps = this.suggestRemaps(currentContract, normalizedPatch);
    const status =
      suggestedRemaps.length > 0 || currentContract.reconciliationRequired
        ? "needs_review"
        : "saved";

    return await db.transaction(async (tx) => {
      await this.appendDesignerPatchHistory(tx, entityName, normalizedPatch, status);
      return await this.buildPatchResult(
        entityName,
        surface,
        normalizedPatch,
        status,
        [],
        [],
        suggestedRemaps,
        currentContract,
      );
    });
  }

  async applyDesignerPatch(entityName: string, surface: DesignerSurfaceKind, patch: DesignerPatch) {
    const normalizedPatch = normalizeDesignerPatch(entityName, surface, patch);
    const currentContract = await this.getResolver().getDesignerSurface(entityName, surface);
    const suggestedRemaps = this.suggestRemaps(currentContract, normalizedPatch);

    return await db.transaction(async (tx) => {
      await this.appendDesignerPatchHistory(tx, entityName, normalizedPatch, "applied");
      const execution = await this.executePatch(tx, entityName, surface, normalizedPatch);
      const updatedContract = await this.getResolver().getDesignerSurface(entityName, surface);
      const status =
        suggestedRemaps.length > 0 || updatedContract.reconciliationRequired
          ? "needs_review"
          : "applied";

      return await this.buildPatchResult(
        entityName,
        surface,
        normalizedPatch,
        status,
        execution.appliedOps,
        execution.skippedOps,
        suggestedRemaps,
        updatedContract,
      );
    });
  }

  async reconcileDesignerPatch(
    entityName: string,
    surface: DesignerSurfaceKind,
    patch: DesignerPatch,
  ) {
    const normalizedPatch = normalizeDesignerPatch(entityName, surface, patch);
    const currentContract = await this.getResolver().getDesignerSurface(entityName, surface);
    const suggestedRemaps = this.suggestRemaps(currentContract, normalizedPatch);
    const status = suggestedRemaps.length > 0 ? "needs_review" : "reconciled";

    return await db.transaction(async (tx) => {
      await this.appendDesignerPatchHistory(tx, entityName, normalizedPatch, status);
      return await this.buildPatchResult(
        entityName,
        surface,
        normalizedPatch,
        status,
        [],
        [],
        suggestedRemaps,
        currentContract,
      );
    });
  }

  private suggestRemaps(
    contract: DesignerSurfaceContract,
    patch: DesignerPatch,
  ): DesignerRemapSuggestion[] {
    const nodeById = new Map(contract.nodes.map((node) => [node.id, node]));
    const nodeByField = new Map(
      contract.nodes
        .filter((node) => typeof node.fieldName === "string")
        .map((node) => [node.fieldName as string, node]),
    );
    const nodeByGroup = new Map(
      contract.nodes
        .filter((node) => typeof node.groupKey === "string")
        .map((node) => [node.groupKey as string, node]),
    );
    const remaps: DesignerRemapSuggestion[] = [];

    for (const op of patch.ops) {
      if (nodeById.has(op.nodeKey)) continue;

      const parsed = parseNodeKey(op.nodeKey);
      const candidate =
        (parsed.kind === "field" || parsed.kind === "grid-column"
          ? nodeByField.get(parsed.key)
          : undefined) ??
        (parsed.kind === "group" || parsed.kind === "group-frame"
          ? nodeByGroup.get(parsed.key)
          : undefined) ??
        nodeByField.get(op.nodeKey) ??
        nodeByGroup.get(op.nodeKey);

      if (candidate) {
        remaps.push({
          from: op.nodeKey,
          to: candidate.id,
          reason: "matched by stable designer metadata key",
        });
      }
    }

    return remaps;
  }

  async saveFieldOverride(entityName: string, fieldName: string, data: any) {
    this.assertKnownEntity(entityName);
    return await db.transaction(async (tx) => {
      await this.upsertFieldOverrideTx(tx, entityName, fieldName, data);
    });
  }

  async saveGroupOverride(entityName: string, groupKey: string, data: any) {
    this.assertKnownEntity(entityName);
    return await db.transaction(async (tx) => {
      await this.upsertGroupOverrideTx(tx, entityName, groupKey, data);
    });
  }

  async saveLayoutOverride(entityName: string, layoutKey: string, data: any) {
    this.assertKnownEntity(entityName);
    return await db.transaction(async (tx) => {
      await this.upsertLayoutOverrideTx(tx, entityName, layoutKey, data);
    });
  }
}
