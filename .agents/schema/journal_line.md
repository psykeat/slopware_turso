# Table: `journal_line`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| journal_line_id | journal_line_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| tenant_id | tenant_id | uuid | — | NOT NULL |  |
| company_id | company_id | uuid | — | NOT NULL |  |
| journal_entry_id | journal_entry_id | uuid | — | NOT NULL |  |
| gl_account_id | gl_account_id | uuid | — | NOT NULL |  |
| debit_amount | debit_amount | numeric | — | NOT NULL, DEFAULT 0 |  |
| credit_amount | credit_amount | numeric | — | NOT NULL, DEFAULT 0 |  |
| cost_center_id | cost_center_id | uuid | — |  |  |
| tax_code_id | tax_code_id | uuid | — |  |  |
| created_at | created_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |

> INDEX `idx_journal_line_account` (gl_account_id) [btree]
> INDEX `idx_journal_line_entry` (journal_entry_id) [btree]
> INDEX `idx_journal_line_tenant` (tenant_id) [btree]

> CHECK `chk_debit_or_credit`: [object Object]

