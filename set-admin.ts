import postgres from "postgres";

async function run() {
  const sql = postgres("postgresql://postgres:bvh9j35v@localhost:5432/slopware");
  console.log("Setting is_system_admin for admin@slopware.dev...");
  const result = await sql`UPDATE "user" SET "is_system_admin" = true WHERE "email" = 'admin@slopware.dev'`;
  console.log("Update result:", result.count);
  await sql.end();
}

run().catch(console.error);
