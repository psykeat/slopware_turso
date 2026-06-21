export const SQLITE_VARIABLE_LIMIT = 32766;
export const DRIZZLE_SQLITE_BULK_INSERT_MAX_ROWS = 2000;

export function recommendedSqliteBulkInsertRows(
  columnCount: number,
  variableLimit = SQLITE_VARIABLE_LIMIT,
) {
  if (!Number.isInteger(columnCount) || columnCount < 1) {
    throw new Error("columnCount must be a positive integer");
  }
  const byVariables = Math.floor(variableLimit / columnCount);
  return Math.max(1, Math.min(DRIZZLE_SQLITE_BULK_INSERT_MAX_ROWS, byVariables));
}

export function chunkRecords<T>(
  records: readonly T[],
  maxRows = DRIZZLE_SQLITE_BULK_INSERT_MAX_ROWS,
): T[][] {
  if (!Number.isInteger(maxRows) || maxRows < 1) {
    throw new Error("maxRows must be a positive integer");
  }

  const chunks: T[][] = [];
  for (let index = 0; index < records.length; index += maxRows) {
    chunks.push(records.slice(index, index + maxRows));
  }
  return chunks;
}

export function assertSqliteBulkInsertChunk(
  rowCount: number,
  columnCount: number,
  variableLimit = SQLITE_VARIABLE_LIMIT,
) {
  const maxRows = recommendedSqliteBulkInsertRows(columnCount, variableLimit);
  if (rowCount > maxRows) {
    throw new Error(
      `Bulk insert chunk has ${rowCount} rows but only ${maxRows} are safe for ${columnCount} columns`,
    );
  }
}
