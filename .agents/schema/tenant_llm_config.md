# Table: `tenant_llm_config`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| tenant_llm_config_id | tenant_llm_config_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| tenant_id | tenant_id | uuid | — | NOT NULL |  |
| company_id | company_id | uuid | — | NOT NULL |  |
| provider | provider | text | — |  |  |
| endpoint_url | endpoint_url | text | — |  |  |
| model | model | text | — |  |  |
| api_key | api_key | text | — |  |  |
| github_token | github_token | text | — |  |  |
| github_repo | github_repo | text | — |  |  |
| vertex_credentials | vertex_credentials | text | — |  |  |
| vertex_project | vertex_project | text | — |  |  |
| vertex_location | vertex_location | text | — |  |  |
| is_active | is_active | boolean | — | NOT NULL, DEFAULT true |  |
| created_at | created_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |
| updated_at | updated_at | timestamp with time zone | — |  |  |

> INDEX `idx_tenant_llm_config_tenant` (tenant_id) [btree]

