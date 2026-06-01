# Table: `price_list_item`

> _⚠ pending annotation_

| Column             | Business Name      | Type                     | Class | Constraints                | Description |
| :----------------- | :----------------- | :----------------------- | :---- | :------------------------- | :---------- |
| price_list_item_id | price_list_item_id | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id          | tenant_id          | uuid                     | —     | NOT NULL                   |             |
| price_list_id      | price_list_id      | uuid                     | —     | NOT NULL                   |             |
| article_id         | article_id         | uuid                     | —     | NOT NULL                   |             |
| price              | price              | numeric                  | —     | NOT NULL                   |             |
| valid_from         | valid_from         | date                     | —     |                            |             |
| valid_to           | valid_to           | date                     | —     |                            |             |
| created_at         | created_at         | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_price_list_item_lookup` (price_list_id, article_id, valid_from) [btree]
> INDEX `idx_price_list_item_tenant` (tenant_id) [btree]
