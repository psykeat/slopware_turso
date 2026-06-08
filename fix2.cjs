const fs = require("fs");
const path = "packages/db/migrations/20260608132143_nebulous_demogoblin/migration.sql";
let sql = fs.readFileSync(path, "utf8");

// Remove duplicate column additions
sql = sql.replace(
  /ALTER TABLE "article_variant" ADD COLUMN "option_value_hash" text NOT NULL;\\n--> statement-breakpoint\\n/g,
  "",
);

// Remove duplicate constraint additions
sql = sql.replace(
  /ALTER TABLE "article_option" ADD CONSTRAINT "uq_article_option_name" UNIQUE\("tenant_id","article_id","name"\);\\n--> statement-breakpoint\\n/g,
  "",
);
sql = sql.replace(
  /ALTER TABLE "article_option_value" ADD CONSTRAINT "uq_article_option_value" UNIQUE\("tenant_id","option_id","value"\);\\n--> statement-breakpoint\\n/g,
  "",
);
sql = sql.replace(
  /ALTER TABLE "article_variant" ADD CONSTRAINT "uq_article_variant_option_hash" UNIQUE\("tenant_id","article_id","option_value_hash"\);\\n--> statement-breakpoint\\n/g,
  "",
);
sql = sql.replace(
  /ALTER TABLE "inventory_item" ADD CONSTRAINT "uq_inv_item_variant" UNIQUE\("tenant_id","variant_id"\);\\n--> statement-breakpoint\\n/g,
  "",
);
sql = sql.replace(
  /ALTER TABLE "inventory_item" ADD CONSTRAINT "uq_inv_item_sku" UNIQUE\("tenant_id","sku"\);\\n--> statement-breakpoint\\n/g,
  "",
);

fs.writeFileSync(path, sql);
