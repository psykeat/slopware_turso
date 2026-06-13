import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// Phase 9 guardrail. The generic /api/data CRUD route was deleted in Phase 5;
// every read/write now goes through the capability runtime. This test fails if
// a direct fetch to that route reappears, so the migration can't silently
// regress. (/api/admin/data is the deliberately kept system-admin exception and
// is allowed.)

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const scanRoots = ["apps/web/src", "packages/ui", "packages/agent/src"];
const skipDirs = new Set(["node_modules", "dist", ".output", "build", ".vite", "coverage"]);
const FORBIDDEN = /fetch\(\s*[`"']\/api\/data\b/;

function walk(dir: string, out: string[]) {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (skipDirs.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
}

test("no direct fetch to the deleted /api/data route remains", () => {
  const files: string[] = [];
  for (const root of scanRoots) walk(join(repoRoot, root), files);
  assert.ok(files.length > 0, "guardrail scanned no files — check scanRoots");

  const offenders = files.filter((file) => FORBIDDEN.test(readFileSync(file, "utf8")));
  assert.deepEqual(
    offenders.map((f) => f.slice(repoRoot.length)),
    [],
    "use the capability runtime (executeCapability / capability() / executeCapability HTTP) instead of fetch(\"/api/data\")",
  );
});
