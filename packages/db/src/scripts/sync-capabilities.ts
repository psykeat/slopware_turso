import "./load-env";

import { syncEntityCommands } from "../capabilities/sync-entity-commands";
import { closeDb } from "../index";

async function main() {
  const report = await syncEntityCommands();
  console.log("Capability → entity_commands sync report:", JSON.stringify(report));
  await closeDb();
}

main().catch((err) => {
  console.error("Error syncing capabilities:", err);
  process.exit(1);
});
