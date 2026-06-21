# Table: `email_job`

> _⚠ pending annotation_

| Column           | Business Name    | Type                     | Class | Constraints                       | Description |
| :--------------- | :--------------- | :----------------------- | :---- | :-------------------------------- | :---------- |
| email_job_id     | email_job_id     | uuid                     | PK    | NOT NULL, DEFAULT uuidv7()        |             |
| tenant_id        | tenant_id        | uuid                     | —     | NOT NULL                          |             |
| email_account_id | email_account_id | uuid                     | —     |                                   |             |
| job_type         | job_type         | text                     | —     | NOT NULL                          |             |
| idempotency_key  | idempotency_key  | text                     | —     | NOT NULL                          |             |
| payload          | payload          | jsonb                    | —     | NOT NULL, DEFAULT [object Object] |             |
| status           | status           | text                     | —     | NOT NULL, DEFAULT queued          |             |
| priority         | priority         | integer                  | —     | NOT NULL, DEFAULT 2               |             |
| attempts         | attempts         | integer                  | —     | NOT NULL                          |             |
| max_attempts     | max_attempts     | integer                  | —     | NOT NULL, DEFAULT 5               |             |
| run_after        | run_after        | timestamp with time zone | —     | NOT NULL, DEFAULT now()           |             |
| locked_at        | locked_at        | timestamp with time zone | —     |                                   |             |
| locked_by        | locked_by        | text                     | —     |                                   |             |
| last_error       | last_error       | text                     | —     |                                   |             |
| created_at       | created_at       | timestamp with time zone | —     | NOT NULL, DEFAULT now()           |             |
| updated_at       | updated_at       | timestamp with time zone | —     |                                   |             |

> INDEX `idx_email_job_queue_claim` (tenant_id, status, priority, run_after, created_at) [btree]
> INDEX `idx_email_job_account` (tenant_id, email_account_id) [btree]
> INDEX `idx_email_job_stale` (locked_at) [btree]

> CHECK `chk_email_job_type`: [object Object]
> CHECK `chk_email_job_status`: [object Object]
> CHECK `chk_email_job_priority`: [object Object]
