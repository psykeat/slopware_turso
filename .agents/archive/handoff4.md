# Handoff 4: Current Gaps After Live Code Review

This handoff replaces the older speculative version. It is based on cross-checking the current implementation against:

- `.agents/05_documents.md`
- `.agents/08_inventory_balance.md`
- `.agents/09_mis.md`
- `.agents/10_wandlung.md`
- `.agents/11_bom_production.md`
- `.agents/12_serial+batchprocessing.md`
- `.agents/00_core_architecture.md`
- `.agents/01_project_foundation.md`

## Executive Summary

The biggest remaining gaps are:

1. Conversion history and partial delivery support are still incomplete.
2. Transfer tracing for serial/batch data is still incomplete.
3. A few posting-related balance/fact paths are still missing.
4. Some settings metadata is present in schema/code but not fully exposed through seeded fields.
5. Statistics still has a couple of deferred slices.

## Confirmed Gaps

### Conversion and Document Chain

| Area | Status | Gap |
|---|---|---|
| `document_line_allocation` | Partial | Exists in migration, but is not wired into the live schema/service layer. |
| Partial conversion | Missing | `convertDocument()` still copies lines and archives the source document; it does not allocate remaining quantities or support repeated partial conversion. |
| Belegverlauf chain | Missing | `transactionId` is regenerated in conversion/storno instead of being propagated through the chain. |
| Conversion guards | Missing | Conversion does not yet block cancelled or archived source documents the way the wandlung spec requires. |

### Inventory Posting

| Area | Status | Gap |
|---|---|---|
| `l` posting | Partial | `onHandQty` is updated, but `expectedPurchaseQty` is not decremented. |
| `U` transfer tracing | Partial | Two movements are written, but serial/batch lineage is not preserved on transfer. |
| `q` posting facts | Partial | Inventory effects are present, but the production variance / fact bookkeeping is still missing. |
| `g` correction facts | Missing | The statistics checklist still marks correction facts as open. |

### Serial and Batch Tracking

| Area | Status | Gap |
|---|---|---|
| Inbound serial creation | Missing | Freitext inbound SN input still needs a service-side insert path for `serial_number`. |
| Group override support | Partial | `document_group.require_serial_tracking` / `require_batch_tracking` are in schema but not fully enforced in the UI flow. |
| Stock return on serial cancellation | Missing | Serial status rollback on storno/delete is not complete. |

### BOM and Derived Lines

| Area | Status | Gap |
|---|---|---|
| `bomGroupId` preservation | Partial | Conversion does not preserve BOM grouping metadata for derived lines. |
| Tracking row preservation | Partial | Conversion does not clone line tracking rows. |
| BOM print behavior | Deferred | PDF/template rendering still needs explicit K-line handling. |

### Settings Metadata

| Area | Status | Gap |
|---|---|---|
| `documentGroup.nextGroupId` | Partial | Present in schema, but not yet fully exposed through settings metadata. |
| `requireSerialTracking` / `requireBatchTracking` | Partial | Present in schema, but not fully seeded into the settings field registry. |
| Settings page shell | Implemented | The page exists; the remaining issue is metadata completeness, not the shell itself. |

### Statistics

| Area | Status | Gap |
|---|---|---|
| Article-group stats | Missing | `mv_sales_period_article_group` and its query path are still not implemented. |
| Period comparison route | Missing | `/app/statistics/period-comparison` is still deferred. |
| Event-driven refresh | Deferred | `pg_notify`-driven refresh remains optional/deferred in the MIS doc. |

## Priority Order

### P0

1. Wire `document_line_allocation` into the schema and `convertDocument()`.
2. Add partial conversion support so source documents can remain open until quantities are fully allocated.
3. Stop regenerating `transactionId` on conversion if the Belegverlauf chain is meant to be queryable.

### P1

4. Fix `l` posting to decrement `expectedPurchaseQty`.
5. Preserve serial/batch traceability across `U` transfers.
6. Add the missing production fact/variance path for `q`.

### P2

7. Seed and expose the remaining `documentGroup` settings fields.
8. Preserve BOM/tracking metadata through conversion.
9. Finish the remaining statistics slices.

## Stale Notes From the Old Handoff

These were present in the old file but are no longer reliable after checking live code:

- `L` does release `reservedQty` already.
- Settings is not a missing page skeleton anymore; the shell exists and is wired.
- The main current issue is metadata completeness and workflow correctness, not the existence of the route.

## References

- [08_inventory_balance.md](/home/ubuntu/slopware/.agents/08_inventory_balance.md)
- [09_mis.md](/home/ubuntu/slopware/.agents/09_mis.md)
- [10_wandlung.md](/home/ubuntu/slopware/.agents/10_wandlung.md)
- [11_bom_production.md](/home/ubuntu/slopware/.agents/11_bom_production.md)
- [12_serial+batchprocessing.md](/home/ubuntu/slopware/.agents/12_serial+batchprocessing.md)
- [05_documents.md](/home/ubuntu/slopware/.agents/05_documents.md)
