CREATE TABLE "dev_cycles" (
	"cycle_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"cycle_number" integer NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"slice_fit_score" integer NOT NULL,
	"slice_fit_max" integer NOT NULL,
	"story_coverage" integer NOT NULL,
	"story_coverage_max" integer NOT NULL,
	"tests_added" integer DEFAULT 0 NOT NULL,
	"vp_test_pass" boolean,
	"blocker" text,
	"process_adjustment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
