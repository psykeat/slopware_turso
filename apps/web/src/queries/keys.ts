// Query-key conventions for entity reads. The root ["data", entityName]
// predates the capability runtime (TriView grids already use it), so
// capability-based reads and legacy /api/data reads invalidate together
// during the migration. Never invent a second root for entity data.
export const entityKeys = {
  entity: (entityName: string) => ["data", entityName] as const,
  operation: (entityName: string, operation: string, input?: unknown) =>
    input === undefined
      ? (["data", entityName, operation] as const)
      : (["data", entityName, operation, input] as const),
};
