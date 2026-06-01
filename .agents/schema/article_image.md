# Table: `article_image`

> _⚠ pending annotation_

| Column           | Business Name    | Type                     | Class | Constraints                | Description |
| :--------------- | :--------------- | :----------------------- | :---- | :------------------------- | :---------- |
| article_image_id | article_image_id | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id        | tenant_id        | uuid                     | —     | NOT NULL                   |             |
| article_id       | article_id       | uuid                     | —     | NOT NULL                   |             |
| storage_key      | storage_key      | text                     | —     | NOT NULL                   |             |
| file_name        | file_name        | text                     | —     | NOT NULL                   |             |
| mime_type        | mime_type        | text                     | —     | NOT NULL                   |             |
| file_size        | file_size        | integer                  | —     | NOT NULL                   |             |
| width            | width            | integer                  | —     |                            |             |
| height           | height           | integer                  | —     |                            |             |
| alt_text         | alt_text         | text                     | —     |                            |             |
| sort_order       | sort_order       | integer                  | —     | NOT NULL                   |             |
| archived         | archived         | boolean                  | —     | NOT NULL                   |             |
| created_at       | created_at       | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_article_image_tenant_article` (tenant_id, article_id) [btree]
> INDEX `idx_article_image_tenant_archived` (tenant_id, archived) [btree]
