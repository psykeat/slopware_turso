# Table: `ai_tool_call`

> _⚠ pending annotation_

| Column       | Business Name | Type                     | Class | Constraints                | Description |
| :----------- | :------------ | :----------------------- | :---- | :------------------------- | :---------- |
| tool_call_id | tool_call_id  | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| turn_id      | turn_id       | uuid                     | —     | NOT NULL                   |             |
| tool_name    | tool_name     | text                     | —     | NOT NULL                   |             |
| input        | input         | jsonb                    | —     | NOT NULL                   |             |
| output       | output        | jsonb                    | —     |                            |             |
| status       | status        | ai_tool_call_status      | —     | NOT NULL                   |             |
| created_at   | created_at    | timestamp with time zone | —     | NOT NULL                   |             |

> INDEX `idx_ai_tool_call_turn` (turn_id) [btree]
> INDEX `idx_ai_tool_call_status` (status) [btree]
