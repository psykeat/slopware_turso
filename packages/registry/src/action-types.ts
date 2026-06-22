export interface EntityActionOperation {
  /** Full executable action key. During the bridge phase this matches the old capability key. */
  key: string;
  /** For id-addressed ops (get/update/archive/delete), the input key holding the record id. */
  idParam?: string;
  /** For list: true if FK filters go under `{ filters }`, false if they are flat fields. */
  filtersWrapped?: boolean;
}

export interface EntityActionEntry {
  /** The module that owns this entity's generic action surface. */
  module: string;
  /** Operation name -> executable action descriptor. */
  ops: Record<string, EntityActionOperation>;
}

export type EntityActionManifest = Record<string, EntityActionEntry>;

export class UnsupportedEntityOperationError extends Error {
  constructor(entityName: string, operation: string) {
    super(`Entity "${entityName}" has no usable "${operation}" action`);
    this.name = "UnsupportedEntityOperationError";
  }
}

export interface ResolvedEntityAction {
  key: string;
  input: Record<string, unknown>;
}

export interface EntityListOptions {
  search?: string;
  limit?: number;
  offset?: number;
  orderBy?: string;
  filterRules?: Array<{ col: string; op: string; val: string }>;
  /** Request the matching row count; the list action then returns `{ items, total }`. */
  withTotal?: boolean;
}
