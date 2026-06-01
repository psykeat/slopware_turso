# Table: `schema_annotations`

> _⚠ pending annotation_

| Column          | Business Name   | Type                     | Class | Constraints                | Description |
| :-------------- | :-------------- | :----------------------- | :---- | :------------------------- | :---------- |
| id              | id              | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| table_name      | table_name      | text                     | —     | NOT NULL                   |             |
| column_name     | column_name     | text                     | —     | NOT NULL                   |             |
| business_name   | business_name   | text                     | —     | NOT NULL                   |             |
| description     | description     | text                     | —     | NOT NULL                   |             |
| data_class      | data_class      | text                     | —     | NOT NULL                   |             |
| module_id       | module_id       | uuid                     | —     |                            |             |
| mandatory_for   | mandatory_for   | jsonb                    | —     | NOT NULL, DEFAULT          |             |
| locked_for      | locked_for      | jsonb                    | —     | NOT NULL, DEFAULT          |             |
| ai_generated_at | ai_generated_at | timestamp with time zone | —     |                            |             |
| human_override  | human_override  | boolean                  | —     | NOT NULL                   |             |
