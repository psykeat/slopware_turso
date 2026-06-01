# Table: `email_message_label`

> _⚠ pending annotation_

| Column                 | Business Name          | Type                     | Class | Constraints                | Description |
| :--------------------- | :--------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| email_message_label_id | email_message_label_id | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id              | tenant_id              | uuid                     | —     | NOT NULL                   |             |
| email_message_id       | email_message_id       | uuid                     | —     | NOT NULL                   |             |
| email_label_id         | email_label_id         | uuid                     | —     | NOT NULL                   |             |
| created_at             | created_at             | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_email_message_label_label` (tenant_id, email_label_id) [btree]
