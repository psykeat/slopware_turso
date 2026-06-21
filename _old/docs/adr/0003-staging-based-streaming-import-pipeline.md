# Staging-Based Streaming Import Pipeline

We need a resilient, multi-tenant ERP import pipeline capable of processing huge (multi-gigabyte) Büroware fixed-width files (`.SEDB` format defined by `Satzbeschreibung.csv`) without exhausting server memory or database lock limits.

We decided to build a **two-phase, staging-based streaming import pipeline** by evolving the existing database-backed import tables:

1. **Relational Mappings**: We replaced JSONB mapping schemas in `import_profile_mapping_version` with a child table `import_field_mapping`. This holds explicit columns for fixed-width options (`position`, `length`, `qualifier`, `formatting`) as well as CSV `source_field` mapping configurations.
2. **Asynchronous Execution & Streaming**: Uploaded files (including compressed `.zip` archives) are streamed directly to disk first. The import is executed asynchronously via a lightweight, database-backed polling worker that claims `import_batch` jobs using `SELECT ... FOR UPDATE SKIP LOCKED`.
3. **Phase 1 (Streaming Ingestion)**: The file is read line-by-line as a stream. Non-matching qualifiers are discarded immediately. Valid rows are mapped and bulk-inserted into `import_row` staging in chunks of 1,000 rows.
4. **Phase 2 (Resolution & Hybrid Upsert)**: Staging rows are validated and upserted into core tables in chunks of 1,000. Spaltenmappings compile to dynamic bulk-upserts: native columns are mapped to actual database columns, whereas tenant-defined custom fields are normalized and merged into the target table's `custom_attributes` JSONB column.
5. **Staging-Based Dry-Runs**: A dry-run executes Phase 1 normally, followed by Phase 2 in validation/simulation mode, setting `import_row` status to `valid`, `failed`, or `pending_references`. To commit, the user approves the batch; the worker executes Phase 2 in production mode directly on the existing `import_row` records, bypassing re-upload or re-parsing.
6. **Stateful Foreign Key Resolution**: Missing dependencies (e.g., a missing Warengruppe during article import) place the staging row in a `pending_references` status, recording the unresolved keys. A post-batch trigger automatically fires a reconciliation task (`reconcilePendingRows`) across other batches whenever new master data is posted and registered in `external_sync_mapping`.

## Considered Options

- **TanStack Workflow**: Rejected as a primary task-queue technology because a lightweight database-backed queue directly on `import_batch` keeps monitoring, state, and retries in the SQL domain with zero infrastructure overhead.
- **Transaction Rollback for Dry-Run**: Rejected because keeping a multi-gigabyte import transaction open for validation would cause severe table locks and server timeouts.
