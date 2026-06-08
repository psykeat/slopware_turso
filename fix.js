const fs = require("fs");
const path = "packages/db/migrations/20260608132143_nebulous_demogoblin/migration.sql";
let sql = fs.readFileSync(path, "utf8");

// The tables that were already created in curved_nightshade
const tablesToRemove = ["article_category", "article_media", "category", "media_asset"];

// Remove CREATE TABLE blocks
for (const t of tablesToRemove) {
  const regex = new RegExp(
    `CREATE TABLE "${t}" \\([\\s\\S]*?\\);\\n--> statement-breakpoint\\n`,
    "g",
  );
  sql = sql.replace(regex, "");
}

// Remove CREATE INDEX blocks for these tables
for (const t of tablesToRemove) {
  const regex = new RegExp(`CREATE INDEX .*? ON "${t}" .*?;\\n--> statement-breakpoint\\n`, "g");
  sql = sql.replace(regex, "");
}

// Remove ALTER TABLE ... ADD CONSTRAINT for these tables
for (const t of tablesToRemove) {
  const regex = new RegExp(
    `ALTER TABLE "${t}" ADD CONSTRAINT .*?;(?:\\n--> statement-breakpoint\\n)?`,
    "g",
  );
  sql = sql.replace(regex, "");
}

fs.writeFileSync(path, sql);
