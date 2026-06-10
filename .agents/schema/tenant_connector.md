# Table: `tenant_connector`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| tenant_connector_id | tenant_connector_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| tenant_id | tenant_id | uuid | — | NOT NULL |  |
| connector_id | connector_id | uuid | — | NOT NULL |  |
| credentials | credentials | jsonb | — | NOT NULL, DEFAULT [object Object] |  |
| is_active | is_active | boolean | — | NOT NULL, DEFAULT true |  |
| archived | archived | boolean | — | NOT NULL |  |
| created_at | created_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |
| updated_at | updated_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |

