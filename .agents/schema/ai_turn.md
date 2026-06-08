# Table: `ai_turn`

> _⚠ pending annotation_

| Column     | Business Name | Type                     | Class | Constraints                | Description |
| :--------- | :------------ | :----------------------- | :---- | :------------------------- | :---------- |
| turn_id    | turn_id       | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| session_id | session_id    | uuid                     | —     | NOT NULL                   |             |
| role       | role          | text                     | —     | NOT NULL                   |             |
| message    | message       | text                     | —     | NOT NULL                   |             |
| created_at | created_at    | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_ai_turn_session` (session_id) [btree]
