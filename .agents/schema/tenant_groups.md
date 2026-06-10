# Table: `tenant_groups`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| group_id | group_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| scope | scope | text | — | NOT NULL, DEFAULT tenant |  |
| organization_id | organization_id | uuid | — |  |  |
| tenant_id | tenant_id | uuid | — |  |  |
| entity_name | entity_name | text | — | NOT NULL |  |
| group_key | group_key | text | — | NOT NULL |  |
| label | label | jsonb | — | NOT NULL |  |
| display_order | display_order | integer | — | NOT NULL |  |
| is_visible | is_visible | boolean | — | NOT NULL, DEFAULT true |  |
| custom_attributes | custom_attributes | jsonb | — |  |  |
| created_at | created_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |

> INDEX `uq_groups_global` (entity_name, group_key) [btree]
> INDEX `uq_groups_org` (organization_id, entity_name, group_key) [btree]
> INDEX `uq_groups_tenant` (tenant_id, entity_name, group_key) [btree]

