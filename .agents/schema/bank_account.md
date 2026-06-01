# Table: `bank_account`

> _⚠ pending annotation_

| Column            | Business Name     | Type                     | Class | Constraints                | Description |
| :---------------- | :---------------- | :----------------------- | :---- | :------------------------- | :---------- |
| bank_account_id   | bank_account_id   | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id         | tenant_id         | uuid                     | —     | NOT NULL                   |             |
| address_id        | address_id        | uuid                     | —     |                            |             |
| iban              | iban              | text                     | —     | NOT NULL                   |             |
| bic               | bic               | text                     | —     |                            |             |
| bank_name         | bank_name         | text                     | —     |                            |             |
| currency_id       | currency_id       | char(3)                  | —     |                            |             |
| is_default        | is_default        | boolean                  | —     | NOT NULL                   |             |
| archived          | archived          | boolean                  | —     | NOT NULL                   |             |
| created_at        | created_at        | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| custom_attributes | custom_attributes | jsonb                    | —     |                            |             |

> INDEX `idx_bank_account_address` (address_id) [btree]
> INDEX `idx_bank_account_tenant` (tenant_id) [btree]
