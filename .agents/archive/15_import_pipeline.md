# Feature Slice 15 — Import Pipeline

## Design Contract

> Import is a source-agnostic, profile-driven ingest process that normalises arbitrary artefacts into
> rows via versioned field mappings, then fires them through controlled domain commands.

## Architecture Decisions

| #   | Decision                     | Resolution                                                            |
| --- | ---------------------------- | --------------------------------------------------------------------- |
| 1   | Source vs target abstraction | Split: `tenantConnector` (channel) ≠ `importProfile` (entity)         |
| 2   | Mapping location             | Intersection: `(tenantConnectorId, profileId)` → field rows           |
| 3   | Versioning purpose           | Replay integrity: `importBatch.mappingVersionId` → JSONB snapshot     |
| 4   | Approval bypass              | Profile-level: `importProfile.requiresApproval`                       |
| 5   | Mapping creation UX          | Admin-first: pre-configured before upload                             |
| 6   | Raw file storage             | Parse-on-upload, discard file; `importArtifact` deferred              |
| 7   | Navigation                   | Split: Settings (config) + `/import` (operations) + entity deep-links |

---

## Data Model

### New tables

#### `importProfile`

Tenant-scoped definition of a target entity import profile.

| Column               | Type             | Notes                     |
| -------------------- | ---------------- | ------------------------- |
| `profile_id`         | uuid PK          | uuidv7()                  |
| `tenant_id`          | uuid NOT NULL    | FK → tenant               |
| `slug`               | text NOT NULL    | unique per tenant         |
| `label`              | text NOT NULL    | display name              |
| `target_entity`      | text NOT NULL    | e.g. `article`, `address` |
| `target_command_key` | text NOT NULL    | e.g. `upsert`             |
| `requires_approval`  | boolean NOT NULL | default true              |
| `is_active`          | boolean NOT NULL | default true              |
| `archived`           | boolean NOT NULL | default false             |
| `created_at`         | timestamp        |                           |
| `updated_at`         | timestamp        |                           |

UNIQUE `(tenant_id, slug)`.

#### `importProfileMappingVersion`

Immutable JSONB snapshot of field mappings for a connector × profile pair. Created on "Activate".

| Column                | Type             | Notes                                           |
| --------------------- | ---------------- | ----------------------------------------------- |
| `version_id`          | uuid PK          | uuidv7()                                        |
| `tenant_id`           | uuid NOT NULL    | FK → tenant                                     |
| `tenant_connector_id` | uuid NOT NULL    | FK → tenantConnector                            |
| `profile_id`          | uuid NOT NULL    | FK → importProfile                              |
| `version_no`          | integer NOT NULL | auto-incremented per (connector, profile)       |
| `mappings`            | jsonb NOT NULL   | snapshot of all mapping rows at activation time |
| `is_active`           | boolean NOT NULL | only one active per (connector, profile)        |
| `activated_at`        | timestamp        | set when activated                              |
| `activated_by`        | text             | user id                                         |
| `created_at`          | timestamp        |                                                 |

UNIQUE `(tenant_connector_id, profile_id, version_no)`.

### Altered tables

#### `tenantConnectorMapping`

Add `profile_id` FK → importProfile.  
Update unique constraint to `(tenant_connector_id, profile_id, source_field)`.

#### `importBatch`

Add:

- `profile_id` uuid FK → importProfile
- `mapping_version_id` uuid FK → importProfileMappingVersion

---

## API Routes

### Settings (admin)

| Method | Path                                       | Description                               |
| ------ | ------------------------------------------ | ----------------------------------------- |
| GET    | `/api/import/profiles`                     | List profiles for tenant                  |
| POST   | `/api/import/profiles`                     | Create profile                            |
| PATCH  | `/api/import/profiles/$profileId`          | Update profile                            |
| GET    | `/api/import/profiles/$profileId/mappings` | Live mapping rows for connector×profile   |
| POST   | `/api/import/profiles/$profileId/mappings` | Save/replace live mapping rows            |
| POST   | `/api/import/profiles/$profileId/activate` | Snapshot → create new version, set active |
| GET    | `/api/import/connectors`                   | List tenant's active connectors           |

### Operations

| Method | Path                                   | Description                               |
| ------ | -------------------------------------- | ----------------------------------------- |
| POST   | `/api/import/upload`                   | Multipart CSV → parse → create batch+rows |
| GET    | `/api/import/batches`                  | List batches for tenant                   |
| GET    | `/api/import/batches/$batchId`         | Batch detail + rows                       |
| POST   | `/api/import/batches/$batchId/approve` | Set status → approved                     |
| POST   | `/api/import/batches/$batchId/post`    | Execute rows against target entity        |

### Upload request body (multipart/form-data)

```
file: File          (CSV)
profileId: string
tenantConnectorId: string
delimiter: string   (default ",")
```

### Upload response

```json
{ "batchId": "...", "rowCount": 42, "status": "pending" }
```

### Batch detail response

```json
{
  "batchId": "...",
  "status": "pending|validating|approved|posted|failed|rejected",
  "profileId": "...",
  "mappingVersionId": "...",
  "rowCount": 42,
  "rows": [
    { "rowId": "...", "status": "pending", "payload": {...}, "errorDetail": null }
  ]
}
```

---

## Service: `ImportService` (`packages/db/src/services/import-service.ts`)

```ts
class ImportService {
  constructor(
    private tenantId: string,
    private userId: string,
  ) {}

  // Profile CRUD
  listProfiles(): Promise<ImportProfile[]>;
  createProfile(data: CreateProfileInput): Promise<ImportProfile>;
  updateProfile(profileId: string, data: Partial<CreateProfileInput>): Promise<ImportProfile>;

  // Live mapping rows (draft, not versioned)
  getMappings(tenantConnectorId: string, profileId: string): Promise<MappingRow[]>;
  saveMappings(tenantConnectorId: string, profileId: string, rows: MappingRow[]): Promise<void>;

  // Activate: snapshot current mapping rows into a new version
  activateMapping(tenantConnectorId: string, profileId: string): Promise<MappingVersion>;

  // Upload + parse
  uploadCSV(
    file: File,
    profileId: string,
    tenantConnectorId: string,
    delimiter?: string,
  ): Promise<ImportBatch>;

  // Batch management
  listBatches(filters?: { profileId?: string; status?: string }): Promise<ImportBatch[]>;
  getBatch(batchId: string): Promise<BatchDetail>;
  approveBatch(batchId: string): Promise<void>;
  postBatch(batchId: string): Promise<{ posted: number; failed: number }>;
}
```

### CSV parse + map algorithm (uploadCSV)

1. Parse CSV rows using active mapping version for `(tenantConnectorId, profileId)`.
2. For each row: apply `transform` rules from mapping snapshot → produce `payload` object.
3. Bulk-insert rows into `importRow` with `status = 'pending'`.
4. Create `importBatch` with `mappingVersionId` pointing to the active version.
5. If `profile.requiresApproval = false` → immediately call `postBatch`.

### Post algorithm (postBatch)

- For `targetEntity = 'article'`: upsert into `article` table on `(tenantId, articleNo)`.
- For `targetEntity = 'address'`: upsert into `address` table on `(tenantId, addressNo)`.
- Row success → `status = 'posted'`, `postedAt = now()`.
- Row failure → `status = 'failed'`, `errorDetail = { message }`.
- Update `importBatch.postedEntityCount`, `processedAt`, final status.

---

## Frontend Routes

### Settings: `/app/settings` (existing, extend sidebar)

New section "Import" with two sub-pages:

- **Import Profiles** — DataGrid of profiles. Click → open profile form + connector mapping editor table.
- **Connectors** — existing `tenantConnector` list (read-only for now).

Mapping editor table columns: `sourceField | targetTable | targetColumn | transform | defaultValue | actions`.
"Activate" button → POST `/api/import/profiles/$profileId/activate` → toasts version number.

### Operations: `/app/import` (new top-level route)

Layout: left panel = profile filter + batch list, right panel = batch detail.

Batch list row: profile label, connector, row count, status badge, created time.
Batch detail: row table with payload preview + error detail. Approve / Post buttons (conditional on status + `requiresApproval`).

Upload button (top-right): opens modal → select profile → select connector → drop/pick CSV → upload.

---

## Navigation

Add "Import" entry to the AppBar nav after "Documents". Route: `/app/import`.
Settings sidebar: add "Import Profiles" group under existing helper tables.

---

## Slice 1 scope (what's deferred)

- `importArtifact` / raw file storage
- Email / AI connectors
- Mapping version diff UI
- Re-parse with different profile
- Per-row retry
