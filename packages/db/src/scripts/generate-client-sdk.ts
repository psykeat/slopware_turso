import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { allCapabilities } from "../capabilities/all";
import { buildAndSerializeClientSdk } from "../capabilities/sdk-build";

const outputPath = fileURLToPath(
  new URL("../../../../apps/web/src/lib/sdk.generated.ts", import.meta.url),
);

const code = buildAndSerializeClientSdk(allCapabilities);
writeFileSync(outputPath, code);

console.log(`Wrote frontend Client SDK: ${outputPath}`);
