# Table: `helper_table_registry`

> _⚠ pending annotation_

| Column           | Business Name    | Type                     | Class | Constraints                | Description |
| :--------------- | :--------------- | :----------------------- | :---- | :------------------------- | :---------- |
| id               | id               | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| table_name       | table_name       | text                     | —     | NOT NULL                   |             |
| label            | label            | jsonb                    | —     | NOT NULL                   |             |
| pk_column        | pk_column        | text                     | —     | NOT NULL                   |             |
| display_column   | display_column   | text                     | —     | NOT NULL                   |             |
| display_is_i18n  | display_is_i18n  | boolean                  | —     | NOT NULL                   |             |
| code_column      | code_column      | text                     | —     |                            |             |
| is_tenant_scoped | is_tenant_scoped | boolean                  | —     | NOT NULL                   |             |
| default_filter   | default_filter   | jsonb                    | —     |                            |             |
| sort_column      | sort_column      | text                     | —     | NOT NULL                   |             |
| created_at       | created_at       | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| value_column     | value_column     | text                     | —     |                            |             |
| group            | group            | text                     | —     |                            |             |
| category         | category         | text                     | —     |                            |             |
