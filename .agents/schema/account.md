# Table: `account`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| id | id | text | PK | NOT NULL |  |
| account_id | account_id | text | — | NOT NULL |  |
| provider_id | provider_id | text | — | NOT NULL |  |
| user_id | user_id | text | — | NOT NULL |  |
| access_token | access_token | text | — |  |  |
| refresh_token | refresh_token | text | — |  |  |
| id_token | id_token | text | — |  |  |
| access_token_expires_at | access_token_expires_at | timestamp with time zone | — |  |  |
| refresh_token_expires_at | refresh_token_expires_at | timestamp with time zone | — |  |  |
| scope | scope | text | — |  |  |
| password | password | text | — |  |  |
| created_at | created_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |
| updated_at | updated_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |

> INDEX `account_userId_idx` (user_id) [btree]

