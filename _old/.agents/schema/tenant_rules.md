# Table: `tenant_rules`

> _⚠ pending annotation_

| Column          | Business Name   | Type                     | Class | Constraints                | Description |
| :-------------- | :-------------- | :----------------------- | :---- | :------------------------- | :---------- |
| rule_id         | rule_id         | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| scope           | scope           | text                     | —     | NOT NULL, DEFAULT tenant   |             |
| organization_id | organization_id | uuid                     | —     |                            |             |
| tenant_id       | tenant_id       | uuid                     | —     |                            |             |
| entity_name     | entity_name     | text                     | —     | NOT NULL                   |             |
| hook_name       | hook_name       | text                     | —     | NOT NULL                   |             |
| rule_state      | rule_state      | text                     | —     | NOT NULL, DEFAULT draft    |             |
| rule_definition | rule_definition | jsonb                    | —     | NOT NULL                   |             |
| created_at      | created_at      | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| rule_source     | rule_source     | text                     | —     |                            |             |
