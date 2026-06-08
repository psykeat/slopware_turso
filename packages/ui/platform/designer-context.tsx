import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { useCommands } from "./command-registry";
import { type FocusContextState, useFocus } from "./focus-manager";

export interface FieldDesignConfig {
  key: string;
  visible: boolean;
  order: number;
  frameKey?: string | null;
  labelEnOverride?: string;
  labelDeOverride?: string;
  readonlyOverride?: boolean;
  requiredOverride?: boolean;
  labelStyle?: "normal" | "bold" | "italic";
  labelTone?: "default" | "muted" | "accent" | "danger";
  styleTokenBinding?: string | null;
  path?: string | null;
}

interface DesignerDelta {
  fieldConfigs: FieldDesignConfig[];
  activeDragId: string | null;
  hoverTargetId: string | null;
}

export type DesignerSurface =
  | "triview-detail"
  | "inspector-panel"
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

export interface DesignerVersionInfo {
  baseVersion: string | null;
  derivedFromVersion: string | null;
  overrideMode: "base" | "org" | "tenant" | "local";
  conflictState: DesignerConflictState;
  reconciliationRequired: boolean;
  supersededFieldRef: string | null;
  clientRevision: string;
}

export interface DesignerPlacement {
  mode: "flat" | "stack" | "grid" | "tabs";
  slot: string | null;
  index: number;
  parentId?: string | null;
}

export interface DesignerNode {
  id: string;
  kind: DesignerNodeKind;
  surface: DesignerSurface;
  entityName: string | null;
  parentId: string | null;
  children: string[];
  placement: DesignerPlacement;
  displayOrder: number;
  label: string;
  visible: boolean;
  readonly: boolean;
  required: boolean;
  width?: string;
  pin?: "left" | "right" | null;
  path?: string | null;
  labelStyle?: "normal" | "bold" | "italic";
  labelTone?: "default" | "muted" | "accent" | "danger";
  styleTokenBinding: string | null;
  ruleBinding: string | null;
  conflictState: DesignerConflictState;
  versionInfo: DesignerVersionInfo;
}

export interface DesignerPatchOp {
  op: "set" | "move" | "add" | "remove";
  nodeKey: string;
  path?: string;
  value?: unknown;
  parentKey?: string | null;
  index?: number;
  node?: DesignerNode;
}

export interface DesignerConflictRecord {
  id: string;
  nodeKey: string;
  surface: DesignerSurface;
  state: DesignerConflictState;
  message: string;
  reviewNote?: string;
  suggestedNodeKey?: string | null;
}

export interface DesignerHistoryEntry {
  id: string;
  at: string;
  action: "init" | "select" | "set" | "move" | "save" | "apply" | "reset" | "reconcile";
  surface: DesignerSurface;
  nodeKey?: string | null;
  summary: string;
  revision: string;
  patchOps: DesignerPatchOp[];
}

interface DesignerSurfaceState {
  surface: DesignerSurface;
  entityName: string | null;
  baselineNodes: DesignerNode[];
  nodes: DesignerNode[];
  selectedNodeIds: string[];
  draftPatchOps: DesignerPatchOp[];
  conflicts: DesignerConflictRecord[];
  history: DesignerHistoryEntry[];
  versionInfo: DesignerVersionInfo;
}

interface DesignerRuntimeState {
  activeSurface: DesignerSurface | null;
  surfaces: Partial<Record<DesignerSurface, DesignerSurfaceState>>;
}

interface DesignerContextValue {
  isDesignMode: boolean;
  toggleDesignMode: () => void;
  closeDesignMode: () => Promise<boolean>;
  activeSurface: DesignerSurface | null;
  activeSurfaceState: DesignerSurfaceState | null;
  selectedNodes: DesignerNode[];
  runtimeState: DesignerRuntimeState;
  designerDelta: DesignerDelta;
  delta: DesignerDelta;
  updateDelta: (update: Partial<DesignerDelta>) => void;
  resetDelta: () => void;
  updateField: (key: string, patch: Partial<FieldDesignConfig>) => void;
  updateFrameLabel: (key: string, label: string) => void;
  moveFrame: (key: string, targetKey: string) => void;
  moveField: (key: string, targetKey: string) => void;
  moveFieldToStart: (key: string, frameKey?: string | null) => void;
  moveFieldToEnd: (key: string, frameKey?: string | null) => void;
  moveFieldToFrame: (key: string, frameKey: string, targetKey?: string | null) => void;
  addFieldDraft: (
    label?: string,
    frameKey?: string | null,
    patch?: Partial<FieldDesignConfig>,
  ) => void;
  addFrameDraft: (label?: string) => void;
  removeFieldDraft: (key: string) => void;
  removeFrameDraft: (key: string) => void;
  initFields: (
    fields: {
      key: string;
      visible?: boolean;
      labelEn?: string;
      labelDe?: string;
      frameKey?: string | null;
    }[],
  ) => void;
  selectDesignerNodes: (
    surface: DesignerSurface,
    nodeIds: string[],
    entityName?: string | null,
  ) => void;
  setDesignerSurface: (surface: DesignerSurface, entityName?: string | null) => void;
  saveDesign: () => Promise<boolean>;
  applyDesign: () => Promise<boolean>;
  reconcileDesign: () => Promise<void>;
}

const defaultVersionInfo: DesignerVersionInfo = {
  baseVersion: null,
  derivedFromVersion: null,
  overrideMode: "local",
  conflictState: "clean",
  reconciliationRequired: false,
  supersededFieldRef: null,
  clientRevision: createClientRevision(),
};

const defaultSurfaceState = (
  surface: DesignerSurface,
  entityName: string | null,
): DesignerSurfaceState => ({
  surface,
  entityName,
  baselineNodes: [],
  nodes: [],
  selectedNodeIds: [],
  draftPatchOps: [],
  conflicts: [],
  history: [],
  versionInfo: { ...defaultVersionInfo, clientRevision: createClientRevision() },
});

const defaultRuntimeState: DesignerRuntimeState = {
  activeSurface: null,
  surfaces: {},
};

const defaultDelta: DesignerDelta = {
  fieldConfigs: [],
  activeDragId: null,
  hoverTargetId: null,
};

const DesignerContext = createContext<DesignerContextValue | undefined>(undefined);

function createClientRevision() {
  return crypto.randomUUID();
}

function nextHistoryId() {
  return `designer-history-${crypto.randomUUID()}`;
}

function nextRevision() {
  return createClientRevision();
}

function extractClientRevision(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as {
    clientRevision?: unknown;
    revision?: unknown;
    versionInfo?: { clientRevision?: unknown };
    updatedContract?: { versionInfo?: { clientRevision?: unknown } };
  };

  if (typeof record.clientRevision === "string") return record.clientRevision;
  if (typeof record.revision === "string") return record.revision;
  if (typeof record.versionInfo?.clientRevision === "string") {
    return record.versionInfo.clientRevision;
  }
  if (typeof record.updatedContract?.versionInfo?.clientRevision === "string") {
    return record.updatedContract.versionInfo.clientRevision;
  }

  return null;
}

function nextDraftId(kind: DesignerNodeKind) {
  return `draft:${kind}:${crypto.randomUUID()}`;
}

function humanizeFrameKey(frameKey: string) {
  const compact = frameKey
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim();
  if (!compact) return frameKey;
  return compact.charAt(0).toUpperCase() + compact.slice(1);
}

function inferSurfaceFromFocus(area: FocusContextState["area"]): DesignerSurface {
  switch (area) {
    case "panel":
      return "inspector-panel";
    case "form":
    case "lookup":
    case "dialog":
    case "designer":
    case "statistics":
    case "workspace":
    case null:
    default:
      return "triview-detail";
  }
}

function createSurfaceNode(
  surface: DesignerSurface,
  entityName: string | null,
  kind: DesignerNodeKind,
  key: string,
  label: string,
  index: number,
  overrides?: Partial<DesignerNode>,
): DesignerNode {
  const versionInfo = overrides?.versionInfo
    ? { ...defaultVersionInfo, ...overrides.versionInfo }
    : { ...defaultVersionInfo, clientRevision: createClientRevision() };
  return {
    id: key,
    kind,
    surface,
    entityName,
    parentId: overrides?.parentId ?? null,
    children: overrides?.children ?? [],
    placement: overrides?.placement ?? { mode: "flat", slot: null, index },
    displayOrder: overrides?.displayOrder ?? index,
    label,
    visible: overrides?.visible ?? true,
    readonly: overrides?.readonly ?? false,
    required: overrides?.required ?? false,
    width: overrides?.width,
    pin: overrides?.pin ?? null,
    path: overrides?.path ?? null,
    labelStyle: overrides?.labelStyle ?? "normal",
    labelTone: overrides?.labelTone ?? "default",
    styleTokenBinding: overrides?.styleTokenBinding ?? null,
    ruleBinding: overrides?.ruleBinding ?? null,
    conflictState: overrides?.conflictState ?? "clean",
    versionInfo,
  };
}

function createBaseVersionInfo(baseVersion: string): DesignerVersionInfo {
  return {
    ...defaultVersionInfo,
    clientRevision: createClientRevision(),
    baseVersion,
    derivedFromVersion: baseVersion,
    overrideMode: "base",
  };
}

function ensureSurfaceBucket(
  runtime: DesignerRuntimeState,
  surface: DesignerSurface,
  entityName?: string | null,
): DesignerSurfaceState {
  const existing = runtime.surfaces[surface];
  if (existing) {
    return entityName === undefined || entityName === existing.entityName
      ? existing
      : { ...existing, entityName };
  }
  return defaultSurfaceState(surface, entityName ?? null);
}

function sortByDisplayOrder(nodes: DesignerNode[]) {
  return [...nodes].sort((a, b) => a.displayOrder - b.displayOrder || a.id.localeCompare(b.id));
}

function normalizeTreeNodes(nodes: DesignerNode[]) {
  const cloned = nodes.map((node) => ({ ...node, children: [...node.children] }));
  const parentChildren = new Map<string | null, DesignerNode[]>();

  for (const node of cloned) {
    const parentKey = node.parentId ?? null;
    const bucket = parentChildren.get(parentKey);
    if (bucket) {
      bucket.push(node);
    } else {
      parentChildren.set(parentKey, [node]);
    }
  }

  for (const [parentId, siblings] of parentChildren) {
    sortByDisplayOrder(siblings).forEach((node, index) => {
      node.displayOrder = index;
      node.placement = { ...node.placement, index, parentId };
    });
  }

  for (const node of cloned) {
    node.children = sortByDisplayOrder(cloned.filter((child) => child.parentId === node.id)).map(
      (child) => child.id,
    );
  }

  return cloned.sort((a, b) => {
    const parentCompare = String(a.parentId ?? "").localeCompare(String(b.parentId ?? ""));
    if (parentCompare !== 0) return parentCompare;
    return a.displayOrder - b.displayOrder || a.id.localeCompare(b.id);
  });
}

function getFrameNodes(nodes: DesignerNode[]) {
  return sortByDisplayOrder(
    nodes.filter(
      (node) =>
        node.kind === "group-frame" ||
        (node.kind === "surface" && node.parentId === null && node.children.length > 0),
    ),
  );
}

function getPrimaryFrameId(nodes: DesignerNode[]) {
  return getFrameNodes(nodes)[0]?.id ?? null;
}

function mergeNodePatch(node: DesignerNode, patch: Partial<FieldDesignConfig>) {
  const nextVersionInfo = {
    ...node.versionInfo,
    clientRevision: nextRevision(),
  };
  const readonly = patch.readonlyOverride !== undefined ? patch.readonlyOverride : node.readonly;
  const required = patch.requiredOverride !== undefined ? patch.requiredOverride : node.required;
  return {
    ...node,
    visible: patch.visible ?? node.visible,
    readonly,
    required,
    // @ts-expect-error
    // eslint-disable-next-line
    width: patch.width ?? node.width,
    // @ts-expect-error
    // eslint-disable-next-line
    pin: patch.pin ?? node.pin ?? null,
    path: typeof patch.path === "string" ? patch.path : (node.path ?? null),
    parentId: typeof patch.frameKey === "string" ? patch.frameKey : node.parentId,
    labelStyle:
      patch.labelStyle === "bold" || patch.labelStyle === "italic" || patch.labelStyle === "normal"
        ? patch.labelStyle
        : (node.labelStyle ?? "normal"),
    labelTone:
      patch.labelTone === "muted" ||
      patch.labelTone === "accent" ||
      patch.labelTone === "danger" ||
      patch.labelTone === "default"
        ? patch.labelTone
        : (node.labelTone ?? "default"),
    styleTokenBinding:
      typeof patch.styleTokenBinding === "string"
        ? patch.styleTokenBinding
        : patch.styleTokenBinding === null
          ? null
          : node.styleTokenBinding,
    label:
      typeof patch.labelEnOverride === "string"
        ? patch.labelEnOverride
        : typeof patch.labelDeOverride === "string"
          ? patch.labelDeOverride
          : node.label,
    ruleBinding: node.ruleBinding,
    conflictState: node.conflictState,
    versionInfo: nextVersionInfo,
  } satisfies DesignerNode;
}

function removeNodeFromTree(nodes: DesignerNode[], key: string) {
  const target = nodes.find((node) => node.id === key);
  if (!target) return nodes;
  const descendants = new Set<string>([target.id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (descendants.has(node.id)) continue;
      if (node.parentId && descendants.has(node.parentId)) {
        descendants.add(node.id);
        changed = true;
      }
    }
  }
  return nodes.filter((node) => !descendants.has(node.id));
}

function surfaceToDelta(surfaceState: DesignerSurfaceState | null) {
  if (!surfaceState) return [];
  const nodes = sortByDisplayOrder(surfaceState.nodes).filter(
    (node) => node.kind !== "group-frame" && node.kind !== "surface",
  );
  return nodes.map<FieldDesignConfig>((node, order) => ({
    key: node.id,
    visible: node.visible,
    order,
    frameKey: node.parentId,
    labelEnOverride: node.label,
    labelDeOverride: undefined,
    readonlyOverride: node.readonly,
    requiredOverride: node.required,
    labelStyle: node.labelStyle,
    labelTone: node.labelTone,
    styleTokenBinding: node.styleTokenBinding,
    path: node.path ?? null,
  }));
}

function appendHistory(
  bucket: DesignerSurfaceState,
  entry: Omit<DesignerHistoryEntry, "id" | "at" | "revision" | "patchOps"> & {
    patchOps?: DesignerPatchOp[];
    revision?: string;
  },
): DesignerSurfaceState {
  const patchOps = entry.patchOps ?? bucket.draftPatchOps;
  return {
    ...bucket,
    history: [
      ...bucket.history,
      {
        id: nextHistoryId(),
        at: new Date().toISOString(),
        revision: entry.revision ?? bucket.versionInfo.clientRevision,
        patchOps,
        action: entry.action,
        surface: entry.surface,
        nodeKey: entry.nodeKey ?? null,
        summary: entry.summary,
      },
    ],
  };
}

function applyNodePatch(
  bucket: DesignerSurfaceState,
  key: string,
  patch: Partial<FieldDesignConfig>,
) {
  const nodeIndex = bucket.nodes.findIndex((node) => node.id === key);
  const existing = nodeIndex >= 0 ? bucket.nodes[nodeIndex] : null;
  const node =
    existing ??
    createSurfaceNode(
      bucket.surface,
      bucket.entityName,
      "field-ref",
      key,
      key,
      bucket.nodes.length,
      {
        versionInfo: createBaseVersionInfo(`schema:${bucket.entityName ?? "unknown"}:${key}`),
      },
    );
  const nextNode = mergeNodePatch(node, patch);
  const nextNodes =
    nodeIndex >= 0
      ? bucket.nodes.map((item, index) => (index === nodeIndex ? nextNode : item))
      : [...bucket.nodes, nextNode];
  const patchOps = Object.entries(patch).map<DesignerPatchOp>(([path, value]) => ({
    op: "set",
    nodeKey: key,
    path,
    value,
  }));
  const nextVersion = {
    ...bucket.versionInfo,
    clientRevision: nextRevision(),
  };
  const nextBucket = {
    ...bucket,
    nodes: normalizeTreeNodes(nextNodes),
    draftPatchOps: [...bucket.draftPatchOps, ...patchOps],
    versionInfo: nextVersion,
    conflicts: bucket.conflicts.map((conflict) =>
      conflict.nodeKey === key ? { ...conflict, state: nextNode.conflictState } : conflict,
    ),
  };
  return appendHistory(nextBucket, {
    action: "set",
    surface: bucket.surface,
    nodeKey: key,
    summary: `Updated ${key}`,
    patchOps,
    revision: nextVersion.clientRevision,
  });
}

function updateFrameLabelInBucket(bucket: DesignerSurfaceState, key: string, label: string) {
  const nodeIndex = bucket.nodes.findIndex((node) => node.id === key);
  const existing = nodeIndex >= 0 ? bucket.nodes[nodeIndex] : null;
  if (!existing || existing.kind !== "group-frame") {
    return bucket;
  }

  const nextNode = {
    ...existing,
    label,
    versionInfo: {
      ...existing.versionInfo,
      clientRevision: nextRevision(),
    },
  };
  const nextNodes = bucket.nodes.map((node, index) => (index === nodeIndex ? nextNode : node));
  const patchOp: DesignerPatchOp = {
    op: "set",
    nodeKey: key,
    path: "label",
    value: label,
  };
  const nextVersion = {
    ...bucket.versionInfo,
    clientRevision: nextRevision(),
  };
  const nextBucket = {
    ...bucket,
    nodes: normalizeTreeNodes(nextNodes),
    draftPatchOps: [...bucket.draftPatchOps, patchOp],
    versionInfo: nextVersion,
  };
  return appendHistory(nextBucket, {
    action: "set",
    surface: bucket.surface,
    nodeKey: key,
    summary: `Renamed ${key}`,
    patchOps: [patchOp],
    revision: nextVersion.clientRevision,
  });
}

function moveNodeInBucket(
  bucket: DesignerSurfaceState,
  key: string,
  targetKey: string,
  parentId?: string | null,
) {
  const nextNodes = bucket.nodes.map((node) => ({ ...node, children: [...node.children] }));
  const sourceIndex = nextNodes.findIndex((node) => node.id === key);
  const targetIndex = nextNodes.findIndex((node) => node.id === targetKey);
  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
    return bucket;
  }

  const moving = nextNodes[sourceIndex];
  const target = nextNodes[targetIndex];
  const targetParentId = parentId ?? target.parentId ?? null;
  const siblings = nextNodes
    .filter((node) => node.id !== key && (node.parentId ?? null) === targetParentId)
    .sort(
      (left, right) => left.displayOrder - right.displayOrder || left.id.localeCompare(right.id),
    );
  const targetSiblingIndex = siblings.findIndex((node) => node.id === targetKey);
  if (targetSiblingIndex === -1) {
    return bucket;
  }
  siblings.splice(targetSiblingIndex, 0, moving);

  siblings.forEach((node, index) => {
    node.parentId = targetParentId;
    node.displayOrder = index;
    node.placement = { ...node.placement, index, parentId: targetParentId };
  });

  const orderedIds = new Set(siblings.map((node) => node.id));
  const reorderedNodes = nextNodes.filter((node) => !orderedIds.has(node.id));
  reorderedNodes.push(...siblings);

  const patchOp: DesignerPatchOp = {
    op: "move",
    nodeKey: key,
    parentKey: targetParentId,
    index: targetSiblingIndex,
  };
  const nextVersion = {
    ...bucket.versionInfo,
    clientRevision: nextRevision(),
  };
  const parentNode = targetParentId
    ? (reorderedNodes.find((node) => node.id === targetParentId) ?? null)
    : null;
  if (parentNode) {
    parentNode.children = siblings.map((node) => node.id);
  }
  const nextBucket = {
    ...bucket,
    nodes: reorderedNodes,
    draftPatchOps: [...bucket.draftPatchOps, patchOp],
    versionInfo: nextVersion,
  };
  return appendHistory(nextBucket, {
    action: "move",
    surface: bucket.surface,
    nodeKey: key,
    summary: `Moved ${key} before ${targetKey}`,
    patchOps: [patchOp],
    revision: nextVersion.clientRevision,
  });
}

function moveNodeToBoundaryInBucket(
  bucket: DesignerSurfaceState,
  key: string,
  boundary: "first" | "last",
  parentId?: string | null,
) {
  const nextNodes = bucket.nodes.map((node) => ({ ...node, children: [...node.children] }));
  const sourceIndex = nextNodes.findIndex((node) => node.id === key);
  if (sourceIndex === -1) {
    return bucket;
  }

  const moving = nextNodes[sourceIndex];
  const targetParentId = parentId ?? moving.parentId ?? null;
  const siblings = nextNodes
    .filter((node) => node.id !== key && (node.parentId ?? null) === targetParentId)
    .sort(
      (left, right) => left.displayOrder - right.displayOrder || left.id.localeCompare(right.id),
    );
  if (boundary === "first") {
    siblings.unshift(moving);
  } else {
    siblings.push(moving);
  }

  siblings.forEach((node, index) => {
    node.parentId = targetParentId;
    node.displayOrder = index;
    node.placement = { ...node.placement, index, parentId: targetParentId };
  });

  const orderedIds = new Set(siblings.map((node) => node.id));
  const reorderedNodes = nextNodes.filter((node) => !orderedIds.has(node.id));
  reorderedNodes.push(...siblings);

  const patchOp: DesignerPatchOp = {
    op: "move",
    nodeKey: key,
    parentKey: targetParentId,
    index: boundary === "first" ? 0 : siblings.length - 1,
  };
  const nextVersion = {
    ...bucket.versionInfo,
    clientRevision: nextRevision(),
  };
  const parentNode = targetParentId
    ? (reorderedNodes.find((node) => node.id === targetParentId) ?? null)
    : null;
  if (parentNode) {
    parentNode.children = siblings.map((node) => node.id);
  }
  const nextBucket = {
    ...bucket,
    nodes: reorderedNodes,
    draftPatchOps: [...bucket.draftPatchOps, patchOp],
    versionInfo: nextVersion,
  };
  return appendHistory(nextBucket, {
    action: "move",
    surface: bucket.surface,
    nodeKey: key,
    summary: `Moved ${key} to ${boundary}`,
    patchOps: [patchOp],
    revision: nextVersion.clientRevision,
  });
}

function insertNodeInBucket(
  bucket: DesignerSurfaceState,
  node: DesignerNode,
  targetKey?: string | null,
) {
  const withoutExisting = bucket.nodes
    .filter((item) => item.id !== node.id)
    .map((item) => ({ ...item, children: [...item.children] }));
  const insertIndex =
    targetKey != null ? withoutExisting.findIndex((item) => item.id === targetKey) : -1;
  const nextNodes = [...withoutExisting];
  if (insertIndex >= 0) {
    const target = nextNodes[insertIndex];
    if (!node.parentId) {
      node.parentId = target.parentId;
    }
    nextNodes.splice(insertIndex + 1, 0, node);
  } else {
    nextNodes.push(node);
  }
  const nextVersion = {
    ...bucket.versionInfo,
    clientRevision: nextRevision(),
  };
  const patchOp: DesignerPatchOp = {
    op: "add",
    nodeKey: node.id,
    node,
    parentKey: node.parentId,
    index: node.displayOrder,
  };
  const nextBucket = {
    ...bucket,
    nodes: normalizeTreeNodes(nextNodes),
    selectedNodeIds: [node.id],
    draftPatchOps: [...bucket.draftPatchOps, patchOp],
    versionInfo: nextVersion,
  };
  return appendHistory(nextBucket, {
    action: "set",
    surface: bucket.surface,
    nodeKey: node.id,
    summary: `Added ${node.kind} ${node.id}`,
    patchOps: [patchOp],
    revision: nextVersion.clientRevision,
  });
}

function resetBucket(bucket: DesignerSurfaceState) {
  const nextBucket: DesignerSurfaceState = {
    ...bucket,
    nodes: bucket.baselineNodes.map((node) => ({ ...node })),
    selectedNodeIds: bucket.baselineNodes.length > 0 ? [bucket.baselineNodes[0].id] : [],
    draftPatchOps: [],
    conflicts: [],
    versionInfo: {
      ...bucket.versionInfo,
      conflictState: "clean",
      reconciliationRequired: false,
      clientRevision: nextRevision(),
    },
  };
  return appendHistory(nextBucket, {
    action: "reset",
    surface: bucket.surface,
    summary: "Reset local designer draft",
    patchOps: [],
    revision: nextBucket.versionInfo.clientRevision,
  });
}

function selectNodesInBucket(
  bucket: DesignerSurfaceState,
  nodeIds: string[],
  entityName?: string | null,
) {
  return appendHistory(
    {
      ...bucket,
      entityName: entityName ?? bucket.entityName,
      selectedNodeIds: nodeIds,
    },
    {
      action: "select",
      surface: bucket.surface,
      nodeKey: nodeIds[0] ?? null,
      summary: nodeIds.length > 0 ? `Selected ${nodeIds.join(", ")}` : "Cleared selection",
      patchOps: [],
    },
  );
}

function persistBucketAction(
  bucket: DesignerSurfaceState,
  action: "save" | "apply" | "reconcile",
  summary: string,
  mutate: (bucket: DesignerSurfaceState) => DesignerSurfaceState,
) {
  const nextBucket = mutate({
    ...bucket,
    versionInfo: {
      ...bucket.versionInfo,
      clientRevision: nextRevision(),
    },
  });
  return appendHistory(nextBucket, {
    action,
    surface: bucket.surface,
    summary,
    patchOps: nextBucket.draftPatchOps,
    revision: nextBucket.versionInfo.clientRevision,
  });
}

function buildLegacyDelta(runtime: DesignerRuntimeState): DesignerDelta {
  const detail = runtime.surfaces["triview-detail"] ?? null;
  return {
    fieldConfigs: surfaceToDelta(detail),
    activeDragId: defaultDelta.activeDragId,
    hoverTargetId: defaultDelta.hoverTargetId,
  };
}

function cloneDesignerNodes(nodes: DesignerNode[]) {
  return nodes.map((node) => ({
    ...node,
    children: [...node.children],
    placement: { ...node.placement },
    versionInfo: { ...node.versionInfo },
  }));
}

export function DesignerProvider({ children }: { children: React.ReactNode }) {
  const { state: focusState, setFocus, resetFocus } = useFocus();
  const { registerCommand } = useCommands();
  const [isDesignMode, setIsDesignMode] = useState(false);
  const [runtimeState, setRuntimeState] = useState<DesignerRuntimeState>(defaultRuntimeState);
  const [interactionState, setInteractionState] = useState<DesignerDelta>({
    ...defaultDelta,
  });
  const previousFocusRef = useRef<FocusContextState | null>(null);
  const wasDesignModeRef = useRef(false);
  const wasDesignerContextRef = useRef(false);
  const closeInProgressRef = useRef(false);

  const updateRuntime = useCallback(
    (updater: (state: DesignerRuntimeState) => DesignerRuntimeState) => {
      setRuntimeState((prev) => updater(prev));
    },
    [],
  );

  const selectDesignerNodes = useCallback(
    (surface: DesignerSurface, nodeIds: string[], entityName?: string | null) => {
      updateRuntime((prev) => {
        const bucket = ensureSurfaceBucket(prev, surface, entityName);
        const nextBucket = selectNodesInBucket(bucket, nodeIds, entityName);
        return {
          ...prev,
          activeSurface: surface,
          surfaces: { ...prev.surfaces, [surface]: nextBucket },
        };
      });
    },
    [updateRuntime],
  );

  const setDesignerSurface = useCallback(
    (surface: DesignerSurface, entityName?: string | null) => {
      updateRuntime((prev) => {
        const bucket = ensureSurfaceBucket(prev, surface, entityName);
        if (bucket === prev.surfaces[surface] && prev.activeSurface === surface) return prev;
        return {
          ...prev,
          activeSurface: surface,
          surfaces: { ...prev.surfaces, [surface]: bucket },
        };
      });
    },
    [updateRuntime],
  );

  const toggleDesignMode = useCallback(() => {
    setIsDesignMode((prev) => !prev);
  }, []);

  const isDesignerContext = useCallback(
    (area: FocusContextState["area"]) =>
      area === "form" || area === "designer" || area === "lookup" || area === "dialog",
    [],
  );

  const persistSurface = useCallback(
    async (
      surface: DesignerSurface,
      action: "patch" | "apply" = "apply",
      state: DesignerRuntimeState = runtimeState,
    ) => {
      const bucket = state.surfaces[surface];
      if (!bucket || bucket.draftPatchOps.length === 0) return true;

      const entityName = bucket.entityName ?? focusState.entity;
      if (!entityName) {
        throw new Error(`Missing entity for designer surface ${surface}`);
      }

      const url = action === "patch"
        ? `/api/metadata/designer/${entityName}/${surface}`
        : `/api/metadata/designer/${entityName}/${surface}/${action}`;
      const method = action === "patch" ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          baseVersion: bucket.versionInfo.baseVersion,
          derivedFromVersion: bucket.versionInfo.derivedFromVersion,
          surface: bucket.surface,
          ops: bucket.draftPatchOps,
          clientRevision: bucket.versionInfo.clientRevision,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} designer surface (${response.status})`);
      }

      let responseBody: unknown = null;
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        try {
          responseBody = await response.json();
        } catch {
          responseBody = null;
        }
      }

      const clientRevision = extractClientRevision(responseBody) ?? createClientRevision();

      updateRuntime((prev) => {
        const currentBucket = ensureSurfaceBucket(prev, surface, entityName);
        const committedNodes = cloneDesignerNodes(currentBucket.nodes);
        const nextBucket: DesignerSurfaceState = {
          ...currentBucket,
          baselineNodes:
            action === "apply" ? cloneDesignerNodes(committedNodes) : currentBucket.baselineNodes,
          nodes: committedNodes,
          draftPatchOps: [],
          versionInfo: {
            ...currentBucket.versionInfo,
            clientRevision,
          },
        };
        return {
          ...prev,
          activeSurface: surface,
          surfaces: { ...prev.surfaces, [surface]: nextBucket },
        };
      });

      return true;
    },
    [focusState.area, focusState.entity, runtimeState, updateRuntime],
  );

  const persistActiveSurface = useCallback(
    async (action: "patch" | "apply" = "apply") => {
      const surface = runtimeState.activeSurface ?? inferSurfaceFromFocus(focusState.area);
      if (!surface) return false;
      return persistSurface(surface, action);
    },
    [focusState.area, persistSurface, runtimeState.activeSurface],
  );

  const saveDesign = useCallback(async () => {
    try {
      const saved = await persistActiveSurface("patch");
      toast.success("Designer draft saved");
      return saved;
    } catch (error) {
      console.error("Failed to save designer surface:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save designer surface");
      return false;
    }
  }, [persistActiveSurface]);

  const applyDesign = useCallback(async () => {
    try {
      const applied = await persistActiveSurface("apply");
      toast.success("Designer applied");
      return applied;
    } catch (error) {
      console.error("Failed to apply designer surface:", error);
      toast.error(error instanceof Error ? error.message : "Failed to apply designer surface");
      return false;
    }
  }, [persistActiveSurface]);

  const reconcileDesign = useCallback(async () => {
    updateRuntime((prev) => {
      const surface = prev.activeSurface ?? inferSurfaceFromFocus(focusState.area);
      const bucket = ensureSurfaceBucket(prev, surface, focusState.entity);
      const nextBucket = persistBucketAction(
        bucket,
        "reconcile",
        `Reconciled ${surface}`,
        (current) => ({
          ...current,
          conflicts: current.conflicts.map((conflict) => ({ ...conflict, state: "clean" })),
          versionInfo: {
            ...current.versionInfo,
            conflictState: current.conflicts.length > 0 ? "needs_review" : "clean",
            reconciliationRequired: false,
          },
        }),
      );
      return {
        ...prev,
        activeSurface: surface,
        surfaces: { ...prev.surfaces, [surface]: nextBucket },
      };
    });
  }, [focusState.area, focusState.entity, updateRuntime]);

  const resetDelta = useCallback(() => {
    updateRuntime((prev) => {
      const nextSurfaces: Partial<Record<DesignerSurface, DesignerSurfaceState>> = {};
      (Object.entries(prev.surfaces) as [DesignerSurface, DesignerSurfaceState][]).forEach(
        ([surface, bucket]) => {
          nextSurfaces[surface] = resetBucket(bucket);
        },
      );
      return {
        ...prev,
        surfaces: nextSurfaces,
      };
    });
    setInteractionState({ ...defaultDelta });
  }, [updateRuntime]);

  const closeDesignMode = useCallback(async () => {
    if (!isDesignMode || closeInProgressRef.current) return false;
    closeInProgressRef.current = true;

    try {
      const dirtySurfaces = (Object.entries(runtimeState.surfaces) as [
        DesignerSurface,
        DesignerSurfaceState | undefined,
      ][]).filter(([, bucket]) => !!bucket && bucket.draftPatchOps.length > 0);

      if (dirtySurfaces.length > 0) {
        const targetSurface =
          runtimeState.activeSurface &&
          dirtySurfaces.some(([surface]) => surface === runtimeState.activeSurface)
            ? runtimeState.activeSurface
            : dirtySurfaces[0][0];
        const targetBucket = runtimeState.surfaces[targetSurface] ?? null;
        const entityName = targetBucket?.entityName ?? focusState.entity ?? null;
        if (entityName) {
          setFocus({
            area: "designer",
            entity: entityName,
            panel: targetSurface,
            recordId: focusState.recordId,
            mode: focusState.mode,
            field: focusState.field,
            row: focusState.row,
          });
        }

        for (const [surface] of dirtySurfaces) {
          await persistSurface(surface, "apply", runtimeState);
        }

        toast.success("Designer-Änderungen beim Verlassen übernommen");
      }

      setIsDesignMode(false);
      return true;
    } catch (error) {
      console.error("Failed to apply design on exit:", error);
      toast.error(error instanceof Error ? error.message : "Failed to apply design changes");
      return false;
    } finally {
      closeInProgressRef.current = false;
    }
  }, [
    focusState.entity,
    focusState.field,
    focusState.mode,
    focusState.recordId,
    focusState.row,
    isDesignMode,
    persistSurface,
    runtimeState,
    setFocus,
  ]);

  const updateField = useCallback(
    (key: string, patch: Partial<FieldDesignConfig>) => {
      updateRuntime((prev) => {
        const surface = "triview-detail";
        const bucket = ensureSurfaceBucket(prev, surface, focusState.entity);
        const nextBucket = applyNodePatch(bucket, key, patch);
        return {
          ...prev,
          activeSurface: surface,
          surfaces: { ...prev.surfaces, [surface]: nextBucket },
        };
      });
    },
    [focusState.entity, updateRuntime],
  );

  const updateFrameLabel = useCallback(
    (key: string, label: string) => {
      updateRuntime((prev) => {
        const surface = "triview-detail";
        const bucket = ensureSurfaceBucket(prev, surface, focusState.entity);
        return {
          ...prev,
          activeSurface: surface,
          surfaces: {
            ...prev.surfaces,
            [surface]: updateFrameLabelInBucket(bucket, key, label),
          },
        };
      });
    },
    [focusState.entity, updateRuntime],
  );

  const moveFrame = useCallback(
    (key: string, targetKey: string) => {
      updateRuntime((prev) => {
        const surface = "triview-detail";
        const bucket = ensureSurfaceBucket(prev, surface, focusState.entity);
        const nextBucket = moveNodeInBucket(bucket, key, targetKey, null);
        return {
          ...prev,
          activeSurface: surface,
          surfaces: { ...prev.surfaces, [surface]: nextBucket },
        };
      });
    },
    [focusState.entity, updateRuntime],
  );

  const moveField = useCallback(
    (key: string, targetKey: string) => {
      updateRuntime((prev) => {
        const surface = "triview-detail";
        const bucket = ensureSurfaceBucket(prev, surface, focusState.entity);
        const node = bucket.nodes.find((item) => item.id === key);
        const nextBucket = moveNodeInBucket(bucket, key, targetKey, node?.parentId ?? null);
        return {
          ...prev,
          activeSurface: surface,
          surfaces: { ...prev.surfaces, [surface]: nextBucket },
        };
      });
    },
    [focusState.entity, updateRuntime],
  );

  const moveFieldToStart = useCallback(
    (key: string, frameKey?: string | null) => {
      updateRuntime((prev) => {
        const surface = "triview-detail";
        const bucket = ensureSurfaceBucket(prev, surface, focusState.entity);
        return {
          ...prev,
          activeSurface: surface,
          surfaces: {
            ...prev.surfaces,
            [surface]: moveNodeToBoundaryInBucket(bucket, key, "first", frameKey),
          },
        };
      });
    },
    [focusState.entity, updateRuntime],
  );

  const moveFieldToEnd = useCallback(
    (key: string, frameKey?: string | null) => {
      updateRuntime((prev) => {
        const surface = "triview-detail";
        const bucket = ensureSurfaceBucket(prev, surface, focusState.entity);
        return {
          ...prev,
          activeSurface: surface,
          surfaces: {
            ...prev.surfaces,
            [surface]: moveNodeToBoundaryInBucket(bucket, key, "last", frameKey),
          },
        };
      });
    },
    [focusState.entity, updateRuntime],
  );

  const moveFieldToFrame = useCallback(
    (key: string, frameKey: string, targetKey?: string | null) => {
      updateRuntime((prev) => {
        const surface = "triview-detail";
        const bucket = ensureSurfaceBucket(prev, surface, focusState.entity);
        const nextNodes = bucket.nodes.map((node) => ({ ...node, children: [...node.children] }));
        const nodeIndex = nextNodes.findIndex((item) => item.id === key);
        if (nodeIndex === -1) return prev;
        const moving = nextNodes[nodeIndex];
        moving.parentId = frameKey;
        nextNodes.splice(nodeIndex, 1);
        const insertIndex =
          targetKey != null ? nextNodes.findIndex((item) => item.id === targetKey) : -1;
        if (insertIndex >= 0) {
          nextNodes.splice(insertIndex + 1, 0, moving);
        } else {
          nextNodes.push(moving);
        }
        const nextVersion = {
          ...bucket.versionInfo,
          clientRevision: nextRevision(),
        };
        const patchOp: DesignerPatchOp = {
          op: "move",
          nodeKey: key,
          parentKey: frameKey,
          index:
            insertIndex >= 0
              ? nextNodes.findIndex((item) => item.id === targetKey)
              : moving.displayOrder,
        };
        const nextBucket = {
          ...bucket,
          nodes: normalizeTreeNodes(nextNodes),
          draftPatchOps: [...bucket.draftPatchOps, patchOp],
          versionInfo: nextVersion,
        };
        return {
          ...prev,
          activeSurface: surface,
          surfaces: { ...prev.surfaces, [surface]: nextBucket },
        };
      });
    },
    [focusState.entity, updateRuntime],
  );

  const addFieldDraft = useCallback(
    (label?: string, frameKey?: string | null, patch?: Partial<FieldDesignConfig>) => {
      updateRuntime((prev) => {
        const surface = "triview-detail";
        const bucket = ensureSurfaceBucket(prev, surface, focusState.entity);
        const nodeId = nextDraftId("field-ref");
        let resolvedParentId = frameKey ?? getPrimaryFrameId(bucket.nodes);
        const nextNodes = bucket.nodes.map((node) => ({ ...node, children: [...node.children] }));
        if (!resolvedParentId) {
          const frameId = nextDraftId("group-frame");
          resolvedParentId = frameId;
          nextNodes.push(
            createSurfaceNode(
              surface,
              focusState.entity,
              "group-frame",
              frameId,
              "New frame",
              nextNodes.length,
              {
                visible: true,
                placement: { mode: "stack", slot: null, index: nextNodes.length },
                versionInfo: createBaseVersionInfo(
                  `layout:${focusState.entity ?? "draft"}:${frameId}`,
                ),
              },
            ),
          );
        }
        const node = createSurfaceNode(
          surface,
          focusState.entity,
          "field-ref",
          nodeId,
          label ?? "New field",
          nextNodes.length,
          {
            visible: true,
            parentId: resolvedParentId,
            placement: { mode: "stack", slot: "body", index: nextNodes.length },
            versionInfo: createBaseVersionInfo(`schema:${focusState.entity ?? "draft"}:${nodeId}`),
            styleTokenBinding: patch?.styleTokenBinding ?? null,
            path: patch?.path ?? null,
            labelStyle: patch?.labelStyle ?? "normal",
            labelTone: patch?.labelTone ?? "default",
          },
        );
        nextNodes.push(node);
        const nextVersion = {
          ...bucket.versionInfo,
          clientRevision: nextRevision(),
        };
        const patchOp: DesignerPatchOp = {
          op: "add",
          nodeKey: node.id,
          node,
          parentKey: node.parentId,
          index: node.displayOrder,
        };
        const nextBucket = {
          ...bucket,
          nodes: normalizeTreeNodes(nextNodes),
          selectedNodeIds: [node.id],
          draftPatchOps: [...bucket.draftPatchOps, patchOp],
          versionInfo: nextVersion,
        };
        return {
          ...prev,
          activeSurface: surface,
          surfaces: { ...prev.surfaces, [surface]: nextBucket },
        };
      });
    },
    [focusState.entity, updateRuntime],
  );

  const addFrameDraft = useCallback(
    (label?: string) => {
      updateRuntime((prev) => {
        const surface = "triview-detail";
        const bucket = ensureSurfaceBucket(prev, surface, focusState.entity);
        const nodeId = nextDraftId("group-frame");
        const node = createSurfaceNode(
          surface,
          focusState.entity,
          "group-frame",
          nodeId,
          label ?? "New frame",
          bucket.nodes.length,
          {
            visible: true,
            placement: { mode: "stack", slot: null, index: bucket.nodes.length },
            versionInfo: createBaseVersionInfo(`layout:${focusState.entity ?? "draft"}:${nodeId}`),
          },
        );
        const nextBucket = insertNodeInBucket(bucket, node);
        return {
          ...prev,
          activeSurface: surface,
          surfaces: { ...prev.surfaces, [surface]: nextBucket },
        };
      });
    },
    [focusState.entity, updateRuntime],
  );

  const removeFieldDraft = useCallback(
    (key: string) => {
      updateRuntime((prev) => {
        const surface = "triview-detail";
        const bucket = ensureSurfaceBucket(prev, surface, focusState.entity);
        const nextNodes = removeNodeFromTree(bucket.nodes, key);
        const nextVersion = {
          ...bucket.versionInfo,
          clientRevision: nextRevision(),
        };
        const patchOp: DesignerPatchOp = { op: "remove", nodeKey: key };
        const nextBucket = {
          ...bucket,
          nodes: normalizeTreeNodes(nextNodes),
          draftPatchOps: [...bucket.draftPatchOps, patchOp],
          versionInfo: nextVersion,
          selectedNodeIds: bucket.selectedNodeIds.filter((nodeId) => nodeId !== key),
        };
        return {
          ...prev,
          activeSurface: surface,
          surfaces: { ...prev.surfaces, [surface]: nextBucket },
        };
      });
    },
    [focusState.entity, updateRuntime],
  );

  const removeFrameDraft = useCallback(
    (key: string) => {
      updateRuntime((prev) => {
        const surface = "triview-detail";
        const bucket = ensureSurfaceBucket(prev, surface, focusState.entity);
        const frame = bucket.nodes.find((node) => node.id === key);
        if (!frame || frame.kind !== "group-frame") return prev;
        const fallbackFrameId =
          bucket.nodes.find((node) => node.kind === "group-frame" && node.id !== key)?.id ?? null;
        const nextNodes = bucket.nodes.map((node) => ({ ...node, children: [...node.children] }));
        let resolvedFallbackFrameId = fallbackFrameId;
        if (!resolvedFallbackFrameId) {
          resolvedFallbackFrameId = nextDraftId("group-frame");
          nextNodes.push(
            createSurfaceNode(
              surface,
              focusState.entity,
              "group-frame",
              resolvedFallbackFrameId,
              "New frame",
              nextNodes.length,
              {
                visible: true,
                placement: { mode: "stack", slot: null, index: nextNodes.length },
                versionInfo: createBaseVersionInfo(
                  `layout:${focusState.entity ?? "draft"}:${resolvedFallbackFrameId}`,
                ),
              },
            ),
          );
        }
        for (const node of nextNodes) {
          if (node.parentId === key) {
            node.parentId = resolvedFallbackFrameId;
          }
        }
        const withoutFrame = removeNodeFromTree(nextNodes, key);
        const nextVersion = {
          ...bucket.versionInfo,
          clientRevision: nextRevision(),
        };
        const patchOp: DesignerPatchOp = { op: "remove", nodeKey: key };
        const nextBucket = {
          ...bucket,
          nodes: normalizeTreeNodes(withoutFrame),
          draftPatchOps: [...bucket.draftPatchOps, patchOp],
          versionInfo: nextVersion,
          selectedNodeIds: bucket.selectedNodeIds.filter((nodeId) => nodeId !== key),
        };
        return {
          ...prev,
          activeSurface: surface,
          surfaces: { ...prev.surfaces, [surface]: nextBucket },
        };
      });
    },
    [focusState.entity, updateRuntime],
  );

  const initFields = useCallback(
    (
      fields: {
        key: string;
        visible?: boolean;
        labelEn?: string;
        labelDe?: string;
        frameKey?: string | null;
      }[],
    ) => {
      updateRuntime((prev) => {
        const surface = "triview-detail";
        const existing = ensureSurfaceBucket(prev, surface, focusState.entity);
        const existingKeys = new Set(
          existing.nodes
            .filter((node) => node.kind !== "group-frame" && node.kind !== "surface")
            .map((node) => node.id),
        );
        const incomingKeys = new Set(fields.map((field) => field.key));
        const sameSet =
          existingKeys.size === incomingKeys.size &&
          [...incomingKeys].every((key) => existingKeys.has(key));
        const existingFieldCount = existing.nodes.filter(
          (node) => node.kind !== "group-frame" && node.kind !== "surface",
        ).length;
        if (sameSet && existingFieldCount > 0) {
          return {
            ...prev,
            activeSurface: focusState.area === "form" ? surface : (prev.activeSurface ?? surface),
            surfaces: { ...prev.surfaces, [surface]: existing },
          };
        }

        const seedFields = fields.map((field) => ({
          ...field,
          frameKey:
            typeof field.frameKey === "string" && field.frameKey.trim().length > 0
              ? field.frameKey.trim()
              : null,
        }));
        const explicitFrameKeys = Array.from(
          new Set(
            seedFields
              .map((field) => field.frameKey)
              .filter((frameKey): frameKey is string => !!frameKey),
          ),
        );
        const hasExplicitFrames = explicitFrameKeys.length > 0;
        const primaryFrameId = hasExplicitFrames ? explicitFrameKeys[0] : nextDraftId("group-frame");
        const frameNodes = hasExplicitFrames
          ? explicitFrameKeys.map((frameKey, index) =>
              createSurfaceNode(
                surface,
                focusState.entity,
                "group-frame",
                frameKey,
                humanizeFrameKey(frameKey),
                index,
                {
                  visible: true,
                  placement: { mode: "stack", slot: null, index },
                  versionInfo: createBaseVersionInfo(
                    `layout:${focusState.entity ?? "unknown"}:${frameKey}`,
                  ),
                },
              ),
            )
          : [
              createSurfaceNode(
                surface,
                focusState.entity,
                "group-frame",
                primaryFrameId,
                "Main frame",
                0,
                {
                  visible: true,
                  placement: { mode: "stack", slot: null, index: 0 },
                  versionInfo: createBaseVersionInfo(
                    `layout:${focusState.entity ?? "unknown"}:${primaryFrameId}`,
                  ),
                },
              ),
            ];

        const nodes = [
          ...frameNodes,
          ...seedFields.map((field, index) =>
            createSurfaceNode(
              surface,
              focusState.entity,
              "field-ref",
              field.key,
              field.labelEn || field.labelDe || field.key,
              index,
              {
                visible: field.visible !== false,
                parentId: field.frameKey ?? primaryFrameId,
                placement: { mode: "stack", slot: "body", index },
                versionInfo: createBaseVersionInfo(
                  `schema:${focusState.entity ?? "unknown"}:${field.key}`,
                ),
              },
            ),
          ),
        ];

        const bucket = {
          ...defaultSurfaceState(surface, focusState.entity),
          baselineNodes: nodes.map((node) => ({ ...node, children: [...node.children] })),
          nodes: normalizeTreeNodes(nodes),
          selectedNodeIds: seedFields.length > 0 ? [seedFields[0].key] : [primaryFrameId],
          versionInfo: {
            ...defaultVersionInfo,
            clientRevision: createClientRevision(),
          },
        };
        return {
          ...prev,
          activeSurface: focusState.area === "form" ? surface : (prev.activeSurface ?? surface),
          surfaces: {
            ...prev.surfaces,
            [surface]: appendHistory(bucket, {
              action: "init",
              surface,
              summary: `Initialized ${seedFields.length} field(s) and ${frameNodes.length} frame(s)`,
              patchOps: [],
              revision: bucket.versionInfo.clientRevision,
            }),
          },
        };
      });
    },
    [focusState.area, focusState.entity, updateRuntime],
  );

  const updateDelta = useCallback(
    (update: Partial<DesignerDelta>) => {
      if (update.activeDragId !== undefined || update.hoverTargetId !== undefined) {
        setInteractionState((prev) => ({
          ...prev,
          ...(update.activeDragId !== undefined ? { activeDragId: update.activeDragId } : null),
          ...(update.hoverTargetId !== undefined ? { hoverTargetId: update.hoverTargetId } : null),
        }));
      }
      if (update.fieldConfigs) {
        update.fieldConfigs.forEach((field) => {
          updateField(field.key, {
            visible: field.visible,
            readonlyOverride: field.readonlyOverride,
            requiredOverride: field.requiredOverride,
            labelEnOverride: field.labelEnOverride,
            labelDeOverride: field.labelDeOverride,
            frameKey: field.frameKey ?? undefined,
            labelStyle: field.labelStyle,
            labelTone: field.labelTone,
            styleTokenBinding: field.styleTokenBinding ?? undefined,
            path: field.path ?? undefined,
          });
        });
      }
    },
    [updateField],
  );

  const activeSurfaceState = runtimeState.activeSurface
    ? (runtimeState.surfaces[runtimeState.activeSurface] ?? null)
    : null;
  const selectedNodes = useMemo(() => {
    if (!activeSurfaceState) return [];
    return activeSurfaceState.selectedNodeIds
      .map((nodeId) => activeSurfaceState.nodes.find((node) => node.id === nodeId))
      .filter((node): node is DesignerNode => node != null);
  }, [activeSurfaceState]);

  const designerDelta = useMemo(
    () => ({
      ...buildLegacyDelta(runtimeState),
      activeDragId: interactionState.activeDragId,
      hoverTargetId: interactionState.hoverTargetId,
    }),
    [interactionState.activeDragId, interactionState.hoverTargetId, runtimeState],
  );

  const syncDesignerFocus = useCallback(() => {
    if (!isDesignMode || !isDesignerContext(focusState.area)) return;
    const entityName = activeSurfaceState?.entityName ?? focusState.entity;
    const surface = activeSurfaceState?.surface ?? inferSurfaceFromFocus(focusState.area);
    setFocus({
      area: "designer",
      entity: entityName ?? null,
      panel: surface,
    });
  }, [
    activeSurfaceState?.entityName,
    activeSurfaceState?.surface,
    focusState.area,
    focusState.entity,
    isDesignMode,
    isDesignerContext,
    setFocus,
  ]);

  useEffect(() => {
    if (isDesignMode && !wasDesignModeRef.current) {
      previousFocusRef.current = focusState;
    }
    if (isDesignMode) {
      syncDesignerFocus();
    } else if (wasDesignModeRef.current) {
      const previous = previousFocusRef.current;
      previousFocusRef.current = null;
      if (previous) {
        setFocus(previous);
      } else {
        resetFocus();
      }
    }
    wasDesignModeRef.current = isDesignMode;
  }, [focusState, isDesignMode, resetFocus, setFocus, syncDesignerFocus]);

  useEffect(() => {
    const designerContext = isDesignerContext(focusState.area);

    if (isDesignMode && wasDesignerContextRef.current && !designerContext) {
      void closeDesignMode();
    }

    wasDesignerContextRef.current = designerContext;
  }, [closeDesignMode, focusState.area, isDesignMode, isDesignerContext]);

  useEffect(() => {
    if (!isDesignMode) return;
    syncDesignerFocus();
  }, [
    activeSurfaceState?.entityName,
    activeSurfaceState?.surface,
    isDesignMode,
    syncDesignerFocus,
  ]);

  useEffect(() => {
    const unregisterToggle = registerCommand({
      id: "designer.toggle",
      scope: "global",
      group: "workflow",
      label: { en: "Toggle Designer", de: "Designer umschalten" },
      shortcut: "Ctrl+Shift+F2",
      isEnabled: (state) => isDesignerContext(state.area),
      handler: () => toggleDesignMode(),
    });
    const unregisterClose = registerCommand({
      id: "designer.close",
      scope: "global",
      group: "workflow",
      label: { en: "Close Designer", de: "Designer schließen" },
      shortcut: "Escape",
      isEnabled: (state) => state.area === "designer" || isDesignMode,
      handler: async () => { closeDesignMode(); },
    });

    return () => {
      unregisterToggle();
      unregisterClose();
    };
  // eslint-disable-next-line
  }, [
    closeDesignMode,
    isDesignMode,
    registerCommand,
    toggleDesignMode,
  ]);

  const value = useMemo(
    () => ({
      isDesignMode,
      toggleDesignMode,
      closeDesignMode,
      activeSurface: runtimeState.activeSurface,
      activeSurfaceState,
      selectedNodes,
      runtimeState,
      designerDelta,
      delta: designerDelta,
      updateDelta,
      resetDelta,
      updateField,
      updateFrameLabel,
      moveFrame,
      moveField,
      moveFieldToStart,
      moveFieldToEnd,
      moveFieldToFrame,
      addFieldDraft,
      addFrameDraft,
      removeFieldDraft,
      removeFrameDraft,
      initFields,
      selectDesignerNodes,
      setDesignerSurface,
      saveDesign,
      applyDesign,
      reconcileDesign,
    }),
    [
      activeSurfaceState,
      saveDesign,
      applyDesign,
      closeDesignMode,
      designerDelta,
      initFields,
      isDesignMode,
      moveFrame,
      moveField,
      moveFieldToStart,
      moveFieldToEnd,
      moveFieldToFrame,
      addFieldDraft,
      addFrameDraft,
      removeFieldDraft,
      removeFrameDraft,
      reconcileDesign,
      resetDelta,
      runtimeState,
      selectDesignerNodes,
      selectedNodes,
      setDesignerSurface,
      toggleDesignMode,
      updateDelta,
      updateField,
      updateFrameLabel,
    ],
  );

  return <DesignerContext.Provider value={value}>{children}</DesignerContext.Provider>;
}

export function useDesigner() {
  const context = useContext(DesignerContext);
  if (!context) {
    throw new Error("useDesigner must be used within a DesignerProvider");
  }
  return context;
}
