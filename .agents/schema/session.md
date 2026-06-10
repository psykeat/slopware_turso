# Table: `session`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| id | id | text | PK | NOT NULL |  |
| expires_at | expires_at | timestamp with time zone | — | NOT NULL |  |
| token | token | text | — | NOT NULL |  |
| created_at | created_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |
| updated_at | updated_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |
| ip_address | ip_address | text | — |  |  |
| user_agent | user_agent | text | — |  |  |
| user_id | user_id | text | — | NOT NULL |  |

> INDEX `session_userId_idx` (user_id) [btree]

