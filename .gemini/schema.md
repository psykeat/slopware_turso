# Slopware — Live Schema

> Generated: 2026-06-01 16:56:45 UTC
> Tables: 96

## Module: uncategorized

### `account`

> _⚠ pending annotation_

| Column                   | Business Name            | Type                     | Class | Constraints             | Description |
| :----------------------- | :----------------------- | :----------------------- | :---- | :---------------------- | :---------- |
| id                       | id                       | text                     | PK    | NOT NULL                |             |
| account_id               | account_id               | text                     | —     | NOT NULL                |             |
| provider_id              | provider_id              | text                     | —     | NOT NULL                |             |
| user_id                  | user_id                  | text                     | —     | NOT NULL                |             |
| access_token             | access_token             | text                     | —     |                         |             |
| refresh_token            | refresh_token            | text                     | —     |                         |             |
| id_token                 | id_token                 | text                     | —     |                         |             |
| access_token_expires_at  | access_token_expires_at  | timestamp with time zone | —     |                         |             |
| refresh_token_expires_at | refresh_token_expires_at | timestamp with time zone | —     |                         |             |
| scope                    | scope                    | text                     | —     |                         |             |
| password                 | password                 | text                     | —     |                         |             |
| created_at               | created_at               | timestamp with time zone | —     | NOT NULL, DEFAULT now() |             |
| updated_at               | updated_at               | timestamp with time zone | —     | NOT NULL, DEFAULT now() |             |

> INDEX `account_userId_idx` (user_id) [btree]

### `account_determination_rule`

> _⚠ pending annotation_

| Column           | Business Name    | Type                     | Class | Constraints                | Description |
| :--------------- | :--------------- | :----------------------- | :---- | :------------------------- | :---------- |
| rule_id          | rule_id          | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id        | tenant_id        | uuid                     | —     | NOT NULL                   |             |
| company_id       | company_id       | uuid                     | —     |                            |             |
| article_group_id | article_group_id | uuid                     | —     |                            |             |
| tax_code_id      | tax_code_id      | uuid                     | —     |                            |             |
| posting_context  | posting_context  | text                     | —     | NOT NULL                   |             |
| gl_account_id    | gl_account_id    | uuid                     | —     |                            |             |
| created_at       | created_at       | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_acct_det_lookup` (tenant_id, posting_context, article_group_id, tax_code_id) [btree]
> INDEX `idx_acct_det_tenant` (tenant_id) [btree]

### `accounting_export_batch`

> _⚠ pending annotation_

| Column           | Business Name    | Type                     | Class | Constraints                | Description |
| :--------------- | :--------------- | :----------------------- | :---- | :------------------------- | :---------- |
| batch_id         | batch_id         | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id        | tenant_id        | uuid                     | —     | NOT NULL                   |             |
| company_id       | company_id       | uuid                     | —     | NOT NULL                   |             |
| fiscal_period_id | fiscal_period_id | uuid                     | —     | NOT NULL                   |             |
| status           | status           | text                     | —     | NOT NULL, DEFAULT pending  |             |
| row_count        | row_count        | integer                  | —     | NOT NULL                   |             |
| created_at       | created_at       | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| exported_at      | exported_at      | timestamp with time zone | —     |                            |             |
| created_by       | created_by       | uuid                     | —     |                            |             |

> INDEX `idx_accounting_export_batch_tenant` (tenant_id) [btree]
> INDEX `idx_accounting_export_batch_period` (tenant_id, fiscal_period_id) [btree]

> CHECK `chk_accounting_export_batch_status`: [object Object]

### `accounting_export_row`

> _⚠ pending annotation_

| Column             | Business Name      | Type                     | Class | Constraints                | Description |
| :----------------- | :----------------- | :----------------------- | :---- | :------------------------- | :---------- |
| row_id             | row_id             | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| batch_id           | batch_id           | uuid                     | —     | NOT NULL                   |             |
| tenant_id          | tenant_id          | uuid                     | —     | NOT NULL                   |             |
| company_id         | company_id         | uuid                     | —     | NOT NULL                   |             |
| posting_date       | posting_date       | date                     | —     | NOT NULL                   |             |
| gl_account_id      | gl_account_id      | uuid                     | —     | NOT NULL                   |             |
| cost_center_id     | cost_center_id     | uuid                     | —     |                            |             |
| tax_code_id        | tax_code_id        | uuid                     | —     |                            |             |
| debit_amount       | debit_amount       | numeric                  | —     | NOT NULL, DEFAULT 0        |             |
| credit_amount      | credit_amount      | numeric                  | —     | NOT NULL, DEFAULT 0        |             |
| currency_id        | currency_id        | char(3)                  | —     |                            |             |
| source_document_id | source_document_id | uuid                     | —     |                            |             |
| source_document_no | source_document_no | text                     | —     |                            |             |
| created_at         | created_at         | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_accounting_export_row_batch` (batch_id) [btree]
> INDEX `idx_accounting_export_row_tenant` (tenant_id) [btree]

### `address`

> _⚠ pending annotation_

| Column                      | Business Name               | Type                     | Class | Constraints                | Description |
| :-------------------------- | :-------------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| address_id                  | address_id                  | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id                   | tenant_id                   | uuid                     | —     | NOT NULL                   |             |
| address_no                  | address_no                  | text                     | —     | NOT NULL                   |             |
| is_customer                 | is_customer                 | boolean                  | —     | NOT NULL                   |             |
| is_supplier                 | is_supplier                 | boolean                  | —     | NOT NULL                   |             |
| company_name                | company_name                | text                     | —     |                            |             |
| first_name                  | first_name                  | text                     | —     |                            |             |
| last_name                   | last_name                   | text                     | —     |                            |             |
| notiztext                   | notiztext                   | text                     | —     |                            |             |
| notiztext_source_entity     | notiztext_source_entity     | text                     | —     |                            |             |
| notiztext_source_id         | notiztext_source_id         | uuid                     | —     |                            |             |
| notiztext_source_field      | notiztext_source_field      | text                     | —     |                            |             |
| notiztext_linked_at         | notiztext_linked_at         | timestamp with time zone | —     |                            |             |
| notiztext_overridden_at     | notiztext_overridden_at     | timestamp with time zone | —     |                            |             |
| langtext                    | langtext                    | text                     | —     |                            |             |
| langtext_source_entity      | langtext_source_entity      | text                     | —     |                            |             |
| langtext_source_id          | langtext_source_id          | uuid                     | —     |                            |             |
| langtext_source_field       | langtext_source_field       | text                     | —     |                            |             |
| langtext_linked_at          | langtext_linked_at          | timestamp with time zone | —     |                            |             |
| langtext_overridden_at      | langtext_overridden_at      | timestamp with time zone | —     |                            |             |
| warntext                    | warntext                    | text                     | —     |                            |             |
| warntext_source_entity      | warntext_source_entity      | text                     | —     |                            |             |
| warntext_source_id          | warntext_source_id          | uuid                     | —     |                            |             |
| warntext_source_field       | warntext_source_field       | text                     | —     |                            |             |
| warntext_linked_at          | warntext_linked_at          | timestamp with time zone | —     |                            |             |
| warntext_overridden_at      | warntext_overridden_at      | timestamp with time zone | —     |                            |             |
| address_line_1              | address_line_1              | text                     | —     | NOT NULL                   |             |
| address_line_2              | address_line_2              | text                     | —     |                            |             |
| postal_code                 | postal_code                 | text                     | —     | NOT NULL                   |             |
| city                        | city                        | text                     | —     | NOT NULL                   |             |
| state_province              | state_province              | text                     | —     |                            |             |
| country_code                | country_code                | char(2)                  | —     | NOT NULL                   |             |
| vat_id                      | vat_id                      | text                     | —     |                            |             |
| tax_class_id                | tax_class_id                | uuid                     | —     |                            |             |
| currency_id                 | currency_id                 | char(3)                  | —     |                            |             |
| payment_term_id             | payment_term_id             | uuid                     | —     |                            |             |
| archived_at                 | archived_at                 | timestamp with time zone | —     |                            |             |
| custom_attributes           | custom_attributes           | jsonb                    | —     |                            |             |
| created_at                  | created_at                  | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| updated_at                  | updated_at                  | timestamp with time zone | —     |                            |             |
| default_delivery_address_id | default_delivery_address_id | uuid                     | —     |                            |             |
| search_text                 | search_text                 | text                     | —     |                            |             |
| address_category_id         | address_category_id         | uuid                     | —     |                            |             |

> INDEX `idx_address_category` (tenant_id, address_category_id) [btree]
> INDEX `idx_address_customer` (tenant_id, is_customer) [btree]
> INDEX `idx_address_supplier` (tenant_id, is_supplier) [btree]
> INDEX `idx_address_tenant` (tenant_id) [btree]

### `address_category`

> _⚠ pending annotation_

| Column            | Business Name     | Type                     | Class | Constraints                | Description |
| :---------------- | :---------------- | :----------------------- | :---- | :------------------------- | :---------- |
| category_id       | category_id       | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id         | tenant_id         | uuid                     | —     | NOT NULL                   |             |
| name              | name              | jsonb                    | —     | NOT NULL                   |             |
| tax_class_id      | tax_class_id      | uuid                     | —     |                            |             |
| payment_term_id   | payment_term_id   | uuid                     | —     |                            |             |
| currency_id       | currency_id       | char(3)                  | —     |                            |             |
| archived          | archived          | boolean                  | —     | NOT NULL                   |             |
| created_at        | created_at        | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| custom_attributes | custom_attributes | jsonb                    | —     |                            |             |

> INDEX `idx_address_category_tenant` (tenant_id) [btree]

### `address_contact`

> _⚠ pending annotation_

| Column                  | Business Name           | Type                     | Class | Constraints                | Description |
| :---------------------- | :---------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| contact_id              | contact_id              | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id               | tenant_id               | uuid                     | —     | NOT NULL                   |             |
| address_id              | address_id              | uuid                     | —     | NOT NULL                   |             |
| first_name              | first_name              | text                     | —     |                            |             |
| last_name               | last_name               | text                     | —     | NOT NULL                   |             |
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

> INDEX `idx_address_contact_address` (address_id) [btree]
> INDEX `idx_address_contact_tenant` (tenant_id) [btree]

### `address_seq`

> _⚠ pending annotation_

| Column    | Business Name | Type    | Class | Constraints         | Description |
| :-------- | :------------ | :------ | :---- | :------------------ | :---------- |
| tenant_id | tenant_id     | uuid    | PK    | NOT NULL            |             |
| next_val  | next_val      | integer | —     | NOT NULL, DEFAULT 1 |             |

> INDEX `idx_address_seq_tenant` (tenant_id) [btree]

### `ai_apply_attempt`

> _⚠ pending annotation_

| Column              | Business Name       | Type                     | Class | Constraints                | Description |
| :------------------ | :------------------ | :----------------------- | :---- | :------------------------- | :---------- |
| attempt_id          | attempt_id          | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id           | tenant_id           | uuid                     | —     | NOT NULL                   |             |
| plan_id             | plan_id             | uuid                     | —     | NOT NULL                   |             |
| applied_plan_json   | applied_plan_json   | jsonb                    | —     | NOT NULL                   |             |
| status              | status              | text                     | —     | NOT NULL                   |             |
| executed_by_user_id | executed_by_user_id | text                     | —     | NOT NULL                   |             |
| error_logs          | error_logs          | text                     | —     |                            |             |
| applied_at          | applied_at          | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| created_at          | created_at          | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| updated_at          | updated_at          | timestamp with time zone | —     |                            |             |

> INDEX `idx_ai_apply_attempt_tenant` (tenant_id) [btree]
> INDEX `idx_ai_apply_attempt_plan` (plan_id) [btree]
> INDEX `idx_ai_apply_attempt_executor` (executed_by_user_id) [btree]
> INDEX `idx_ai_apply_attempt_status` (status) [btree]

### `ai_evidence`

> _⚠ pending annotation_

| Column           | Business Name    | Type                     | Class | Constraints                | Description |
| :--------------- | :--------------- | :----------------------- | :---- | :------------------------- | :---------- |
| evidence_id      | evidence_id      | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id        | tenant_id        | uuid                     | —     | NOT NULL                   |             |
| plan_id          | plan_id          | uuid                     | —     | NOT NULL                   |             |
| field_name       | field_name       | text                     | —     | NOT NULL                   |             |
| source_text      | source_text      | text                     | —     | NOT NULL                   |             |
| match_confidence | match_confidence | numeric                  | —     | NOT NULL                   |             |
| ambiguity_note   | ambiguity_note   | text                     | —     |                            |             |
| archived         | archived         | boolean                  | —     | NOT NULL                   |             |
| created_at       | created_at       | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| updated_at       | updated_at       | timestamp with time zone | —     |                            |             |

> INDEX `idx_ai_evidence_tenant` (tenant_id) [btree]
> INDEX `idx_ai_evidence_plan` (plan_id) [btree]
> INDEX `idx_ai_evidence_field` (field_name) [btree]

### `ai_interpretation`

> _⚠ pending annotation_

| Column                    | Business Name             | Type                     | Class | Constraints                | Description |
| :------------------------ | :------------------------ | :----------------------- | :---- | :------------------------- | :---------- |
| interpretation_id         | interpretation_id         | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id                 | tenant_id                 | uuid                     | —     | NOT NULL                   |             |
| source_thread_id          | source_thread_id          | uuid                     | —     |                            |             |
| run_id                    | run_id                    | uuid                     | —     | NOT NULL                   |             |
| prompt_version_id         | prompt_version_id         | uuid                     | —     | NOT NULL                   |             |
| business_intent           | business_intent           | text                     | —     | NOT NULL                   |             |
| confidence_score          | confidence_score          | numeric                  | —     | NOT NULL                   |             |
| summary                   | summary                   | text                     | —     | NOT NULL                   |             |
| evidence_json             | evidence_json             | jsonb                    | —     | NOT NULL                   |             |
| extracted_references_json | extracted_references_json | jsonb                    | —     | NOT NULL                   |             |
| requested_resolvers_json  | requested_resolvers_json  | jsonb                    | —     | NOT NULL                   |             |
| blocking_questions_json   | blocking_questions_json   | jsonb                    | —     | NOT NULL                   |             |
| raw_llm_trace             | raw_llm_trace             | jsonb                    | —     |                            |             |
| created_at                | created_at                | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| updated_at                | updated_at                | timestamp with time zone | —     |                            |             |

> INDEX `idx_ai_interpretation_tenant` (tenant_id) [btree]
> INDEX `idx_ai_interpretation_run` (run_id) [btree]

### `ai_plan`

> _⚠ pending annotation_

| Column            | Business Name     | Type                     | Class | Constraints                | Description |
| :---------------- | :---------------- | :----------------------- | :---- | :------------------------- | :---------- |
| plan_id           | plan_id           | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id         | tenant_id         | uuid                     | —     | NOT NULL                   |             |
| run_id            | run_id            | uuid                     | —     | NOT NULL                   |             |
| prompt_version_id | prompt_version_id | uuid                     | —     | NOT NULL                   |             |
| plan_json         | plan_json         | jsonb                    | —     | NOT NULL                   |             |
| confidence_score  | confidence_score  | numeric                  | —     | NOT NULL                   |             |
| apply_readiness   | apply_readiness   | text                     | —     | NOT NULL                   |             |
| archived          | archived          | boolean                  | —     | NOT NULL                   |             |
| created_at        | created_at        | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| updated_at        | updated_at        | timestamp with time zone | —     |                            |             |

> INDEX `idx_ai_plan_tenant` (tenant_id) [btree]
> INDEX `idx_ai_plan_run` (run_id) [btree]
> INDEX `idx_ai_plan_prompt_version` (prompt_version_id) [btree]
> INDEX `idx_ai_plan_readiness` (apply_readiness) [btree]

### `ai_prompt_version`

> _⚠ pending annotation_

| Column            | Business Name     | Type                     | Class | Constraints                | Description |
| :---------------- | :---------------- | :----------------------- | :---- | :------------------------- | :---------- |
| prompt_version_id | prompt_version_id | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id         | tenant_id         | uuid                     | —     |                            |             |
| system_prompt     | system_prompt     | text                     | —     | NOT NULL                   |             |
| input_schema      | input_schema      | jsonb                    | —     | NOT NULL                   |             |
| model_config      | model_config      | jsonb                    | —     | NOT NULL                   |             |
| archived          | archived          | boolean                  | —     | NOT NULL                   |             |
| created_at        | created_at        | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| updated_at        | updated_at        | timestamp with time zone | —     |                            |             |

> INDEX `idx_ai_prompt_version_tenant` (tenant_id) [btree]

### `ai_review`

> _⚠ pending annotation_

| Column                      | Business Name               | Type                     | Class | Constraints                | Description |
| :-------------------------- | :-------------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| review_id                   | review_id                   | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id                   | tenant_id                   | uuid                     | —     | NOT NULL                   |             |
| interpretation_id           | interpretation_id           | uuid                     | —     | NOT NULL                   |             |
| run_id                      | run_id                      | uuid                     | —     | NOT NULL                   |             |
| review_status               | review_status               | text                     | —     | NOT NULL                   |             |
| business_case               | business_case               | text                     | —     | NOT NULL                   |             |
| headline                    | headline                    | text                     | —     | NOT NULL                   |             |
| summary                     | summary                     | text                     | —     | NOT NULL                   |             |
| intent_badge_json           | intent_badge_json           | jsonb                    | —     | NOT NULL                   |             |
| sections_json               | sections_json               | jsonb                    | —     | NOT NULL                   |             |
| warnings_json               | warnings_json               | jsonb                    | —     | NOT NULL                   |             |
| blocking_issues_json        | blocking_issues_json        | jsonb                    | —     | NOT NULL                   |             |
| proposed_apply_payload_json | proposed_apply_payload_json | jsonb                    | —     | NOT NULL                   |             |
| applied_overrides_json      | applied_overrides_json      | jsonb                    | —     |                            |             |
| created_at                  | created_at                  | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| updated_at                  | updated_at                  | timestamp with time zone | —     |                            |             |

> INDEX `idx_ai_review_tenant` (tenant_id) [btree]
> INDEX `idx_ai_review_interpretation` (interpretation_id) [btree]

### `ai_run`

> _⚠ pending annotation_

| Column      | Business Name | Type                     | Class | Constraints                | Description |
| :---------- | :------------ | :----------------------- | :---- | :------------------------- | :---------- |
| run_id      | run_id        | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id   | tenant_id     | uuid                     | —     | NOT NULL                   |             |
| user_id     | user_id       | text                     | —     | NOT NULL                   |             |
| task_scope  | task_scope    | text                     | —     | NOT NULL                   |             |
| status      | status        | text                     | —     | NOT NULL                   |             |
| duration_ms | duration_ms   | integer                  | —     |                            |             |
| archived    | archived      | boolean                  | —     | NOT NULL                   |             |
| created_at  | created_at    | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| updated_at  | updated_at    | timestamp with time zone | —     |                            |             |

> INDEX `idx_ai_run_tenant` (tenant_id) [btree]
> INDEX `idx_ai_run_user` (user_id) [btree]
> INDEX `idx_ai_run_status` (status) [btree]

### `article`

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

### `article_bom`

> _⚠ pending annotation_

| Column               | Business Name        | Type                     | Class | Constraints                | Description |
| :------------------- | :------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| bom_id               | bom_id               | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id            | tenant_id            | uuid                     | —     | NOT NULL                   |             |
| header_article_id    | header_article_id    | uuid                     | —     | NOT NULL                   |             |
| component_article_id | component_article_id | uuid                     | —     | NOT NULL                   |             |
| quantity             | quantity             | numeric                  | —     | NOT NULL                   |             |
| scrap_percentage     | scrap_percentage     | numeric                  | —     | NOT NULL, DEFAULT 0        |             |
| sort_order           | sort_order           | integer                  | —     | NOT NULL                   |             |
| archived             | archived             | boolean                  | —     | NOT NULL                   |             |
| created_at           | created_at           | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> CHECK `article_bom_quantity_check`: [object Object]

### `article_group`

> _⚠ pending annotation_

| Column               | Business Name        | Type                     | Class | Constraints                | Description |
| :------------------- | :------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| article_group_id     | article_group_id     | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id            | tenant_id            | uuid                     | —     | NOT NULL                   |             |
| code                 | code                 | text                     | —     | NOT NULL                   |             |
| name                 | name                 | text                     | —     | NOT NULL                   |             |
| tax_class_id         | tax_class_id         | uuid                     | —     |                            |             |
| base_unit_id         | base_unit_id         | uuid                     | —     |                            |             |
| sales_unit_id        | sales_unit_id        | uuid                     | —     |                            |             |
| purchase_unit_id     | purchase_unit_id     | uuid                     | —     |                            |             |
| tracking_mode        | tracking_mode        | text                     | —     |                            |             |
| bom_type             | bom_type             | text                     | —     | NOT NULL, DEFAULT none     |             |
| print_position_texts | print_position_texts | boolean                  | —     |                            |             |
| archived             | archived             | boolean                  | —     | NOT NULL                   |             |
| created_at           | created_at           | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_article_group_tenant` (tenant_id) [btree]

### `article_image`

> _⚠ pending annotation_

| Column           | Business Name    | Type                     | Class | Constraints                | Description |
| :--------------- | :--------------- | :----------------------- | :---- | :------------------------- | :---------- |
| article_image_id | article_image_id | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id        | tenant_id        | uuid                     | —     | NOT NULL                   |             |
| article_id       | article_id       | uuid                     | —     | NOT NULL                   |             |
| storage_key      | storage_key      | text                     | —     | NOT NULL                   |             |
| file_name        | file_name        | text                     | —     | NOT NULL                   |             |
| mime_type        | mime_type        | text                     | —     | NOT NULL                   |             |
| file_size        | file_size        | integer                  | —     | NOT NULL                   |             |
| width            | width            | integer                  | —     |                            |             |
| height           | height           | integer                  | —     |                            |             |
| alt_text         | alt_text         | text                     | —     |                            |             |
| sort_order       | sort_order       | integer                  | —     | NOT NULL                   |             |
| archived         | archived         | boolean                  | —     | NOT NULL                   |             |
| created_at       | created_at       | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_article_image_tenant_article` (tenant_id, article_id) [btree]
> INDEX `idx_article_image_tenant_archived` (tenant_id, archived) [btree]

### `bank_account`

> _⚠ pending annotation_

| Column            | Business Name     | Type                     | Class | Constraints                | Description |
| :---------------- | :---------------- | :----------------------- | :---- | :------------------------- | :---------- |
| bank_account_id   | bank_account_id   | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id         | tenant_id         | uuid                     | —     | NOT NULL                   |             |
| address_id        | address_id        | uuid                     | —     |                            |             |
| iban              | iban              | text                     | —     | NOT NULL                   |             |
| bic               | bic               | text                     | —     |                            |             |
| bank_name         | bank_name         | text                     | —     |                            |             |
| currency_id       | currency_id       | char(3)                  | —     |                            |             |
| is_default        | is_default        | boolean                  | —     | NOT NULL                   |             |
| archived          | archived          | boolean                  | —     | NOT NULL                   |             |
| created_at        | created_at        | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| custom_attributes | custom_attributes | jsonb                    | —     |                            |             |

> INDEX `idx_bank_account_address` (address_id) [btree]
> INDEX `idx_bank_account_tenant` (tenant_id) [btree]

### `company`

> _⚠ pending annotation_

| Column                          | Business Name                   | Type                     | Class | Constraints                | Description |
| :------------------------------ | :------------------------------ | :----------------------- | :---- | :------------------------- | :---------- |
| company_id                      | company_id                      | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id                       | tenant_id                       | uuid                     | —     | NOT NULL                   |             |
| company_no                      | company_no                      | text                     | —     | NOT NULL                   |             |
| name                            | name                            | text                     | —     | NOT NULL                   |             |
| legal_name                      | legal_name                      | text                     | —     |                            |             |
| country_code                    | country_code                    | char(2)                  | —     | NOT NULL                   |             |
| currency_id                     | currency_id                     | char(3)                  | —     | NOT NULL                   |             |
| vat_id                          | vat_id                          | text                     | —     |                            |             |
| archived                        | archived                        | boolean                  | —     | NOT NULL                   |             |
| created_at                      | created_at                      | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| address_line_1                  | address_line_1                  | text                     | —     |                            |             |
| address_line_2                  | address_line_2                  | text                     | —     |                            |             |
| city                            | city                            | text                     | —     |                            |             |
| postal_code                     | postal_code                     | text                     | —     |                            |             |
| phone_landline                  | phone_landline                  | text                     | —     |                            |             |
| phone_mobile                    | phone_mobile                    | text                     | —     |                            |             |
| email                           | email                           | text                     | —     |                            |             |
| homepage                        | homepage                        | text                     | —     |                            |             |
| tax_number                      | tax_number                      | text                     | —     |                            |             |
| tax_authority                   | tax_authority                   | text                     | —     |                            |             |
| gln                             | gln                             | text                     | —     |                            |             |
| eori_no                         | eori_no                         | text                     | —     |                            |             |
| duns_no                         | duns_no                         | text                     | —     |                            |             |
| custom_attributes               | custom_attributes               | jsonb                    | —     |                            |             |
| bank_name                       | bank_name                       | text                     | —     |                            |             |
| bank_bic                        | bank_bic                        | text                     | —     |                            |             |
| bank_iban                       | bank_iban                       | text                     | —     |                            |             |
| fiscal_year_start_month         | fiscal_year_start_month         | integer                  | —     | NOT NULL, DEFAULT 1        |             |
| default_warehouse_id            | default_warehouse_id            | uuid                     | —     |                            |             |
| copy_long_texts_only_on_change  | copy_long_texts_only_on_change  | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| print_address_long_text         | print_address_long_text         | boolean                  | —     | NOT NULL                   |             |
| print_pre_text                  | print_pre_text                  | boolean                  | —     | NOT NULL                   |             |
| print_post_text                 | print_post_text                 | boolean                  | —     | NOT NULL                   |             |
| print_position_texts            | print_position_texts            | boolean                  | —     | NOT NULL                   |             |
| show_article_image_in_entry     | show_article_image_in_entry     | boolean                  | —     | NOT NULL                   |             |
| show_article_image_on_documents | show_article_image_on_documents | boolean                  | —     | NOT NULL                   |             |

> INDEX `idx_company_tenant` (tenant_id) [btree]
> INDEX `idx_company_tenant_archived` (tenant_id, archived) [btree]

> CHECK `company_fiscal_year_start_month_check`: [object Object]

### `connector_definition`

> _⚠ pending annotation_

| Column           | Business Name    | Type  | Class | Constraints                       | Description |
| :--------------- | :--------------- | :---- | :---- | :-------------------------------- | :---------- |
| connector_id     | connector_id     | uuid  | PK    | NOT NULL, DEFAULT uuidv7()        |             |
| slug             | slug             | text  | —     | NOT NULL                          |             |
| label            | label            | jsonb | —     | NOT NULL                          |             |
| default_mappings | default_mappings | jsonb | —     | NOT NULL, DEFAULT [object Object] |             |
| locked_fields    | locked_fields    | jsonb | —     | NOT NULL, DEFAULT                 |             |
| atomicity_mode   | atomicity_mode   | text  | —     | NOT NULL                          |             |

> INDEX `connector_definition_slug_key` (slug) [btree]

> CHECK `connector_definition_atomicity_mode_check`: [object Object]

### `cost_center`

> _⚠ pending annotation_

| Column         | Business Name  | Type                     | Class | Constraints                | Description |
| :------------- | :------------- | :----------------------- | :---- | :------------------------- | :---------- |
| cost_center_id | cost_center_id | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id      | tenant_id      | uuid                     | —     | NOT NULL                   |             |
| company_id     | company_id     | uuid                     | —     |                            |             |
| code           | code           | text                     | —     | NOT NULL                   |             |
| name           | name           | text                     | —     | NOT NULL                   |             |
| archived       | archived       | boolean                  | —     | NOT NULL                   |             |
| created_at     | created_at     | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_cost_center_tenant` (tenant_id) [btree]

### `country`

> _⚠ pending annotation_

| Column     | Business Name | Type                     | Class | Constraints                | Description |
| :--------- | :------------ | :----------------------- | :---- | :------------------------- | :---------- |
| country_id | country_id    | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| iso2_code  | iso2_code     | varchar(2)               | —     | NOT NULL                   |             |
| iso3_code  | iso3_code     | varchar(3)               | —     | NOT NULL                   |             |
| name       | name          | jsonb                    | —     | NOT NULL                   |             |
| is_eu      | is_eu         | boolean                  | —     | NOT NULL                   |             |
| archived   | archived      | boolean                  | —     | NOT NULL                   |             |
| created_at | created_at    | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `country_iso2_code_key` (iso2_code) [btree]
> INDEX `country_iso3_code_key` (iso3_code) [btree]

### `currency`

> _⚠ pending annotation_

| Column      | Business Name | Type                     | Class | Constraints                | Description |
| :---------- | :------------ | :----------------------- | :---- | :------------------------- | :---------- |
| currency_id | currency_id   | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| code        | code          | varchar(3)               | —     | NOT NULL                   |             |
| name        | name          | jsonb                    | —     | NOT NULL                   |             |
| symbol      | symbol        | varchar(5)               | —     |                            |             |
| decimals    | decimals      | integer                  | —     | NOT NULL, DEFAULT 2        |             |
| archived    | archived      | boolean                  | —     | NOT NULL                   |             |
| created_at  | created_at    | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `currency_code_key` (code) [btree]

### `delivery_address`

> _⚠ pending annotation_

| Column               | Business Name        | Type                     | Class | Constraints                | Description |
| :------------------- | :------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| delivery_address_id  | delivery_address_id  | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id            | tenant_id            | uuid                     | —     | NOT NULL                   |             |
| address_id           | address_id           | uuid                     | —     | NOT NULL                   |             |
| name                 | name                 | text                     | —     |                            |             |
| address_line_1       | address_line_1       | text                     | —     | NOT NULL                   |             |
| address_line_2       | address_line_2       | text                     | —     |                            |             |
| postal_code          | postal_code          | text                     | —     | NOT NULL                   |             |
| city                 | city                 | text                     | —     | NOT NULL                   |             |
| country_code         | country_code         | char(2)                  | —     | NOT NULL                   |             |
| default_for_shipping | default_for_shipping | boolean                  | —     |                            |             |
| archived             | archived             | boolean                  | —     | NOT NULL                   |             |
| custom_attributes    | custom_attributes    | jsonb                    | —     |                            |             |
| created_at           | created_at           | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| updated_at           | updated_at           | timestamp with time zone | —     |                            |             |

> INDEX `idx_delivery_address_partner` (address_id) [btree]
> INDEX `idx_delivery_address_tenant` (tenant_id) [btree]

### `dev_cycles`

> _⚠ pending annotation_

| Column             | Business Name      | Type                     | Class | Constraints                | Description |
| :----------------- | :----------------- | :----------------------- | :---- | :------------------------- | :---------- |
| cycle_id           | cycle_id           | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| cycle_number       | cycle_number       | integer                  | —     | NOT NULL                   |             |
| recorded_at        | recorded_at        | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| slice_fit_score    | slice_fit_score    | integer                  | —     | NOT NULL                   |             |
| slice_fit_max      | slice_fit_max      | integer                  | —     | NOT NULL                   |             |
| story_coverage     | story_coverage     | integer                  | —     | NOT NULL                   |             |
| story_coverage_max | story_coverage_max | integer                  | —     | NOT NULL                   |             |
| tests_added        | tests_added        | integer                  | —     | NOT NULL                   |             |
| vp_test_pass       | vp_test_pass       | boolean                  | —     |                            |             |
| blocker            | blocker            | text                     | —     |                            |             |
| process_adjustment | process_adjustment | text                     | —     |                            |             |
| created_at         | created_at         | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

### `discount_group`

> _⚠ pending annotation_

| Column            | Business Name     | Type                     | Class | Constraints                | Description |
| :---------------- | :---------------- | :----------------------- | :---- | :------------------------- | :---------- |
| discount_group_id | discount_group_id | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id         | tenant_id         | uuid                     | —     | NOT NULL                   |             |
| name              | name              | text                     | —     | NOT NULL                   |             |
| percentage        | percentage        | numeric                  | —     | NOT NULL                   |             |
| archived          | archived          | boolean                  | —     | NOT NULL                   |             |
| created_at        | created_at        | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_discount_group_tenant` (tenant_id) [btree]

### `document`

> _⚠ pending annotation_

| Column                    | Business Name             | Type                     | Class | Constraints                | Description |
| :------------------------ | :------------------------ | :----------------------- | :---- | :------------------------- | :---------- |
| document_id               | document_id               | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id                 | tenant_id                 | uuid                     | —     | NOT NULL                   |             |
| company_id                | company_id                | uuid                     | —     | NOT NULL                   |             |
| document_type             | document_type             | char(1)                  | —     | NOT NULL                   |             |
| document_direction        | document_direction        | text                     | —     | NOT NULL                   |             |
| document_no               | document_no               | text                     | —     | NOT NULL                   |             |
| status                    | status                    | text                     | —     | NOT NULL                   |             |
| customer_id               | customer_id               | uuid                     | —     |                            |             |
| currency_id               | currency_id               | char(3)                  | —     |                            |             |
| print_options             | print_options             | jsonb                    | —     |                            |             |
| document_date             | document_date             | date                     | —     | NOT NULL                   |             |
| posting_date              | posting_date              | date                     | —     |                            |             |
| total_net                 | total_net                 | numeric                  | —     |                            |             |
| total_tax                 | total_tax                 | numeric                  | —     |                            |             |
| total_gross               | total_gross               | numeric                  | —     |                            |             |
| version_no                | version_no                | integer                  | —     | NOT NULL, DEFAULT 1        |             |
| posted_at                 | posted_at                 | timestamp with time zone | —     |                            |             |
| posted_by                 | posted_by                 | text                     | —     |                            |             |
| cancelled_at              | cancelled_at              | timestamp with time zone | —     |                            |             |
| storno_document_id        | storno_document_id        | uuid                     | —     |                            |             |
| custom_attributes         | custom_attributes         | jsonb                    | —     |                            |             |
| created_at                | created_at                | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| updated_at                | updated_at                | timestamp with time zone | —     |                            |             |
| transaction_id            | transaction_id            | uuid                     | —     | NOT NULL                   |             |
| parent_document_id        | parent_document_id        | uuid                     | —     |                            |             |
| document_group_id         | document_group_id         | uuid                     | —     |                            |             |
| archived_at               | archived_at               | timestamp with time zone | —     |                            |             |
| billing_address           | billing_address           | jsonb                    | —     |                            |             |
| delivery_address          | delivery_address          | jsonb                    | —     |                            |             |
| delivery_address_id       | delivery_address_id       | uuid                     | —     |                            |             |
| note_text                 | note_text                 | text                     | —     |                            |             |
| note_text_source_entity   | note_text_source_entity   | text                     | —     |                            |             |
| note_text_source_id       | note_text_source_id       | uuid                     | —     |                            |             |
| note_text_source_field    | note_text_source_field    | text                     | —     |                            |             |
| note_text_linked_at       | note_text_linked_at       | timestamp with time zone | —     |                            |             |
| note_text_overridden_at   | note_text_overridden_at   | timestamp with time zone | —     |                            |             |
| pre_text                  | pre_text                  | text                     | —     |                            |             |
| pre_text_source_entity    | pre_text_source_entity    | text                     | —     |                            |             |
| pre_text_source_id        | pre_text_source_id        | uuid                     | —     |                            |             |
| pre_text_source_field     | pre_text_source_field     | text                     | —     |                            |             |
| pre_text_linked_at        | pre_text_linked_at        | timestamp with time zone | —     |                            |             |
| pre_text_overridden_at    | pre_text_overridden_at    | timestamp with time zone | —     |                            |             |
| post_text                 | post_text                 | text                     | —     |                            |             |
| post_text_source_entity   | post_text_source_entity   | text                     | —     |                            |             |
| post_text_source_id       | post_text_source_id       | uuid                     | —     |                            |             |
| post_text_source_field    | post_text_source_field    | text                     | —     |                            |             |
| post_text_linked_at       | post_text_linked_at       | timestamp with time zone | —     |                            |             |
| post_text_overridden_at   | post_text_overridden_at   | timestamp with time zone | —     |                            |             |
| storno_text               | storno_text               | text                     | —     |                            |             |
| storno_text_source_entity | storno_text_source_entity | text                     | —     |                            |             |
| storno_text_source_id     | storno_text_source_id     | uuid                     | —     |                            |             |
| storno_text_source_field  | storno_text_source_field  | text                     | —     |                            |             |
| storno_text_linked_at     | storno_text_linked_at     | timestamp with time zone | —     |                            |             |
| storno_text_overridden_at | storno_text_overridden_at | timestamp with time zone | —     |                            |             |
| payment_term_id           | payment_term_id           | uuid                     | —     |                            |             |
| shipping_method_id        | shipping_method_id        | uuid                     | —     |                            |             |
| document_type_id          | document_type_id          | uuid                     | —     |                            |             |
| warehouse_id              | warehouse_id              | uuid                     | —     |                            |             |
| target_warehouse_id       | target_warehouse_id       | uuid                     | —     |                            |             |
| is_paid                   | is_paid                   | boolean                  | —     | NOT NULL                   |             |
| paid_at                   | paid_at                   | timestamp with time zone | —     |                            |             |
| paid_amount               | paid_amount               | numeric                  | —     |                            |             |

> INDEX `idx_document_company` (tenant_id, company_id) [btree]
> INDEX `idx_document_customer` (tenant_id, customer_id) [btree]
> INDEX `idx_document_delivery_address` (tenant_id, delivery_address_id) [btree]
> INDEX `idx_document_group` (document_group_id) [btree]
> INDEX `idx_document_group_type` (document_group_id, document_type_id) [btree]
> INDEX `idx_document_parent` (parent_document_id) [btree]
> INDEX `idx_document_payment_term` (payment_term_id) [btree]
> INDEX `idx_document_posted_at` (tenant_id, posted_at) [btree]
> INDEX `idx_document_shipping_method` (shipping_method_id) [btree]
> INDEX `idx_document_tenant` (tenant_id) [btree]
> INDEX `idx_document_transaction` (tenant_id, transaction_id) [btree]
> INDEX `idx_document_type_status` (tenant_id, document_type, status) [btree]
> INDEX `idx_document_warehouse` (warehouse_id) [btree]

> CHECK `chk_document_type`: [object Object]

### `document_group`

> _⚠ pending annotation_

| Column                     | Business Name              | Type                     | Class | Constraints                | Description |
| :------------------------- | :------------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| document_group_id          | document_group_id          | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id                  | tenant_id                  | uuid                     | —     | NOT NULL                   |             |
| name                       | name                       | text                     | —     | NOT NULL                   |             |
| created_at                 | created_at                 | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| number_sequence_id         | number_sequence_id         | uuid                     | —     |                            |             |
| description                | description                | text                     | —     |                            |             |
| default_warehouse_id       | default_warehouse_id       | uuid                     | —     |                            |             |
| default_tax_code_id        | default_tax_code_id        | uuid                     | —     |                            |             |
| default_sales_account_id   | default_sales_account_id   | uuid                     | —     |                            |             |
| default_cost_account_id    | default_cost_account_id    | uuid                     | —     |                            |             |
| archived                   | archived                   | boolean                  | —     | NOT NULL                   |             |
| sort_order                 | sort_order                 | integer                  | —     |                            |             |
| updated_at                 | updated_at                 | timestamp with time zone | —     |                            |             |
| default_payment_term_id    | default_payment_term_id    | uuid                     | —     |                            |             |
| default_shipping_method_id | default_shipping_method_id | uuid                     | —     |                            |             |
| require_serial_tracking    | require_serial_tracking    | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| require_batch_tracking     | require_batch_tracking     | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| document_type              | document_type              | varchar(1)               | —     | NOT NULL                   |             |
| group_number               | group_number               | integer                  | —     | NOT NULL                   |             |
| direction                  | direction                  | varchar(20)              | —     |                            |             |
| next_group_id              | next_group_id              | uuid                     | —     |                            |             |
| company_id                 | company_id                 | uuid                     | —     |                            |             |

> INDEX `idx_document_group_company` (company_id) [btree]
> INDEX `idx_document_group_tenant` (tenant_id) [btree]

> CHECK `document_group_group_number_check`: [object Object]

### `document_line`

> _⚠ pending annotation_

| Column                  | Business Name           | Type                     | Class | Constraints                | Description |
| :---------------------- | :---------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| document_line_id        | document_line_id        | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id               | tenant_id               | uuid                     | —     | NOT NULL                   |             |
| document_id             | document_id             | uuid                     | —     | NOT NULL                   |             |
| line_no                 | line_no                 | integer                  | —     | NOT NULL                   |             |
| article_id              | article_id              | uuid                     | —     |                            |             |
| article_text_snapshot   | article_text_snapshot   | text                     | —     |                            |             |
| lang_text               | lang_text               | text                     | —     |                            |             |
| lang_text_source_entity | lang_text_source_entity | text                     | —     |                            |             |
| lang_text_source_id     | lang_text_source_id     | uuid                     | —     |                            |             |
| lang_text_source_field  | lang_text_source_field  | text                     | —     |                            |             |
| lang_text_linked_at     | lang_text_linked_at     | timestamp with time zone | —     |                            |             |
| lang_text_overridden_at | lang_text_overridden_at | timestamp with time zone | —     |                            |             |
| quantity                | quantity                | numeric                  | —     | NOT NULL                   |             |
| unit                    | unit                    | text                     | —     |                            |             |
| net_price               | net_price               | numeric                  | —     | NOT NULL                   |             |
| discount_percentage     | discount_percentage     | numeric                  | —     |                            |             |
| tax_code_id             | tax_code_id             | uuid                     | —     |                            |             |
| tax_amount              | tax_amount              | numeric                  | —     |                            |             |
| line_total_net          | line_total_net          | numeric                  | —     |                            |             |
| warehouse_id            | warehouse_id            | uuid                     | —     |                            |             |
| cost_center_id          | cost_center_id          | uuid                     | —     |                            |             |
| created_at              | created_at              | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| archived_at             | archived_at             | timestamp with time zone | —     |                            |             |
| transaction_id          | transaction_id          | uuid                     | —     |                            |             |
| movement_type           | movement_type           | char(1)                  | —     |                            |             |
| line_type               | line_type               | varchar(20)              | —     | NOT NULL, DEFAULT article  |             |
| bom_group_id            | bom_group_id            | uuid                     | —     |                            |             |

> INDEX `idx_document_line_article` (article_id) [btree]
> INDEX `idx_document_line_document` (document_id) [btree]
> INDEX `idx_document_line_tenant_document` (tenant_id, document_id) [btree]
> INDEX `idx_document_line_tenant_archived` (tenant_id, archived_at) [btree]
> INDEX `idx_document_line_tenant` (tenant_id) [btree]
> INDEX `idx_document_line_tx` (tenant_id, transaction_id) [btree]

> CHECK `chk_article_line_requires_article_id`: [object Object]
> CHECK `chk_document_line_movement_type`: [object Object]
> CHECK `document_line_line_type_check`: [object Object]

### `document_line_allocation`

> _⚠ pending annotation_

| Column                  | Business Name           | Type                     | Class | Constraints                | Description |
| :---------------------- | :---------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| allocation_id           | allocation_id           | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id               | tenant_id               | uuid                     | —     | NOT NULL                   |             |
| source_document_line_id | source_document_line_id | uuid                     | —     | NOT NULL                   |             |
| target_document_line_id | target_document_line_id | uuid                     | —     | NOT NULL                   |             |
| allocated_qty           | allocated_qty           | numeric                  | —     | NOT NULL                   |             |
| created_at              | created_at              | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_dla_source` (tenant_id, source_document_line_id) [btree]
> INDEX `idx_dla_target` (tenant_id, target_document_line_id) [btree]

### `document_line_tracking`

> _⚠ pending annotation_

| Column           | Business Name    | Type                     | Class | Constraints                | Description |
| :--------------- | :--------------- | :----------------------- | :---- | :------------------------- | :---------- |
| tracking_id      | tracking_id      | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id        | tenant_id        | uuid                     | —     | NOT NULL                   |             |
| document_line_id | document_line_id | uuid                     | —     | NOT NULL                   |             |
| serial_number_id | serial_number_id | uuid                     | —     |                            |             |
| serial_no        | serial_no        | text                     | —     |                            |             |
| batch_no         | batch_no         | text                     | —     |                            |             |
| qty              | qty              | numeric                  | —     | NOT NULL                   |             |
| created_at       | created_at       | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_document_line_tracking_tenant_line` (tenant_id, document_line_id) [btree]
> INDEX `idx_document_line_tracking_tenant_created` (tenant_id, document_line_id, created_at) [btree]

> CHECK `document_line_tracking_check`: [object Object]

### `document_shipment`

> _⚠ pending annotation_

| Column               | Business Name        | Type                     | Class | Constraints                | Description |
| :------------------- | :------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| document_shipment_id | document_shipment_id | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id            | tenant_id            | uuid                     | —     | NOT NULL                   |             |
| document_id          | document_id          | uuid                     | —     | NOT NULL                   |             |
| shipment_status      | shipment_status      | text                     | —     | NOT NULL, DEFAULT open     |             |
| carrier_key          | carrier_key          | text                     | —     | NOT NULL, DEFAULT dhl      |             |
| carrier_service_key  | carrier_service_key  | text                     | —     | NOT NULL, DEFAULT paket    |             |
| tracking_id          | tracking_id          | text                     | —     |                            |             |
| recipient_name       | recipient_name       | text                     | —     | NOT NULL                   |             |
| company              | company              | text                     | —     |                            |             |
| street               | street               | text                     | —     | NOT NULL                   |             |
| house_number         | house_number         | text                     | —     | NOT NULL                   |             |
| postal_code          | postal_code          | text                     | —     | NOT NULL                   |             |
| city                 | city                 | text                     | —     | NOT NULL                   |             |
| country_code         | country_code         | char(2)                  | —     | NOT NULL, DEFAULT DE       |             |
| email                | email                | text                     | —     |                            |             |
| phone                | phone                | text                     | —     |                            |             |
| exported_at          | exported_at          | timestamp with time zone | —     |                            |             |
| label_created_at     | label_created_at     | timestamp with time zone | —     |                            |             |
| shipped_at           | shipped_at           | timestamp with time zone | —     |                            |             |
| created_at           | created_at           | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| updated_at           | updated_at           | timestamp with time zone | —     |                            |             |

> INDEX `idx_shipment_document` (document_id) [btree]
> INDEX `idx_shipment_status` (shipment_status) [btree]

### `document_shipment_package`

> _⚠ pending annotation_

| Column                       | Business Name                | Type                     | Class | Constraints                | Description |
| :--------------------------- | :--------------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| document_shipment_package_id | document_shipment_package_id | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id                    | tenant_id                    | uuid                     | —     | NOT NULL                   |             |
| document_shipment_id         | document_shipment_id         | uuid                     | —     | NOT NULL                   |             |
| seq                          | seq                          | integer                  | —     | NOT NULL, DEFAULT 1        |             |
| weight_kg                    | weight_kg                    | numeric                  | —     | NOT NULL, DEFAULT 1.0      |             |
| created_at                   | created_at                   | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_shipment_package_shipment` (document_shipment_id) [btree]

### `document_type`

> _⚠ pending annotation_

| Column                | Business Name         | Type                     | Class | Constraints                | Description |
| :-------------------- | :-------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| document_type_id      | document_type_id      | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id             | tenant_id             | uuid                     | —     | NOT NULL                   |             |
| code                  | code                  | varchar(20)              | —     | NOT NULL                   |             |
| name                  | name                  | varchar(100)             | —     | NOT NULL                   |             |
| movement_type         | movement_type         | char(1)                  | —     | NOT NULL                   |             |
| next_document_type_id | next_document_type_id | uuid                     | —     |                            |             |
| requires_warehouse    | requires_warehouse    | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| requires_cost_center  | requires_cost_center  | boolean                  | —     | NOT NULL                   |             |
| archived              | archived              | boolean                  | —     | NOT NULL                   |             |
| sort_order            | sort_order            | integer                  | —     | NOT NULL                   |             |
| created_at            | created_at            | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| updated_at            | updated_at            | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_document_type_tenant` (tenant_id) [btree]

> CHECK `document_type_movement_type_check`: [object Object]

### `email_account`

> _⚠ pending annotation_

| Column                | Business Name         | Type                     | Class | Constraints                 | Description |
| :-------------------- | :-------------------- | :----------------------- | :---- | :-------------------------- | :---------- |
| email_account_id      | email_account_id      | uuid                     | PK    | NOT NULL, DEFAULT uuidv7()  |             |
| tenant_id             | tenant_id             | uuid                     | —     | NOT NULL                    |             |
| provider              | provider              | text                     | —     | NOT NULL                    |             |
| provider_account_id   | provider_account_id   | text                     | —     | NOT NULL                    |             |
| display_name          | display_name          | text                     | —     | NOT NULL                    |             |
| primary_email         | primary_email         | text                     | —     | NOT NULL                    |             |
| status                | status                | text                     | —     | NOT NULL, DEFAULT connected |             |
| credentials_encrypted | credentials_encrypted | text                     | —     | NOT NULL                    |             |
| scopes                | scopes                | jsonb                    | —     | NOT NULL, DEFAULT           |             |
| last_sync_at          | last_sync_at          | timestamp with time zone | —     |                             |             |
| last_sync_status      | last_sync_status      | text                     | —     | NOT NULL, DEFAULT idle      |             |
| last_sync_error       | last_sync_error       | text                     | —     |                             |             |
| watch_expires_at      | watch_expires_at      | timestamp with time zone | —     |                             |             |
| archived              | archived              | boolean                  | —     | NOT NULL                    |             |
| created_at            | created_at            | timestamp with time zone | —     | NOT NULL, DEFAULT now()     |             |
| updated_at            | updated_at            | timestamp with time zone | —     |                             |             |

> INDEX `idx_email_account_tenant` (tenant_id) [btree]
> INDEX `idx_email_account_status` (tenant_id, status) [btree]

> CHECK `chk_email_account_provider`: [object Object]
> CHECK `chk_email_account_status`: [object Object]
> CHECK `chk_email_account_sync_status`: [object Object]

### `email_account_user_grant`

> _⚠ pending annotation_

| Column                      | Business Name               | Type                     | Class | Constraints                | Description |
| :-------------------------- | :-------------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| email_account_user_grant_id | email_account_user_grant_id | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id                   | tenant_id                   | uuid                     | —     | NOT NULL                   |             |
| email_account_id            | email_account_id            | uuid                     | —     | NOT NULL                   |             |
| user_id                     | user_id                     | text                     | —     | NOT NULL                   |             |
| can_read                    | can_read                    | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| can_send                    | can_send                    | boolean                  | —     | NOT NULL                   |             |
| can_manage                  | can_manage                  | boolean                  | —     | NOT NULL                   |             |
| created_at                  | created_at                  | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_email_account_grant_user` (tenant_id, user_id) [btree]

### `email_attachment`

> _⚠ pending annotation_

| Column                 | Business Name          | Type                     | Class | Constraints                | Description |
| :--------------------- | :--------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| email_attachment_id    | email_attachment_id    | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id              | tenant_id              | uuid                     | —     | NOT NULL                   |             |
| email_message_id       | email_message_id       | uuid                     | —     | NOT NULL                   |             |
| provider_attachment_id | provider_attachment_id | text                     | —     |                            |             |
| file_name              | file_name              | text                     | —     | NOT NULL                   |             |
| content_type           | content_type           | text                     | —     |                            |             |
| size_bytes             | size_bytes             | integer                  | —     |                            |             |
| storage_key            | storage_key            | text                     | —     |                            |             |
| inline_content_id      | inline_content_id      | text                     | —     |                            |             |
| fetched_at             | fetched_at             | timestamp with time zone | —     |                            |             |
| created_at             | created_at             | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_email_attachment_message` (tenant_id, email_message_id) [btree]
> INDEX `idx_email_attachment_storage` (tenant_id, storage_key) [btree]

### `email_identity`

> _⚠ pending annotation_

| Column               | Business Name        | Type                     | Class | Constraints                | Description |
| :------------------- | :------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| email_identity_id    | email_identity_id    | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id            | tenant_id            | uuid                     | —     | NOT NULL                   |             |
| email_account_id     | email_account_id     | uuid                     | —     | NOT NULL                   |             |
| email                | email                | text                     | —     | NOT NULL                   |             |
| display_name         | display_name         | text                     | —     |                            |             |
| provider_identity_id | provider_identity_id | text                     | —     |                            |             |
| is_primary           | is_primary           | boolean                  | —     | NOT NULL                   |             |
| can_send             | can_send             | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| archived             | archived             | boolean                  | —     | NOT NULL                   |             |
| created_at           | created_at           | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_email_identity_account` (tenant_id, email_account_id) [btree]

### `email_job`

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
| attempts         | attempts         | integer                  | —     | NOT NULL                          |             |
| max_attempts     | max_attempts     | integer                  | —     | NOT NULL, DEFAULT 5               |             |
| run_after        | run_after        | timestamp with time zone | —     | NOT NULL, DEFAULT now()           |             |
| locked_at        | locked_at        | timestamp with time zone | —     |                                   |             |
| locked_by        | locked_by        | text                     | —     |                                   |             |
| last_error       | last_error       | text                     | —     |                                   |             |
| created_at       | created_at       | timestamp with time zone | —     | NOT NULL, DEFAULT now()           |             |
| updated_at       | updated_at       | timestamp with time zone | —     |                                   |             |

> INDEX `idx_email_job_queue_claim` (tenant_id, status, run_after, created_at) [btree]
> INDEX `idx_email_job_account` (tenant_id, email_account_id) [btree]

> CHECK `chk_email_job_type`: [object Object]
> CHECK `chk_email_job_status`: [object Object]

### `email_label`

> _⚠ pending annotation_

| Column                   | Business Name            | Type                     | Class | Constraints                | Description |
| :----------------------- | :----------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| email_label_id           | email_label_id           | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id                | tenant_id                | uuid                     | —     | NOT NULL                   |             |
| email_account_id         | email_account_id         | uuid                     | —     | NOT NULL                   |             |
| provider_label_id        | provider_label_id        | text                     | —     | NOT NULL                   |             |
| name                     | name                     | text                     | —     | NOT NULL                   |             |
| kind                     | kind                     | text                     | —     | NOT NULL, DEFAULT label    |             |
| color                    | color                    | text                     | —     |                            |             |
| parent_provider_label_id | parent_provider_label_id | text                     | —     |                            |             |
| message_count            | message_count            | integer                  | —     | NOT NULL                   |             |
| unread_count             | unread_count             | integer                  | —     | NOT NULL                   |             |
| archived                 | archived                 | boolean                  | —     | NOT NULL                   |             |
| created_at               | created_at               | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| updated_at               | updated_at               | timestamp with time zone | —     |                            |             |

> INDEX `idx_email_label_account_active` (tenant_id, email_account_id, archived, kind, name) [btree]

> CHECK `chk_email_label_kind`: [object Object]

### `email_message`

> _⚠ pending annotation_

| Column              | Business Name       | Type                     | Class | Constraints                       | Description |
| :------------------ | :------------------ | :----------------------- | :---- | :-------------------------------- | :---------- |
| email_message_id    | email_message_id    | uuid                     | PK    | NOT NULL, DEFAULT uuidv7()        |             |
| tenant_id           | tenant_id           | uuid                     | —     | NOT NULL                          |             |
| email_account_id    | email_account_id    | uuid                     | —     | NOT NULL                          |             |
| email_thread_id     | email_thread_id     | uuid                     | —     | NOT NULL                          |             |
| provider_message_id | provider_message_id | text                     | —     | NOT NULL                          |             |
| provider_draft_id   | provider_draft_id   | text                     | —     |                                   |             |
| internet_message_id | internet_message_id | text                     | —     |                                   |             |
| direction           | direction           | text                     | —     | NOT NULL                          |             |
| from_json           | from_json           | jsonb                    | —     | NOT NULL, DEFAULT [object Object] |             |
| to_json             | to_json             | jsonb                    | —     | NOT NULL, DEFAULT                 |             |
| cc_json             | cc_json             | jsonb                    | —     | NOT NULL, DEFAULT                 |             |
| bcc_json            | bcc_json            | jsonb                    | —     | NOT NULL, DEFAULT                 |             |
| subject             | subject             | text                     | —     |                                   |             |
| snippet             | snippet             | text                     | —     |                                   |             |
| body_html           | body_html           | text                     | —     |                                   |             |
| body_text           | body_text           | text                     | —     |                                   |             |
| sent_at             | sent_at             | timestamp with time zone | —     |                                   |             |
| received_at         | received_at         | timestamp with time zone | —     |                                   |             |
| is_read             | is_read             | boolean                  | —     | NOT NULL                          |             |
| has_attachments     | has_attachments     | boolean                  | —     | NOT NULL                          |             |
| raw_headers         | raw_headers         | jsonb                    | —     | NOT NULL, DEFAULT [object Object] |             |
| created_at          | created_at          | timestamp with time zone | —     | NOT NULL, DEFAULT now()           |             |
| updated_at          | updated_at          | timestamp with time zone | —     |                                   |             |

> INDEX `idx_email_message_thread` (tenant_id, email_thread_id) [btree]
> INDEX `idx_email_message_thread_timeline` (tenant_id, email_thread_id, received_at, sent_at, created_at) [btree]
> INDEX `idx_email_message_account_date` (tenant_id, email_account_id, received_at) [btree]

> CHECK `chk_email_message_direction`: [object Object]

### `email_message_label`

> _⚠ pending annotation_

| Column                 | Business Name          | Type                     | Class | Constraints                | Description |
| :--------------------- | :--------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| email_message_label_id | email_message_label_id | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id              | tenant_id              | uuid                     | —     | NOT NULL                   |             |
| email_message_id       | email_message_id       | uuid                     | —     | NOT NULL                   |             |
| email_label_id         | email_label_id         | uuid                     | —     | NOT NULL                   |             |
| created_at             | created_at             | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_email_message_label_label` (tenant_id, email_label_id) [btree]

### `email_outbox`

> _⚠ pending annotation_

| Column            | Business Name     | Type                     | Class | Constraints                       | Description |
| :---------------- | :---------------- | :----------------------- | :---- | :-------------------------------- | :---------- |
| email_outbox_id   | email_outbox_id   | uuid                     | PK    | NOT NULL, DEFAULT uuidv7()        |             |
| tenant_id         | tenant_id         | uuid                     | —     | NOT NULL                          |             |
| email_account_id  | email_account_id  | uuid                     | —     | NOT NULL                          |             |
| email_identity_id | email_identity_id | uuid                     | —     | NOT NULL                          |             |
| email_message_id  | email_message_id  | uuid                     | —     |                                   |             |
| provider_draft_id | provider_draft_id | text                     | —     |                                   |             |
| status            | status            | text                     | —     | NOT NULL, DEFAULT draft           |             |
| payload           | payload           | jsonb                    | —     | NOT NULL, DEFAULT [object Object] |             |
| scheduled_for     | scheduled_for     | timestamp with time zone | —     |                                   |             |
| sent_at           | sent_at           | timestamp with time zone | —     |                                   |             |
| last_error        | last_error        | text                     | —     |                                   |             |
| created_at        | created_at        | timestamp with time zone | —     | NOT NULL, DEFAULT now()           |             |
| updated_at        | updated_at        | timestamp with time zone | —     |                                   |             |
| created_by        | created_by        | text                     | —     |                                   |             |

> INDEX `idx_email_outbox_queue` (tenant_id, email_account_id, status, updated_at, created_at) [btree]
> INDEX `idx_email_outbox_message` (tenant_id, email_message_id) [btree]

> CHECK `chk_email_outbox_status`: [object Object]

### `email_sync_state`

> _⚠ pending annotation_

| Column              | Business Name       | Type                     | Class | Constraints                | Description |
| :------------------ | :------------------ | :----------------------- | :---- | :------------------------- | :---------- |
| email_sync_state_id | email_sync_state_id | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id           | tenant_id           | uuid                     | —     | NOT NULL                   |             |
| email_account_id    | email_account_id    | uuid                     | —     | NOT NULL                   |             |
| scope               | scope               | text                     | —     | NOT NULL, DEFAULT mailbox  |             |
| cursor              | cursor              | text                     | —     |                            |             |
| cursor_json         | cursor_json         | jsonb                    | —     |                            |             |
| status              | status              | text                     | —     | NOT NULL, DEFAULT idle     |             |
| last_synced_at      | last_synced_at      | timestamp with time zone | —     |                            |             |
| last_error          | last_error          | text                     | —     |                            |             |
| updated_at          | updated_at          | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_email_sync_state_account` (tenant_id, email_account_id) [btree]

> CHECK `chk_email_sync_state_status`: [object Object]

### `email_template`

> _⚠ pending annotation_

| Column             | Business Name      | Type                     | Class | Constraints                | Description |
| :----------------- | :----------------- | :----------------------- | :---- | :------------------------- | :---------- |
| email_template_id  | email_template_id  | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id          | tenant_id          | uuid                     | —     | NOT NULL                   |             |
| category           | category           | text                     | —     | NOT NULL, DEFAULT document |             |
| code               | code               | text                     | —     | NOT NULL                   |             |
| name               | name               | text                     | —     | NOT NULL                   |             |
| subject_template   | subject_template   | text                     | —     | NOT NULL                   |             |
| body_html_template | body_html_template | text                     | —     | NOT NULL                   |             |
| body_text_template | body_text_template | text                     | —     |                            |             |
| language           | language           | char(2)                  | —     |                            |             |
| archived           | archived           | boolean                  | —     | NOT NULL                   |             |
| created_at         | created_at         | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| updated_at         | updated_at         | timestamp with time zone | —     |                            |             |

> INDEX `idx_email_template_tenant` (tenant_id, category) [btree]

### `email_template_binding`

> _⚠ pending annotation_

| Column                    | Business Name             | Type                     | Class | Constraints                | Description |
| :------------------------ | :------------------------ | :----------------------- | :---- | :------------------------- | :---------- |
| email_template_binding_id | email_template_binding_id | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id                 | tenant_id                 | uuid                     | —     | NOT NULL                   |             |
| email_template_id         | email_template_id         | uuid                     | —     | NOT NULL                   |             |
| document_type             | document_type             | char(1)                  | —     |                            |             |
| company_id                | company_id                | uuid                     | —     |                            |             |
| language                  | language                  | char(2)                  | —     |                            |             |
| email_identity_id         | email_identity_id         | uuid                     | —     |                            |             |
| priority                  | priority                  | integer                  | —     | NOT NULL, DEFAULT 100      |             |
| archived                  | archived                  | boolean                  | —     | NOT NULL                   |             |
| created_at                | created_at                | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_email_template_binding_lookup` (tenant_id, document_type, company_id, language, email_identity_id) [btree]

### `email_template_render_log`

> _⚠ pending annotation_

| Column                       | Business Name                | Type                     | Class | Constraints                | Description |
| :--------------------------- | :--------------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| email_template_render_log_id | email_template_render_log_id | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id                    | tenant_id                    | uuid                     | —     | NOT NULL                   |             |
| email_template_id            | email_template_id            | uuid                     | —     |                            |             |
| email_template_binding_id    | email_template_binding_id    | uuid                     | —     |                            |             |
| document_id                  | document_id                  | uuid                     | —     |                            |             |
| email_identity_id            | email_identity_id            | uuid                     | —     |                            |             |
| language                     | language                     | char(2)                  | —     |                            |             |
| subject                      | subject                      | text                     | —     | NOT NULL                   |             |
| rendered_hash                | rendered_hash                | text                     | —     |                            |             |
| created_at                   | created_at                   | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| created_by                   | created_by                   | text                     | —     |                            |             |

> INDEX `idx_email_template_render_log_document` (tenant_id, document_id) [btree]
> INDEX `idx_email_template_render_log_template` (tenant_id, email_template_id) [btree]

### `email_thread`

> _⚠ pending annotation_

| Column              | Business Name       | Type                     | Class | Constraints                | Description |
| :------------------ | :------------------ | :----------------------- | :---- | :------------------------- | :---------- |
| email_thread_id     | email_thread_id     | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id           | tenant_id           | uuid                     | —     | NOT NULL                   |             |
| email_account_id    | email_account_id    | uuid                     | —     | NOT NULL                   |             |
| provider_thread_id  | provider_thread_id  | text                     | —     | NOT NULL                   |             |
| subject             | subject             | text                     | —     |                            |             |
| snippet             | snippet             | text                     | —     |                            |             |
| last_message_at     | last_message_at     | timestamp with time zone | —     |                            |             |
| is_read             | is_read             | boolean                  | —     | NOT NULL                   |             |
| is_starred          | is_starred          | boolean                  | —     | NOT NULL                   |             |
| message_count       | message_count       | integer                  | —     | NOT NULL                   |             |
| related_address_id  | related_address_id  | uuid                     | —     |                            |             |
| related_document_id | related_document_id | uuid                     | —     |                            |             |
| archived            | archived            | boolean                  | —     | NOT NULL                   |             |
| in_trash            | in_trash            | boolean                  | —     | NOT NULL                   |             |
| created_at          | created_at          | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| updated_at          | updated_at          | timestamp with time zone | —     |                            |             |

> INDEX `idx_email_thread_mailbox_list` (tenant_id, email_account_id, archived, last_message_at, created_at) [btree]
> INDEX `idx_email_thread_document` (tenant_id, related_document_id) [btree]
> INDEX `idx_email_thread_address` (tenant_id, related_address_id) [btree]

### `entity_commands`

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

### `fact_purchase_event`

> _⚠ pending annotation_

| Column                  | Business Name           | Type                     | Class | Constraints                | Description |
| :---------------------- | :---------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| fact_purchase_event_id  | fact_purchase_event_id  | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id               | tenant_id               | uuid                     | —     | NOT NULL                   |             |
| company_id              | company_id              | uuid                     | —     | NOT NULL                   |             |
| source_document_id      | source_document_id      | uuid                     | —     |                            |             |
| source_document_line_id | source_document_line_id | uuid                     | —     |                            |             |
| supplier_id             | supplier_id             | uuid                     | —     |                            |             |
| article_id              | article_id              | uuid                     | —     |                            |             |
| event_type              | event_type              | text                     | —     | NOT NULL, DEFAULT purchase |             |
| quantity_delta          | quantity_delta          | numeric                  | —     | NOT NULL                   |             |
| amount_net_delta        | amount_net_delta        | numeric                  | —     | NOT NULL                   |             |
| avg_cost_before         | avg_cost_before         | numeric                  | —     |                            |             |
| avg_cost_after          | avg_cost_after          | numeric                  | —     |                            |             |
| fiscal_period_id        | fiscal_period_id        | uuid                     | —     |                            |             |
| booking_period          | booking_period          | date                     | —     |                            |             |
| created_at              | created_at              | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_fact_purchase_tenant_company` (tenant_id, company_id) [btree]
> INDEX `idx_fact_purchase_supplier` (tenant_id, supplier_id) [btree]
> INDEX `idx_fact_purchase_article` (tenant_id, article_id) [btree]
> INDEX `idx_fact_purchase_period` (tenant_id, fiscal_period_id) [btree]

### `fact_sales_event`

> _⚠ pending annotation_

| Column                  | Business Name           | Type                     | Class | Constraints                | Description |
| :---------------------- | :---------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| fact_sales_event_id     | fact_sales_event_id     | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id               | tenant_id               | uuid                     | —     | NOT NULL                   |             |
| company_id              | company_id              | uuid                     | —     |                            |             |
| source_document_id      | source_document_id      | uuid                     | —     |                            |             |
| source_document_line_id | source_document_line_id | uuid                     | —     |                            |             |
| customer_id             | customer_id             | uuid                     | —     |                            |             |
| article_id              | article_id              | uuid                     | —     |                            |             |
| event_type              | event_type              | text                     | —     |                            |             |
| quantity_delta          | quantity_delta          | numeric                  | —     | NOT NULL                   |             |
| amount_net_delta        | amount_net_delta        | numeric                  | —     | NOT NULL                   |             |
| booking_period          | booking_period          | date                     | —     | NOT NULL                   |             |
| created_at              | created_at              | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| transaction_id          | transaction_id          | uuid                     | —     |                            |             |
| cogs_delta              | cogs_delta              | numeric                  | —     |                            |             |
| fiscal_period_id        | fiscal_period_id        | uuid                     | —     |                            |             |

> INDEX `idx_fact_sales_article` (tenant_id, article_id) [btree]
> INDEX `idx_fact_sales_customer` (tenant_id, customer_id) [btree]
> INDEX `idx_fact_sales_period` (tenant_id, booking_period) [btree]
> INDEX `idx_fact_sales_tenant` (tenant_id) [btree]
> INDEX `idx_fact_sales_tx` (tenant_id, transaction_id) [btree]

### `fiscal_period`

> _⚠ pending annotation_

| Column           | Business Name    | Type                     | Class | Constraints                | Description |
| :--------------- | :--------------- | :----------------------- | :---- | :------------------------- | :---------- |
| fiscal_period_id | fiscal_period_id | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id        | tenant_id        | uuid                     | —     | NOT NULL                   |             |
| company_id       | company_id       | uuid                     | —     | NOT NULL                   |             |
| fiscal_year      | fiscal_year      | integer                  | —     | NOT NULL                   |             |
| period_no        | period_no        | integer                  | —     | NOT NULL                   |             |
| start_date       | start_date       | date                     | —     | NOT NULL                   |             |
| end_date         | end_date         | date                     | —     | NOT NULL                   |             |
| is_closed        | is_closed        | boolean                  | —     | NOT NULL                   |             |
| created_at       | created_at       | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_fiscal_period_tenant_date` (tenant_id, company_id, start_date, end_date) [btree]

### `gl_account`

> _⚠ pending annotation_

| Column        | Business Name | Type                     | Class | Constraints                | Description |
| :------------ | :------------ | :----------------------- | :---- | :------------------------- | :---------- |
| gl_account_id | gl_account_id | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id     | tenant_id     | uuid                     | —     | NOT NULL                   |             |
| company_id    | company_id    | uuid                     | —     |                            |             |
| account_no    | account_no    | text                     | —     | NOT NULL                   |             |
| name          | name          | text                     | —     | NOT NULL                   |             |
| account_type  | account_type  | text                     | —     | NOT NULL                   |             |
| archived      | archived      | boolean                  | —     | NOT NULL                   |             |
| created_at    | created_at    | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_gl_account_tenant` (tenant_id) [btree]

### `helper_table_registry`

> _⚠ pending annotation_

| Column           | Business Name    | Type                     | Class | Constraints                | Description |
| :--------------- | :--------------- | :----------------------- | :---- | :------------------------- | :---------- |
| id               | id               | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| table_name       | table_name       | text                     | —     | NOT NULL                   |             |
| label            | label            | jsonb                    | —     | NOT NULL                   |             |
| pk_column        | pk_column        | text                     | —     | NOT NULL                   |             |
| display_column   | display_column   | text                     | —     | NOT NULL                   |             |
| display_is_i18n  | display_is_i18n  | boolean                  | —     | NOT NULL                   |             |
| code_column      | code_column      | text                     | —     |                            |             |
| is_tenant_scoped | is_tenant_scoped | boolean                  | —     | NOT NULL                   |             |
| default_filter   | default_filter   | jsonb                    | —     |                            |             |
| sort_column      | sort_column      | text                     | —     | NOT NULL                   |             |
| created_at       | created_at       | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| value_column     | value_column     | text                     | —     |                            |             |
| group            | group            | text                     | —     |                            |             |
| category         | category         | text                     | —     |                            |             |

### `import_batch`

> _⚠ pending annotation_

| Column              | Business Name       | Type                     | Class | Constraints                | Description |
| :------------------ | :------------------ | :----------------------- | :---- | :------------------------- | :---------- |
| batch_id            | batch_id            | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id           | tenant_id           | uuid                     | —     | NOT NULL                   |             |
| connector_id        | connector_id        | uuid                     | —     |                            |             |
| profile_id          | profile_id          | uuid                     | —     |                            |             |
| mapping_version_id  | mapping_version_id  | uuid                     | —     |                            |             |
| atomicity_mode      | atomicity_mode      | text                     | —     | NOT NULL                   |             |
| status              | status              | text                     | —     | NOT NULL, DEFAULT pending  |             |
| is_rerun            | is_rerun            | boolean                  | —     | NOT NULL                   |             |
| source_batch_id     | source_batch_id     | uuid                     | —     |                            |             |
| posted_entity_count | posted_entity_count | integer                  | —     | NOT NULL                   |             |
| error_summary       | error_summary       | jsonb                    | —     |                            |             |
| created_at          | created_at          | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| processed_at        | processed_at        | timestamp with time zone | —     |                            |             |
| target_entity       | target_entity       | text                     | —     |                            |             |
| target_command_key  | target_command_key  | text                     | —     |                            |             |

> CHECK `import_batch_atomicity_mode_check`: [object Object]
> CHECK `import_batch_status_check`: [object Object]

### `import_profile`

> _⚠ pending annotation_

| Column             | Business Name      | Type                     | Class | Constraints                | Description |
| :----------------- | :----------------- | :----------------------- | :---- | :------------------------- | :---------- |
| profile_id         | profile_id         | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id          | tenant_id          | uuid                     | —     | NOT NULL                   |             |
| slug               | slug               | text                     | —     | NOT NULL                   |             |
| label              | label              | text                     | —     | NOT NULL                   |             |
| target_entity      | target_entity      | text                     | —     | NOT NULL                   |             |
| target_command_key | target_command_key | text                     | —     | NOT NULL                   |             |
| requires_approval  | requires_approval  | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| archived           | archived           | boolean                  | —     | NOT NULL                   |             |
| created_at         | created_at         | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| updated_at         | updated_at         | timestamp with time zone | —     |                            |             |

> INDEX `idx_import_profile_tenant` (tenant_id) [btree]

### `import_profile_mapping_version`

> _⚠ pending annotation_

| Column              | Business Name       | Type                     | Class | Constraints                | Description |
| :------------------ | :------------------ | :----------------------- | :---- | :------------------------- | :---------- |
| version_id          | version_id          | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id           | tenant_id           | uuid                     | —     | NOT NULL                   |             |
| tenant_connector_id | tenant_connector_id | uuid                     | —     | NOT NULL                   |             |
| profile_id          | profile_id          | uuid                     | —     | NOT NULL                   |             |
| version_no          | version_no          | integer                  | —     | NOT NULL, DEFAULT 1        |             |
| mappings            | mappings            | jsonb                    | —     | NOT NULL                   |             |
| is_active           | is_active           | boolean                  | —     | NOT NULL                   |             |
| activated_at        | activated_at        | timestamp with time zone | —     |                            |             |
| activated_by        | activated_by        | text                     | —     |                            |             |
| created_at          | created_at          | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_import_mapping_version_lookup` (tenant_connector_id, profile_id, is_active) [btree]

### `import_row`

> _⚠ pending annotation_

| Column        | Business Name | Type                     | Class | Constraints                | Description |
| :------------ | :------------ | :----------------------- | :---- | :------------------------- | :---------- |
| row_id        | row_id        | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id     | tenant_id     | uuid                     | —     | NOT NULL                   |             |
| batch_id      | batch_id      | uuid                     | —     | NOT NULL                   |             |
| target_entity | target_entity | text                     | —     | NOT NULL                   |             |
| payload       | payload       | jsonb                    | —     | NOT NULL                   |             |
| status        | status        | text                     | —     | NOT NULL, DEFAULT pending  |             |
| error_detail  | error_detail  | jsonb                    | —     |                            |             |
| posted_at     | posted_at     | timestamp with time zone | —     |                            |             |

> CHECK `import_row_status_check`: [object Object]

### `incoterm`

> _⚠ pending annotation_

| Column      | Business Name | Type                     | Class | Constraints                | Description |
| :---------- | :------------ | :----------------------- | :---- | :------------------------- | :---------- |
| incoterm_id | incoterm_id   | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| code        | code          | char(3)                  | —     | NOT NULL                   |             |
| name        | name          | text                     | —     | NOT NULL                   |             |
| created_at  | created_at    | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `incoterm_code_key` (code) [btree]

### `industry`

> _⚠ pending annotation_

| Column            | Business Name     | Type                     | Class | Constraints                | Description |
| :---------------- | :---------------- | :----------------------- | :---- | :------------------------- | :---------- |
| industry_id       | industry_id       | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id         | tenant_id         | uuid                     | —     | NOT NULL                   |             |
| name              | name              | jsonb                    | —     | NOT NULL                   |             |
| archived          | archived          | boolean                  | —     | NOT NULL                   |             |
| created_at        | created_at        | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| custom_attributes | custom_attributes | jsonb                    | —     |                            |             |

> INDEX `idx_industry_tenant` (tenant_id) [btree]

### `inventory_balance`

> _⚠ pending annotation_

| Column                | Business Name         | Type                     | Class | Constraints                | Description |
| :-------------------- | :-------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| inventory_balance_id  | inventory_balance_id  | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id             | tenant_id             | uuid                     | —     | NOT NULL                   |             |
| company_id            | company_id            | uuid                     | —     |                            |             |
| warehouse_id          | warehouse_id          | uuid                     | —     | NOT NULL                   |             |
| article_id            | article_id            | uuid                     | —     | NOT NULL                   |             |
| on_hand_qty           | on_hand_qty           | numeric                  | —     | NOT NULL, DEFAULT 0        |             |
| reserved_qty          | reserved_qty          | numeric                  | —     | NOT NULL, DEFAULT 0        |             |
| as_of_at              | as_of_at              | timestamp with time zone | —     |                            |             |
| created_at            | created_at            | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| available_qty         | available_qty         | numeric                  | —     |                            |             |
| expected_purchase_qty | expected_purchase_qty | numeric                  | —     | NOT NULL, DEFAULT 0        |             |
| gld_purchase          | gld_purchase          | numeric                  | —     |                            |             |
| gld_cost              | gld_cost              | numeric                  | —     |                            |             |

> INDEX `idx_inv_balance_lookup` (tenant_id, warehouse_id, article_id) [btree]
> INDEX `idx_inv_balance_tenant` (tenant_id) [btree]

### `inventory_movement`

> _⚠ pending annotation_

| Column                  | Business Name           | Type                     | Class | Constraints                | Description |
| :---------------------- | :---------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| inventory_movement_id   | inventory_movement_id   | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id               | tenant_id               | uuid                     | —     | NOT NULL                   |             |
| company_id              | company_id              | uuid                     | —     |                            |             |
| warehouse_id            | warehouse_id            | uuid                     | —     | NOT NULL                   |             |
| article_id              | article_id              | uuid                     | —     | NOT NULL                   |             |
| movement_type           | movement_type           | char(1)                  | —     | NOT NULL                   |             |
| qty_delta               | qty_delta               | numeric                  | —     |                            |             |
| movement_date           | movement_date           | timestamp with time zone | —     | NOT NULL                   |             |
| source_document_id      | source_document_id      | uuid                     | —     |                            |             |
| source_document_line_id | source_document_line_id | uuid                     | —     |                            |             |
| created_at              | created_at              | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| transaction_id          | transaction_id          | uuid                     | —     |                            |             |
| absolute_qty            | absolute_qty            | numeric                  | —     |                            |             |
| reference_text          | reference_text          | text                     | —     |                            |             |
| serial_number_id        | serial_number_id        | uuid                     | —     |                            |             |
| batch_no                | batch_no                | text                     | —     |                            |             |

> INDEX `idx_inv_movement_date` (tenant_id, movement_date) [btree]
> INDEX `idx_inv_movement_inventory_anchor` (tenant_id, warehouse_id, article_id, movement_date) [btree]
> INDEX `idx_inv_movement_lookup` (tenant_id, warehouse_id, article_id, movement_date) [btree]
> INDEX `idx_inv_movement_tenant` (tenant_id) [btree]
> INDEX `idx_inv_movement_tx` (tenant_id, transaction_id) [btree]
> INDEX `idx_inv_movement_warehouse_article` (tenant_id, warehouse_id, article_id) [btree]
> INDEX `idx_inventory_movement_batch_balance` (tenant_id, warehouse_id, article_id, batch_no) [btree]

> CHECK `chk_inventory_movement_qty_logic`: [object Object]
> CHECK `chk_inventory_movement_type`: [object Object]

### `journal_entry`

> _⚠ pending annotation_

| Column             | Business Name      | Type                     | Class | Constraints                | Description |
| :----------------- | :----------------- | :----------------------- | :---- | :------------------------- | :---------- |
| journal_entry_id   | journal_entry_id   | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id          | tenant_id          | uuid                     | —     | NOT NULL                   |             |
| company_id         | company_id         | uuid                     | —     | NOT NULL                   |             |
| posting_date       | posting_date       | date                     | —     | NOT NULL                   |             |
| source_document_id | source_document_id | uuid                     | —     |                            |             |
| description        | description        | text                     | —     |                            |             |
| created_at         | created_at         | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_journal_entry_company` (tenant_id, company_id) [btree]
> INDEX `idx_journal_entry_date` (tenant_id, posting_date) [btree]
> INDEX `idx_journal_entry_document` (source_document_id) [btree]
> INDEX `idx_journal_entry_tenant` (tenant_id) [btree]

### `journal_line`

> _⚠ pending annotation_

| Column           | Business Name    | Type                     | Class | Constraints                | Description |
| :--------------- | :--------------- | :----------------------- | :---- | :------------------------- | :---------- |
| journal_line_id  | journal_line_id  | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id        | tenant_id        | uuid                     | —     | NOT NULL                   |             |
| company_id       | company_id       | uuid                     | —     | NOT NULL                   |             |
| journal_entry_id | journal_entry_id | uuid                     | —     | NOT NULL                   |             |
| gl_account_id    | gl_account_id    | uuid                     | —     | NOT NULL                   |             |
| debit_amount     | debit_amount     | numeric                  | —     | NOT NULL, DEFAULT 0        |             |
| credit_amount    | credit_amount    | numeric                  | —     | NOT NULL, DEFAULT 0        |             |
| cost_center_id   | cost_center_id   | uuid                     | —     |                            |             |
| tax_code_id      | tax_code_id      | uuid                     | —     |                            |             |
| created_at       | created_at       | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_journal_line_account` (gl_account_id) [btree]
> INDEX `idx_journal_line_entry` (journal_entry_id) [btree]
> INDEX `idx_journal_line_tenant` (tenant_id) [btree]

> CHECK `chk_debit_or_credit`: [object Object]

### `metadata_history`

> _⚠ pending annotation_

| Column        | Business Name | Type                     | Class | Constraints                | Description |
| :------------ | :------------ | :----------------------- | :---- | :------------------------- | :---------- |
| history_id    | history_id    | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id     | tenant_id     | uuid                     | —     |                            |             |
| user_id       | user_id       | text                     | —     |                            |             |
| entity_name   | entity_name   | text                     | —     | NOT NULL                   |             |
| metadata_type | metadata_type | text                     | —     | NOT NULL                   |             |
| metadata_key  | metadata_key  | text                     | —     | NOT NULL                   |             |
| old_value     | old_value     | jsonb                    | —     |                            |             |
| new_value     | new_value     | jsonb                    | —     |                            |             |
| change_type   | change_type   | text                     | —     | NOT NULL                   |             |
| created_at    | created_at    | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_metadata_history_entity` (entity_name) [btree]
> INDEX `idx_metadata_history_tenant` (tenant_id) [btree]

### `modules`

> _⚠ pending annotation_

| Column    | Business Name | Type  | Class | Constraints                | Description |
| :-------- | :------------ | :---- | :---- | :------------------------- | :---------- |
| module_id | module_id     | uuid  | PK    | NOT NULL, DEFAULT uuidv7() |             |
| slug      | slug          | text  | —     | NOT NULL                   |             |
| label     | label         | jsonb | —     | NOT NULL                   |             |

> INDEX `modules_slug_key` (slug) [btree]

### `number_sequence`

> _⚠ pending annotation_

| Column             | Business Name      | Type                     | Class | Constraints                | Description |
| :----------------- | :----------------- | :----------------------- | :---- | :------------------------- | :---------- |
| number_sequence_id | number_sequence_id | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id          | tenant_id          | uuid                     | —     | NOT NULL                   |             |
| company_id         | company_id         | uuid                     | —     | NOT NULL                   |             |
| prefix             | prefix             | varchar(10)              | —     | NOT NULL                   |             |
| fiscal_year        | fiscal_year        | integer                  | —     |                            |             |
| next_value         | next_value         | integer                  | —     | NOT NULL, DEFAULT 1        |             |
| padding            | padding            | integer                  | —     | NOT NULL, DEFAULT 5        |             |
| archived           | archived           | boolean                  | —     | NOT NULL                   |             |
| created_at         | created_at         | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| updated_at         | updated_at         | timestamp with time zone | —     |                            |             |

> INDEX `idx_number_sequence_tenant` (tenant_id) [btree]
> INDEX `idx_number_sequence_tenant_company` (tenant_id, company_id) [btree]

### `organization`

> _⚠ pending annotation_

| Column          | Business Name   | Type                     | Class | Constraints                | Description |
| :-------------- | :-------------- | :----------------------- | :---- | :------------------------- | :---------- |
| organization_id | organization_id | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| slug            | slug            | varchar(63)              | —     | NOT NULL                   |             |
| name            | name            | text                     | —     | NOT NULL                   |             |
| is_active       | is_active       | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| archived        | archived        | boolean                  | —     | NOT NULL                   |             |
| created_at      | created_at      | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `organization_slug_key` (slug) [btree]

### `payment_term`

> _⚠ pending annotation_

| Column              | Business Name       | Type                     | Class | Constraints                | Description |
| :------------------ | :------------------ | :----------------------- | :---- | :------------------------- | :---------- |
| payment_term_id     | payment_term_id     | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id           | tenant_id           | uuid                     | —     | NOT NULL                   |             |
| name                | name                | jsonb                    | —     | NOT NULL                   |             |
| net_days            | net_days            | integer                  | —     | NOT NULL                   |             |
| discount_days       | discount_days       | integer                  | —     |                            |             |
| discount_percentage | discount_percentage | numeric                  | —     |                            |             |
| archived            | archived            | boolean                  | —     | NOT NULL                   |             |
| created_at          | created_at          | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| custom_attributes   | custom_attributes   | jsonb                    | —     |                            |             |

> INDEX `idx_payment_term_tenant` (tenant_id) [btree]

### `postal_code`

> _⚠ pending annotation_

| Column         | Business Name  | Type                     | Class | Constraints                | Description |
| :------------- | :------------- | :----------------------- | :---- | :------------------------- | :---------- |
| postal_code_id | postal_code_id | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| country_code   | country_code   | varchar(2)               | —     | NOT NULL                   |             |
| plz            | plz            | text                     | —     | NOT NULL                   |             |
| city           | city           | text                     | —     | NOT NULL                   |             |
| state          | state          | text                     | —     |                            |             |
| archived       | archived       | boolean                  | —     | NOT NULL                   |             |
| created_at     | created_at     | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_postal_code_lookup` (country_code, plz) [btree]

### `price_list`

> _⚠ pending annotation_

| Column        | Business Name | Type                     | Class | Constraints                | Description |
| :------------ | :------------ | :----------------------- | :---- | :------------------------- | :---------- |
| price_list_id | price_list_id | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id     | tenant_id     | uuid                     | —     | NOT NULL                   |             |
| name          | name          | text                     | —     | NOT NULL                   |             |
| currency_id   | currency_id   | char(3)                  | —     | NOT NULL                   |             |
| is_net        | is_net        | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| archived      | archived      | boolean                  | —     | NOT NULL                   |             |
| created_at    | created_at    | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_price_list_tenant` (tenant_id) [btree]

### `price_list_item`

> _⚠ pending annotation_

| Column             | Business Name      | Type                     | Class | Constraints                | Description |
| :----------------- | :----------------- | :----------------------- | :---- | :------------------------- | :---------- |
| price_list_item_id | price_list_item_id | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id          | tenant_id          | uuid                     | —     | NOT NULL                   |             |
| price_list_id      | price_list_id      | uuid                     | —     | NOT NULL                   |             |
| article_id         | article_id         | uuid                     | —     | NOT NULL                   |             |
| price              | price              | numeric                  | —     | NOT NULL                   |             |
| valid_from         | valid_from         | date                     | —     |                            |             |
| valid_to           | valid_to           | date                     | —     |                            |             |
| created_at         | created_at         | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_price_list_item_lookup` (price_list_id, article_id, valid_from) [btree]
> INDEX `idx_price_list_item_tenant` (tenant_id) [btree]

### `production_order`

> _⚠ pending annotation_

| Column              | Business Name       | Type                     | Class | Constraints                | Description |
| :------------------ | :------------------ | :----------------------- | :---- | :------------------------- | :---------- |
| production_order_id | production_order_id | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id           | tenant_id           | uuid                     | —     | NOT NULL                   |             |
| company_id          | company_id          | uuid                     | —     |                            |             |
| order_no            | order_no            | varchar(50)              | —     | NOT NULL                   |             |
| article_id          | article_id          | uuid                     | —     |                            |             |
| quantity            | quantity            | integer                  | —     | NOT NULL                   |             |
| status              | status              | varchar(20)              | —     | NOT NULL, DEFAULT planned  |             |
| planned_start_date  | planned_start_date  | date                     | —     |                            |             |
| planned_end_date    | planned_end_date    | date                     | —     |                            |             |
| actual_start_date   | actual_start_date   | date                     | —     |                            |             |
| actual_end_date     | actual_end_date     | date                     | —     |                            |             |
| archived            | archived            | boolean                  | —     | NOT NULL                   |             |
| created_at          | created_at          | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| updated_at          | updated_at          | timestamp with time zone | —     |                            |             |

> INDEX `idx_production_order_article` (article_id) [btree]
> INDEX `idx_production_order_status` (status) [btree]
> INDEX `idx_production_order_tenant` (tenant_id) [btree]

### `schema_annotations`

> _⚠ pending annotation_

| Column          | Business Name   | Type                     | Class | Constraints                | Description |
| :-------------- | :-------------- | :----------------------- | :---- | :------------------------- | :---------- |
| id              | id              | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| table_name      | table_name      | text                     | —     | NOT NULL                   |             |
| column_name     | column_name     | text                     | —     | NOT NULL                   |             |
| business_name   | business_name   | text                     | —     | NOT NULL                   |             |
| description     | description     | text                     | —     | NOT NULL                   |             |
| data_class      | data_class      | text                     | —     | NOT NULL                   |             |
| module_id       | module_id       | uuid                     | —     |                            |             |
| mandatory_for   | mandatory_for   | jsonb                    | —     | NOT NULL, DEFAULT          |             |
| locked_for      | locked_for      | jsonb                    | —     | NOT NULL, DEFAULT          |             |
| ai_generated_at | ai_generated_at | timestamp with time zone | —     |                            |             |
| human_override  | human_override  | boolean                  | —     | NOT NULL                   |             |

### `serial_number`

> _⚠ pending annotation_

| Column               | Business Name        | Type                     | Class | Constraints                | Description |
| :------------------- | :------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| serial_number_id     | serial_number_id     | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id            | tenant_id            | uuid                     | —     | NOT NULL                   |             |
| article_id           | article_id           | uuid                     | —     | NOT NULL                   |             |
| serial_no            | serial_no            | text                     | —     | NOT NULL                   |             |
| status               | status               | text                     | —     | NOT NULL, DEFAULT in_stock |             |
| created_movement_id  | created_movement_id  | uuid                     | —     |                            |             |
| consumed_movement_id | consumed_movement_id | uuid                     | —     |                            |             |
| created_at           | created_at           | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> CHECK `serial_number_status_check`: [object Object]

### `session`

> _⚠ pending annotation_

| Column     | Business Name | Type                     | Class | Constraints             | Description |
| :--------- | :------------ | :----------------------- | :---- | :---------------------- | :---------- |
| id         | id            | text                     | PK    | NOT NULL                |             |
| expires_at | expires_at    | timestamp with time zone | —     | NOT NULL                |             |
| token      | token         | text                     | —     | NOT NULL                |             |
| created_at | created_at    | timestamp with time zone | —     | NOT NULL, DEFAULT now() |             |
| updated_at | updated_at    | timestamp with time zone | —     | NOT NULL, DEFAULT now() |             |
| ip_address | ip_address    | text                     | —     |                         |             |
| user_agent | user_agent    | text                     | —     |                         |             |
| user_id    | user_id       | text                     | —     | NOT NULL                |             |

> INDEX `session_userId_idx` (user_id) [btree]

### `shipping_method`

> _⚠ pending annotation_

| Column                | Business Name         | Type                     | Class | Constraints                | Description |
| :-------------------- | :-------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| shipping_method_id    | shipping_method_id    | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id             | tenant_id             | uuid                     | —     | NOT NULL                   |             |
| name                  | name                  | jsonb                    | —     | NOT NULL                   |             |
| tracking_url_template | tracking_url_template | text                     | —     |                            |             |
| archived              | archived              | boolean                  | —     | NOT NULL                   |             |
| created_at            | created_at            | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| custom_attributes     | custom_attributes     | jsonb                    | —     |                            |             |

> INDEX `idx_shipping_method_tenant` (tenant_id) [btree]

### `system_settings`

> _⚠ pending annotation_

| Column          | Business Name   | Type                     | Class | Constraints                | Description |
| :-------------- | :-------------- | :----------------------- | :---- | :------------------------- | :---------- |
| setting_id      | setting_id      | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| scope           | scope           | text                     | —     | NOT NULL                   |             |
| organization_id | organization_id | uuid                     | —     |                            |             |
| tenant_id       | tenant_id       | uuid                     | —     |                            |             |
| key             | key             | text                     | —     | NOT NULL                   |             |
| value           | value           | jsonb                    | —     | NOT NULL                   |             |
| created_at      | created_at      | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| updated_at      | updated_at      | timestamp with time zone | —     |                            |             |

### `tax_class`

> _⚠ pending annotation_

| Column            | Business Name     | Type                     | Class | Constraints                | Description |
| :---------------- | :---------------- | :----------------------- | :---- | :------------------------- | :---------- |
| tax_class_id      | tax_class_id      | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id         | tenant_id         | uuid                     | —     | NOT NULL                   |             |
| code              | code              | text                     | —     | NOT NULL                   |             |
| name              | name              | jsonb                    | —     | NOT NULL                   |             |
| archived          | archived          | boolean                  | —     | NOT NULL                   |             |
| created_at        | created_at        | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| custom_attributes | custom_attributes | jsonb                    | —     |                            |             |

> INDEX `idx_tax_class_tenant` (tenant_id) [btree]

### `tax_code`

> _⚠ pending annotation_

| Column      | Business Name | Type                     | Class | Constraints                | Description |
| :---------- | :------------ | :----------------------- | :---- | :------------------------- | :---------- |
| tax_code_id | tax_code_id   | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id   | tenant_id     | uuid                     | —     | NOT NULL                   |             |
| code        | code          | text                     | —     | NOT NULL                   |             |
| description | description   | text                     | —     |                            |             |
| tax_rate    | tax_rate      | numeric                  | —     | NOT NULL                   |             |
| archived    | archived      | boolean                  | —     | NOT NULL                   |             |
| created_at  | created_at    | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_tax_code_tenant` (tenant_id) [btree]

### `tax_rule`

> _⚠ pending annotation_

| Column                | Business Name         | Type                     | Class | Constraints                | Description |
| :-------------------- | :-------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| tax_rule_id           | tax_rule_id           | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id             | tenant_id             | uuid                     | —     | NOT NULL                   |             |
| customer_tax_class_id | customer_tax_class_id | uuid                     | —     |                            |             |
| article_tax_class_id  | article_tax_class_id  | uuid                     | —     |                            |             |
| country_code          | country_code          | char(2)                  | —     |                            |             |
| tax_code_id           | tax_code_id           | uuid                     | —     | NOT NULL                   |             |
| valid_from            | valid_from            | date                     | —     | NOT NULL                   |             |
| valid_to              | valid_to              | date                     | —     |                            |             |
| created_at            | created_at            | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_tax_rule_lookup` (tenant_id, customer_tax_class_id, article_tax_class_id, country_code, valid_from) [btree]
> INDEX `idx_tax_rule_tenant` (tenant_id) [btree]

### `tenant`

> _⚠ pending annotation_

| Column          | Business Name   | Type                     | Class | Constraints                | Description |
| :-------------- | :-------------- | :----------------------- | :---- | :------------------------- | :---------- |
| tenant_id       | tenant_id       | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| organization_id | organization_id | uuid                     | —     | NOT NULL                   |             |
| slug            | slug            | varchar(63)              | —     | NOT NULL                   |             |
| name            | name            | text                     | —     | NOT NULL                   |             |
| is_base         | is_base         | boolean                  | —     | NOT NULL                   |             |
| is_active       | is_active       | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| archived        | archived        | boolean                  | —     | NOT NULL                   |             |
| created_at      | created_at      | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_tenant_organization` (organization_id) [btree]
> INDEX `tenant_slug_key` (slug) [btree]
> INDEX `uq_single_base_tenant` (is_base) [btree]

### `tenant_connector`

> _⚠ pending annotation_

| Column              | Business Name       | Type                     | Class | Constraints                       | Description |
| :------------------ | :------------------ | :----------------------- | :---- | :-------------------------------- | :---------- |
| tenant_connector_id | tenant_connector_id | uuid                     | PK    | NOT NULL, DEFAULT uuidv7()        |             |
| tenant_id           | tenant_id           | uuid                     | —     | NOT NULL                          |             |
| connector_id        | connector_id        | uuid                     | —     | NOT NULL                          |             |
| credentials         | credentials         | jsonb                    | —     | NOT NULL, DEFAULT [object Object] |             |
| is_active           | is_active           | boolean                  | —     | NOT NULL, DEFAULT true            |             |
| archived            | archived            | boolean                  | —     | NOT NULL                          |             |
| created_at          | created_at          | timestamp with time zone | —     | NOT NULL, DEFAULT now()           |             |
| updated_at          | updated_at          | timestamp with time zone | —     | NOT NULL, DEFAULT now()           |             |

### `tenant_connector_mapping`

> _⚠ pending annotation_

| Column              | Business Name       | Type  | Class | Constraints                       | Description |
| :------------------ | :------------------ | :---- | :---- | :-------------------------------- | :---------- |
| mapping_id          | mapping_id          | uuid  | PK    | NOT NULL, DEFAULT uuidv7()        |             |
| tenant_id           | tenant_id           | uuid  | —     | NOT NULL                          |             |
| tenant_connector_id | tenant_connector_id | uuid  | —     | NOT NULL                          |             |
| profile_id          | profile_id          | uuid  | —     | NOT NULL                          |             |
| source_field        | source_field        | text  | —     | NOT NULL                          |             |
| target_table        | target_table        | text  | —     | NOT NULL                          |             |
| target_column       | target_column       | text  | —     | NOT NULL                          |             |
| transform           | transform           | jsonb | —     | NOT NULL, DEFAULT [object Object] |             |
| default_value       | default_value       | jsonb | —     |                                   |             |

### `tenant_fields`

> _⚠ pending annotation_

| Column            | Business Name     | Type                     | Class | Constraints                | Description |
| :---------------- | :---------------- | :----------------------- | :---- | :------------------------- | :---------- |
| field_id          | field_id          | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| scope             | scope             | text                     | —     | NOT NULL, DEFAULT tenant   |             |
| organization_id   | organization_id   | uuid                     | —     |                            |             |
| tenant_id         | tenant_id         | uuid                     | —     |                            |             |
| entity_name       | entity_name       | text                     | —     | NOT NULL                   |             |
| field_name        | field_name        | text                     | —     | NOT NULL                   |             |
| field_type        | field_type        | text                     | —     | NOT NULL                   |             |
| is_required       | is_required       | boolean                  | —     | NOT NULL                   |             |
| custom_attributes | custom_attributes | jsonb                    | —     |                            |             |
| created_at        | created_at        | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| label             | label             | jsonb                    | —     |                            |             |
| help_text         | help_text         | jsonb                    | —     |                            |             |
| is_visible        | is_visible        | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| display_order     | display_order     | integer                  | —     |                            |             |
| import_column     | import_column     | text                     | —     |                            |             |
| import_type       | import_type       | text                     | —     |                            |             |
| import_required   | import_required   | boolean                  | —     | NOT NULL                   |             |
| import_transform  | import_transform  | text                     | —     |                            |             |
| group_id          | group_id          | text                     | —     |                            |             |
| lookup_table      | lookup_table      | text                     | —     |                            |             |
| lookup_filter     | lookup_filter     | jsonb                    | —     |                            |             |

> INDEX `uq_fields_global` (entity_name, field_name) [btree]
> INDEX `uq_fields_org` (organization_id, entity_name, field_name) [btree]
> INDEX `uq_fields_tenant` (tenant_id, entity_name, field_name) [btree]

### `tenant_groups`

> _⚠ pending annotation_

| Column            | Business Name     | Type                     | Class | Constraints                | Description |
| :---------------- | :---------------- | :----------------------- | :---- | :------------------------- | :---------- |
| group_id          | group_id          | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| scope             | scope             | text                     | —     | NOT NULL, DEFAULT tenant   |             |
| organization_id   | organization_id   | uuid                     | —     |                            |             |
| tenant_id         | tenant_id         | uuid                     | —     |                            |             |
| entity_name       | entity_name       | text                     | —     | NOT NULL                   |             |
| group_key         | group_key         | text                     | —     | NOT NULL                   |             |
| label             | label             | jsonb                    | —     | NOT NULL                   |             |
| display_order     | display_order     | integer                  | —     | NOT NULL                   |             |
| is_visible        | is_visible        | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| custom_attributes | custom_attributes | jsonb                    | —     |                            |             |
| created_at        | created_at        | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `uq_groups_global` (entity_name, group_key) [btree]
> INDEX `uq_groups_org` (organization_id, entity_name, group_key) [btree]
> INDEX `uq_groups_tenant` (tenant_id, entity_name, group_key) [btree]

### `tenant_layouts`

> _⚠ pending annotation_

| Column            | Business Name     | Type                     | Class | Constraints                | Description |
| :---------------- | :---------------- | :----------------------- | :---- | :------------------------- | :---------- |
| layout_id         | layout_id         | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| scope             | scope             | text                     | —     | NOT NULL, DEFAULT tenant   |             |
| organization_id   | organization_id   | uuid                     | —     |                            |             |
| tenant_id         | tenant_id         | uuid                     | —     |                            |             |
| entity_name       | entity_name       | text                     | —     | NOT NULL                   |             |
| layout_key        | layout_key        | text                     | —     | NOT NULL                   |             |
| layout_definition | layout_definition | jsonb                    | —     | NOT NULL                   |             |
| created_at        | created_at        | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `uq_layouts_global` (entity_name, layout_key) [btree]
> INDEX `uq_layouts_org` (organization_id, entity_name, layout_key) [btree]
> INDEX `uq_layouts_tenant` (tenant_id, entity_name, layout_key) [btree]

### `tenant_llm_config`

> _⚠ pending annotation_

| Column               | Business Name        | Type                     | Class | Constraints                | Description |
| :------------------- | :------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| tenant_llm_config_id | tenant_llm_config_id | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id            | tenant_id            | uuid                     | —     | NOT NULL                   |             |
| company_id           | company_id           | uuid                     | —     | NOT NULL                   |             |
| provider             | provider             | text                     | —     |                            |             |
| endpoint_url         | endpoint_url         | text                     | —     |                            |             |
| model                | model                | text                     | —     |                            |             |
| api_key              | api_key              | text                     | —     |                            |             |
| github_token         | github_token         | text                     | —     |                            |             |
| github_repo          | github_repo          | text                     | —     |                            |             |
| vertex_credentials   | vertex_credentials   | text                     | —     |                            |             |
| vertex_project       | vertex_project       | text                     | —     |                            |             |
| vertex_location      | vertex_location      | text                     | —     |                            |             |
| is_active            | is_active            | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| created_at           | created_at           | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| updated_at           | updated_at           | timestamp with time zone | —     |                            |             |

> INDEX `idx_tenant_llm_config_tenant` (tenant_id) [btree]

### `tenant_rules`

> _⚠ pending annotation_

| Column          | Business Name   | Type                     | Class | Constraints                | Description |
| :-------------- | :-------------- | :----------------------- | :---- | :------------------------- | :---------- |
| rule_id         | rule_id         | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| scope           | scope           | text                     | —     | NOT NULL, DEFAULT tenant   |             |
| organization_id | organization_id | uuid                     | —     |                            |             |
| tenant_id       | tenant_id       | uuid                     | —     |                            |             |
| entity_name     | entity_name     | text                     | —     | NOT NULL                   |             |
| hook_name       | hook_name       | text                     | —     | NOT NULL                   |             |
| rule_state      | rule_state      | text                     | —     | NOT NULL, DEFAULT draft    |             |
| rule_definition | rule_definition | jsonb                    | —     | NOT NULL                   |             |
| created_at      | created_at      | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| rule_source     | rule_source     | text                     | —     |                            |             |

### `unit`

> _⚠ pending annotation_

| Column            | Business Name     | Type                     | Class | Constraints                | Description |
| :---------------- | :---------------- | :----------------------- | :---- | :------------------------- | :---------- |
| unit_id           | unit_id           | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id         | tenant_id         | uuid                     | —     | NOT NULL                   |             |
| code              | code              | varchar(10)              | —     | NOT NULL                   |             |
| name              | name              | jsonb                    | —     | NOT NULL                   |             |
| archived          | archived          | boolean                  | —     | NOT NULL                   |             |
| created_at        | created_at        | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| custom_attributes | custom_attributes | jsonb                    | —     |                            |             |

> INDEX `idx_unit_tenant` (tenant_id) [btree]

### `user`

> _⚠ pending annotation_

| Column          | Business Name   | Type                     | Class | Constraints             | Description |
| :-------------- | :-------------- | :----------------------- | :---- | :---------------------- | :---------- |
| id              | id              | text                     | PK    | NOT NULL                |             |
| name            | name            | text                     | —     | NOT NULL                |             |
| email           | email           | text                     | —     | NOT NULL                |             |
| email_verified  | email_verified  | boolean                  | —     | NOT NULL                |             |
| image           | image           | text                     | —     |                         |             |
| created_at      | created_at      | timestamp with time zone | —     | NOT NULL, DEFAULT now() |             |
| updated_at      | updated_at      | timestamp with time zone | —     | NOT NULL, DEFAULT now() |             |
| display_name    | display_name    | text                     | —     |                         |             |
| is_active       | is_active       | boolean                  | —     | NOT NULL, DEFAULT true  |             |
| last_company_id | last_company_id | text                     | —     |                         |             |
| is_system_admin | is_system_admin | boolean                  | —     | NOT NULL                |             |
| locale          | locale          | varchar(5)               | —     | NOT NULL, DEFAULT de    |             |

### `user_tenant`

> _⚠ pending annotation_

| Column    | Business Name | Type | Class | Constraints                | Description |
| :-------- | :------------ | :--- | :---- | :------------------------- | :---------- |
| id        | id            | uuid | PK    | NOT NULL, DEFAULT uuidv7() |             |
| user_id   | user_id       | text | —     | NOT NULL                   |             |
| tenant_id | tenant_id     | uuid | —     | NOT NULL                   |             |
| role      | role          | text | —     | NOT NULL                   |             |

> INDEX `idx_user_tenant_tenant` (tenant_id) [btree]
> INDEX `idx_user_tenant_user` (user_id) [btree]

### `verification`

> _⚠ pending annotation_

| Column     | Business Name | Type                     | Class | Constraints             | Description |
| :--------- | :------------ | :----------------------- | :---- | :---------------------- | :---------- |
| id         | id            | text                     | PK    | NOT NULL                |             |
| identifier | identifier    | text                     | —     | NOT NULL                |             |
| value      | value         | text                     | —     | NOT NULL                |             |
| expires_at | expires_at    | timestamp with time zone | —     | NOT NULL                |             |
| created_at | created_at    | timestamp with time zone | —     | NOT NULL, DEFAULT now() |             |
| updated_at | updated_at    | timestamp with time zone | —     | NOT NULL, DEFAULT now() |             |

> INDEX `verification_identifier_idx` (identifier) [btree]

### `warehouse`

> _⚠ pending annotation_

| Column       | Business Name | Type                     | Class | Constraints                | Description |
| :----------- | :------------ | :----------------------- | :---- | :------------------------- | :---------- |
| warehouse_id | warehouse_id  | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id    | tenant_id     | uuid                     | —     | NOT NULL                   |             |
| company_id   | company_id    | uuid                     | —     |                            |             |
| code         | code          | text                     | —     | NOT NULL                   |             |
| name         | name          | text                     | —     | NOT NULL                   |             |
| archived     | archived      | boolean                  | —     | NOT NULL                   |             |
| created_at   | created_at    | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_warehouse_tenant` (tenant_id) [btree]
