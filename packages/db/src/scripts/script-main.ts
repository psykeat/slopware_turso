import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * True when `moduleUrl` (pass `import.meta.url`) is the script that node/tsx was
 * invoked with directly. Lets a seed script export reusable, tenant-parametric
 * cores AND keep its CLI `main()` — the `main()` only runs on direct execution,
 * never when another module imports the cores (e.g. seed-test-tenant.ts).
 */
export function isScriptEntry(moduleUrl: string): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return path.resolve(entry) === fileURLToPath(moduleUrl);
}
