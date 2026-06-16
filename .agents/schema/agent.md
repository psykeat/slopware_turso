# Table: `agent`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| agent_id | agent_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| tenant_id | tenant_id | uuid | — | NOT NULL |  |
| agent_no | agent_no | text | — | NOT NULL |  |
| name | name | text | — |  |  |
| address_id | address_id | uuid | — |  |  |
| user_id | user_id | text | — |  |  |
| commission_rate | commission_rate | numeric(5, 2) | — |  |  |
| active | active | boolean | — | NOT NULL, DEFAULT true |  |
| archived_at | archived_at | timestamp with time zone | — |  |  |
| custom_attributes | custom_attributes | jsonb | — |  |  |
| created_at | created_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |
| updated_at | updated_at | timestamp with time zone | — |  |  |

> INDEX `idx_agent_tenant` (tenant_id) [btree]
> INDEX `idx_agent_address` (address_id) [btree]
> INDEX `idx_agent_user` (user_id) [btree]

