# Table: `ai_prompt_version`

> _⚠ pending annotation_

| Column            | Business Name     | Type                     | Class | Constraints                | Description |
| :---------------- | :---------------- | :----------------------- | :---- | :------------------------- | :---------- |
| prompt_version_id | prompt_version_id | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id         | tenant_id         | uuid                     | —     |                            |             |
| system_prompt     | system_prompt     | text                     | —     | NOT NULL                   |             |
| input_schema      | input_schema      | jsonb                    | —     | NOT NULL                   |             |
| model_config      | model_config      | jsonb                    | —     | NOT NULL                   |             |
| archived          | archived          | boolean                  | —     | NOT NULL                   |             |
| created_at        | created_at        | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| updated_at        | updated_at        | timestamp with time zone | —     |                            |             |

> INDEX `idx_ai_prompt_version_tenant` (tenant_id) [btree]
