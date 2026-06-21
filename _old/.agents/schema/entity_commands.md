# Table: `entity_commands`

> _⚠ pending annotation_

| Column           | Business Name    | Type                     | Class | Constraints                       | Description |
| :--------------- | :--------------- | :----------------------- | :---- | :-------------------------------- | :---------- |
| command_id       | command_id       | uuid                     | PK    | NOT NULL, DEFAULT uuidv7()        |             |
| scope            | scope            | text                     | —     | NOT NULL, DEFAULT global          |             |
| organization_id  | organization_id  | uuid                     | —     |                                   |             |
| tenant_id        | tenant_id        | uuid                     | —     |                                   |             |
| entity_name      | entity_name      | text                     | —     | NOT NULL                          |             |
| command_key      | command_key      | text                     | —     | NOT NULL                          |             |
| handlerkey       | handlerkey       | text                     | —     |                                   |             |
| label            | label            | jsonb                    | —     | NOT NULL                          |             |
| description      | description      | jsonb                    | —     |                                   |             |
| http_method      | http_method      | text                     | —     | NOT NULL, DEFAULT POST            |             |
| route_pattern    | route_pattern    | text                     | —     | NOT NULL                          |             |
| entity_id_param  | entity_id_param  | text                     | —     |                                   |             |
| parent_entity    | parent_entity    | text                     | —     |                                   |             |
| parent_id_source | parent_id_source | text                     | —     |                                   |             |
| input_schema     | input_schema     | jsonb                    | —     | NOT NULL, DEFAULT [object Object] |             |
| server_managed   | server_managed   | jsonb                    | —     | NOT NULL, DEFAULT                 |             |
| ui_placement     | ui_placement     | text                     | —     |                                   |             |
| ui_icon          | ui_icon          | text                     | —     |                                   |             |
| ui_shortcut      | ui_shortcut      | text                     | —     |                                   |             |
| ui_confirm       | ui_confirm       | jsonb                    | —     |                                   |             |
| writes_tables    | writes_tables    | jsonb                    | —     | NOT NULL, DEFAULT                 |             |
| side_effects     | side_effects     | jsonb                    | —     | NOT NULL, DEFAULT                 |             |
| min_role         | min_role         | text                     | —     | NOT NULL, DEFAULT tenant_user     |             |
| visibility       | visibility       | text                     | —     | NOT NULL, DEFAULT tenant          |             |
| command_state    | command_state    | text                     | —     | NOT NULL, DEFAULT published       |             |
| sort_order       | sort_order       | integer                  | —     | NOT NULL                          |             |
| created_at       | created_at       | timestamp with time zone | —     | NOT NULL, DEFAULT now()           |             |

> INDEX `idx_entity_commands_entity` (entity_name, command_state) [btree]
> INDEX `idx_entity_commands_org` (organization_id) [btree]
> INDEX `idx_entity_commands_tenant` (tenant_id) [btree]
