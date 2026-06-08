# Table: `address_contact`

> _⚠ pending annotation_

| Column                  | Business Name           | Type                     | Class | Constraints                | Description |
| :---------------------- | :---------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| contact_id              | contact_id              | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id               | tenant_id               | uuid                     | —     | NOT NULL                   |             |
| address_id              | address_id              | uuid                     | —     |                            |             |
| first_name              | first_name              | text                     | —     |                            |             |
| last_name               | last_name               | text                     | —     | NOT NULL                   |             |
| display_name            | display_name            | text                     | —     |                            |             |
| notiztext               | notiztext               | text                     | —     |                            |             |
| notiztext_source_entity | notiztext_source_entity | text                     | —     |                            |             |
| notiztext_source_id     | notiztext_source_id     | uuid                     | —     |                            |             |
| notiztext_source_field  | notiztext_source_field  | text                     | —     |                            |             |
| notiztext_linked_at     | notiztext_linked_at     | timestamp with time zone | —     |                            |             |
| notiztext_overridden_at | notiztext_overridden_at | timestamp with time zone | —     |                            |             |
| email                   | email                   | text                     | —     |                            |             |
| phone_mobile            | phone_mobile            | text                     | —     |                            |             |
| phone_landline          | phone_landline          | text                     | —     |                            |             |
| role_function           | role_function           | text                     | —     |                            |             |
| is_primary              | is_primary              | boolean                  | —     | NOT NULL                   |             |
| archived                | archived                | boolean                  | —     | NOT NULL                   |             |
| created_at              | created_at              | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| updated_at              | updated_at              | timestamp with time zone | —     |                            |             |

> INDEX `idx_address_contact_address` (address_id) [btree]
> INDEX `idx_address_contact_tenant` (tenant_id) [btree]
