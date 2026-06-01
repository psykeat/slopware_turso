# Table: `article`

> _⚠ pending annotation_

| Column                         | Business Name                  | Type                     | Class | Constraints                | Description |
| :----------------------------- | :----------------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| article_id                     | article_id                     | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id                      | tenant_id                      | uuid                     | —     | NOT NULL                   |             |
| article_no                     | article_no                     | text                     | —     | NOT NULL                   |             |
| name                           | name                           | text                     | —     | NOT NULL                   |             |
| notiztext                      | notiztext                      | text                     | —     |                            |             |
| langtext                       | langtext                       | text                     | —     |                            |             |
| kurzbeschreibung               | kurzbeschreibung               | text                     | —     |                            |             |
| warntext                       | warntext                       | text                     | —     |                            |             |
| notiztext_source_entity        | notiztext_source_entity        | text                     | —     |                            |             |
| notiztext_source_id            | notiztext_source_id            | uuid                     | —     |                            |             |
| notiztext_source_field         | notiztext_source_field         | text                     | —     |                            |             |
| notiztext_linked_at            | notiztext_linked_at            | timestamp with time zone | —     |                            |             |
| notiztext_overridden_at        | notiztext_overridden_at        | timestamp with time zone | —     |                            |             |
| langtext_source_entity         | langtext_source_entity         | text                     | —     |                            |             |
| langtext_source_id             | langtext_source_id             | uuid                     | —     |                            |             |
| langtext_source_field          | langtext_source_field          | text                     | —     |                            |             |
| langtext_linked_at             | langtext_linked_at             | timestamp with time zone | —     |                            |             |
| langtext_overridden_at         | langtext_overridden_at         | timestamp with time zone | —     |                            |             |
| kurzbeschreibung_source_entity | kurzbeschreibung_source_entity | text                     | —     |                            |             |
| kurzbeschreibung_source_id     | kurzbeschreibung_source_id     | uuid                     | —     |                            |             |
| kurzbeschreibung_source_field  | kurzbeschreibung_source_field  | text                     | —     |                            |             |
| kurzbeschreibung_linked_at     | kurzbeschreibung_linked_at     | timestamp with time zone | —     |                            |             |
| kurzbeschreibung_overridden_at | kurzbeschreibung_overridden_at | timestamp with time zone | —     |                            |             |
| warntext_source_entity         | warntext_source_entity         | text                     | —     |                            |             |
| warntext_source_id             | warntext_source_id             | uuid                     | —     |                            |             |
| warntext_source_field          | warntext_source_field          | text                     | —     |                            |             |
| warntext_linked_at             | warntext_linked_at             | timestamp with time zone | —     |                            |             |
| warntext_overridden_at         | warntext_overridden_at         | timestamp with time zone | —     |                            |             |
| description                    | description                    | text                     | —     |                            |             |
| article_group_id               | article_group_id               | uuid                     | —     |                            |             |
| tax_class_id                   | tax_class_id                   | uuid                     | —     |                            |             |
| base_unit_id                   | base_unit_id                   | uuid                     | —     |                            |             |
| sales_unit_id                  | sales_unit_id                  | uuid                     | —     |                            |             |
| purchase_unit_id               | purchase_unit_id               | uuid                     | —     |                            |             |
| archived_at                    | archived_at                    | timestamp with time zone | —     |                            |             |
| custom_attributes              | custom_attributes              | jsonb                    | —     |                            |             |
| created_at                     | created_at                     | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| updated_at                     | updated_at                     | timestamp with time zone | —     |                            |             |
| default_warehouse_id           | default_warehouse_id           | uuid                     | —     |                            |             |
| tracking_mode                  | tracking_mode                  | text                     | —     |                            |             |
| bom_type                       | bom_type                       | text                     | —     | NOT NULL, DEFAULT none     |             |
| print_position_texts           | print_position_texts           | boolean                  | —     |                            |             |
| primary_image_id               | primary_image_id               | uuid                     | —     |                            |             |

> INDEX `idx_article_default_wh` (tenant_id, default_warehouse_id) [btree]
> INDEX `idx_article_group_fk` (article_group_id) [btree]
> INDEX `idx_article_tenant` (tenant_id) [btree]
> INDEX `idx_article_tenant_archived` (tenant_id, archived_at) [btree]

> CHECK `article_bom_type_check`: [object Object]
> CHECK `article_tracking_mode_check`: [object Object]
