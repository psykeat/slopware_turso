# Table: `system_settings`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| setting_id | setting_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| scope | scope | text | — | NOT NULL |  |
| organization_id | organization_id | uuid | — |  |  |
| tenant_id | tenant_id | uuid | — |  |  |
| key | key | text | — | NOT NULL |  |
| value | value | jsonb | — | NOT NULL |  |
| created_at | created_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |
| updated_at | updated_at | timestamp with time zone | — |  |  |

