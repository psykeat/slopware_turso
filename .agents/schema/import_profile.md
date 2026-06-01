# Table: `import_profile`

> _⚠ pending annotation_

| Column             | Business Name      | Type                     | Class | Constraints                | Description |
| :----------------- | :----------------- | :----------------------- | :---- | :------------------------- | :---------- |
| profile_id         | profile_id         | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id          | tenant_id          | uuid                     | —     | NOT NULL                   |             |
| slug               | slug               | text                     | —     | NOT NULL                   |             |
| label              | label              | text                     | —     | NOT NULL                   |             |
| target_entity      | target_entity      | text                     | —     | NOT NULL                   |             |
| target_command_key | target_command_key | text                     | —     | NOT NULL                   |             |
| requires_approval  | requires_approval  | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| archived           | archived           | boolean                  | —     | NOT NULL                   |             |
| created_at         | created_at         | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| updated_at         | updated_at         | timestamp with time zone | —     |                            |             |

> INDEX `idx_import_profile_tenant` (tenant_id) [btree]
