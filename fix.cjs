const fs = require("fs");
const path = "packages/db/migrations/20260608132143_nebulous_demogoblin/migration.sql";
let sql = fs.readFileSync(path, "utf8");

// Replace all DROP CONSTRAINT with DROP CONSTRAINT IF EXISTS to avoid errors on non-existent constraints
sql = sql.replace(/DROP CONSTRAINT "(.*?)";/g, 'DROP CONSTRAINT IF EXISTS "$1";');

fs.writeFileSync(path, sql);
