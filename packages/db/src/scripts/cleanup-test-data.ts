import "./load-env";
import process from "node:process";

import postgres from "postgres";

/**
 * One-off cleanup of accumulated unit-test pollution against the local dev DB.
 *
 * SAFE filters — test rows are identified ONLY by:
 *   - organization.slug ending in a random hex suffix  (e.g. "cap-org-1a2b3c4d")
 *   - tenant.slug with the same hex suffix, or any tenant under a test org
 *   - user.email under @example.test / @example.com
 *
 * Everything real is preserved: org "base", the @slopware.dev users, and the
 * better-auth auto-orgs ("org-<alnum>") that belong to real users.
 *
 * Default run = REPORT ONLY. Pass --apply to actually delete. The destructive
 * pass runs in one transaction with FK triggers disabled (SET LOCAL
 * session_replication_role = replica), so the 100+ tenant-scoped tables can be
 * cleared without hand-ordering foreign keys. Requires a superuser role.
 */

const TEST_ORG = `slug ~ '-[0-9a-f]{6,}$'`;
const TEST_TENANT = `(slug ~ '-[0-9a-f]{6,}$' or organization_id in (select organization_id from organization where ${TEST_ORG}))`;
const TEST_USER = `email ~ '@example\\.(test|com)$'`;

const IDENT = /^[a-z_][a-z0-9_]*$/;

async function main() {
  const apply = process.argv.includes("--apply");
  const connection = process.env.DATABASE_URL;
  if (!connection) throw new Error("DATABASE_URL is not set.");

  const sql = postgres(connection, { max: 1 });
  try {
    const [{ count: testOrgs }] = await sql.unsafe(
      `select count(*)::int as count from organization where ${TEST_ORG}`,
    );
    const [{ count: testTenants }] = await sql.unsafe(
      `select count(*)::int as count from tenant where ${TEST_TENANT}`,
    );
    const [{ count: testUsers }] = await sql.unsafe(
      `select count(*)::int as count from "user" where ${TEST_USER}`,
    );

    const preservedOrgs = await sql.unsafe(
      `select slug from organization where not (${TEST_ORG}) order by slug`,
    );
    const preservedUsers = await sql.unsafe(
      `select email from "user" where not (${TEST_USER}) order by email`,
    );

    console.log("── Match counts (to delete) ──");
    console.log(`  organizations: ${testOrgs}`);
    console.log(`  tenants:       ${testTenants}`);
    console.log(`  users:         ${testUsers}`);
    console.log("── Preserved (NOT touched) ──");
    console.log(`  orgs:  ${preservedOrgs.map((r) => r.slug).join(", ")}`);
    console.log(`  users: ${preservedUsers.map((r) => r.email).join(", ")}`);

    if (!apply) {
      console.log("\nReport only. Re-run with --apply to delete.");
      return;
    }

    // Resolve concrete id arrays once, then delete everything keyed off them.
    const tenantIds = (
      await sql.unsafe(`select tenant_id from tenant where ${TEST_TENANT}`)
    ).map((r) => r.tenant_id as string);
    const orgIds = (
      await sql.unsafe(`select organization_id from organization where ${TEST_ORG}`)
    ).map((r) => r.organization_id as string);
    const userIds = (await sql.unsafe(`select id from "user" where ${TEST_USER}`)).map(
      (r) => r.id as string,
    );

    const tablesWith = async (column: string, exclude: string[] = []) => {
      const rows = await sql.unsafe(
        `select table_name from information_schema.columns
         where table_schema = 'public' and column_name = '${column}'`,
      );
      return rows
        .map((r) => r.table_name as string)
        .filter((t) => IDENT.test(t) && !exclude.includes(t));
    };

    const tenantTables = await tablesWith("tenant_id", ["tenant"]);
    const userTables = await tablesWith("user_id", ["user"]);
    const orgTables = await tablesWith("organization_id", ["organization", "tenant"]);

    let deleted = 0;
    await sql.begin(async (tx) => {
      await tx.unsafe(`set local session_replication_role = replica`);

      for (const table of tenantTables) {
        const res = await tx.unsafe(
          `delete from "${table}" where tenant_id::text = any($1)`,
          [tenantIds],
        );
        deleted += res.count ?? 0;
      }
      for (const table of userTables) {
        const res = await tx.unsafe(`delete from "${table}" where user_id::text = any($1)`, [
          userIds,
        ]);
        deleted += res.count ?? 0;
      }
      for (const table of orgTables) {
        const res = await tx.unsafe(
          `delete from "${table}" where organization_id::text = any($1)`,
          [orgIds],
        );
        deleted += res.count ?? 0;
      }

      const t = await tx.unsafe(`delete from tenant where tenant_id::text = any($1)`, [tenantIds]);
      const u = await tx.unsafe(`delete from "user" where id::text = any($1)`, [userIds]);
      const o = await tx.unsafe(`delete from organization where organization_id::text = any($1)`, [
        orgIds,
      ]);
      console.log(
        `\nDeleted: ${deleted} dependent rows, ${t.count} tenants, ${u.count} users, ${o.count} organizations.`,
      );
    });
    console.log("Done.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exit(1);
});
