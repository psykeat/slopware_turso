# Table: `address_contact_identity`

> _⚠ pending annotation_

| Column            | Business Name     | Type                     | Class | Constraints                | Description |
| :---------------- | :---------------- | :----------------------- | :---- | :------------------------- | :---------- |
| identity_id       | identity_id       | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id         | tenant_id         | uuid                     | —     | NOT NULL                   |             |
| contact_id        | contact_id        | uuid                     | —     | NOT NULL                   |             |
| source_system     | source_system     | text                     | —     | NOT NULL                   |             |
| source_account_id | source_account_id | uuid                     | —     |                            |             |
| source_object_id  | source_object_id  | text                     | —     |                            |             |
| identity_type     | identity_type     | text                     | —     | NOT NULL                   |             |
| value             | value             | text                     | —     | NOT NULL                   |             |
| normalized_value  | normalized_value  | text                     | —     | NOT NULL                   |             |
| is_primary        | is_primary        | boolean                  | —     | NOT NULL                   |             |
| is_verified       | is_verified       | boolean                  | —     | NOT NULL                   |             |
| created_at        | created_at        | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| updated_at        | updated_at        | timestamp with time zone | —     |                            |             |

> INDEX `idx_address_contact_identity_tenant` (tenant_id) [btree]
> INDEX `idx_address_contact_identity_contact` (contact_id) [btree]
> INDEX `idx_address_contact_identity_value` (value) [btree]
> INDEX `idx_address_contact_identity_normalized` (normalized_value) [btree]
