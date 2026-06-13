import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { allCapabilities } from "../capabilities/all";
import {
  buildEntityCapabilityManifest,
  serializeEntityCapabilityManifest,
} from "../capabilities/manifest-build";

// Regenerates packages/db/src/capabilities/manifest.generated.ts from the live
// registry. Run after adding/removing capabilities. A contract test guards
// against drift, so this never needs to be remembered manually.
const outputPath = fileURLToPath(
  new URL("../capabilities/manifest.generated.ts", import.meta.url),
);

const manifest = buildEntityCapabilityManifest(allCapabilities);
writeFileSync(outputPath, serializeEntityCapabilityManifest(manifest));

console.log(
  `Wrote entity capability manifest: ${Object.keys(manifest).length} entities → ${outputPath}`,
);
