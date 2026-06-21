# Table: `article_variant_option_value`

> _⚠ pending annotation_

| Column     | Business Name | Type | Class | Constraints | Description |
| :--------- | :------------ | :--- | :---- | :---------- | :---------- |
| tenant_id  | tenant_id     | uuid | —     | NOT NULL    |             |
| variant_id | variant_id    | uuid | —     | NOT NULL    |             |
| value_id   | value_id      | uuid | —     | NOT NULL    |             |

> INDEX `idx_variant_optval_tenant` (tenant_id) [btree]
> INDEX `idx_variant_optval_variant` (variant_id) [btree]
