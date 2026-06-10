# Table: `journal_entry`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| journal_entry_id | journal_entry_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| tenant_id | tenant_id | uuid | — | NOT NULL |  |
| company_id | company_id | uuid | — | NOT NULL |  |
| posting_date | posting_date | date | — | NOT NULL |  |
| source_document_id | source_document_id | uuid | — |  |  |
| description | description | text | — |  |  |
| created_at | created_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |

> INDEX `idx_journal_entry_company` (tenant_id, company_id) [btree]
> INDEX `idx_journal_entry_date` (tenant_id, posting_date) [btree]
> INDEX `idx_journal_entry_document` (source_document_id) [btree]
> INDEX `idx_journal_entry_tenant` (tenant_id) [btree]

