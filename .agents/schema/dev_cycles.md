# Table: `dev_cycles`

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
