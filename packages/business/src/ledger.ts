const identifierPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function assertSqlIdentifier(value: string) {
  if (!identifierPattern.test(value)) {
    throw new Error(`Unsafe SQL identifier "${value}"`);
  }
}

export function immutableLedgerTriggerSql(
  tableName = "posting_entry",
  triggerName = `lock_${tableName}`,
) {
  assertSqlIdentifier(tableName);
  assertSqlIdentifier(triggerName);

  return [
    `CREATE TRIGGER ${triggerName}`,
    `BEFORE UPDATE OR DELETE ON ${tableName}`,
    "BEGIN",
    "  SELECT RAISE(ABORT, 'Ledger entries are immutable');",
    "END;",
  ].join("\n");
}

export const POSTING_ENTRY_IMMUTABLE_TRIGGER_SQL = immutableLedgerTriggerSql();
