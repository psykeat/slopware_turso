import "./load-env";
import { db } from "../index";
import { article } from "../schema/app.schema";

const TENANT_ID = "019e633a-0229-7382-b386-d035d73c8759";

const UNITS = [
  "019e633a-02c3-7156-a491-5b14d1b740b9", // license
  "019e633a-02c5-7780-8252-5e3a65401c30", // day
  "019e633a-02c7-7683-b31c-902d691afa0e", // pcs
  "019e6344-9892-7273-9aba-e174c9bbc14e", // pcs
];

const GROUPS = [
  "019e633a-0245-7638-a801-ef405418626d", // Products
  "019e633a-0247-7c05-87b1-67e6110e1a9b", // Services
  "019e633a-0249-7d0f-b908-c4b8a8d90da8", // Raw Materials
  "019e633a-024b-79fc-8b4e-f5d499d1f2a7", // Packaging
];

const TRACKING_MODES = [null, "serial" as const, "batch" as const];

async function main() {
  console.log("Starting import of 1000 articles...");

  const values: any[] = [];
  for (let i = 1; i <= 1000; i++) {
    const num = String(i).padStart(4, "0");
    values.push({
      tenantId: TENANT_ID,
      articleNo: `PERF-${num}`,
      name: `Performance Article #${i}`,
      baseUnitId: UNITS[(i - 1) % UNITS.length],
      salesUnitId: UNITS[(i - 1) % UNITS.length],
      purchaseUnitId: UNITS[(i - 1) % UNITS.length],
      articleGroupId: GROUPS[(i - 1) % GROUPS.length],
      trackingMode: TRACKING_MODES[(i - 1) % TRACKING_MODES.length],
      bomType: "none",
    });
  }

  // Insert in batches of 200 to keep it efficient and safe
  const BATCH_SIZE = 200;
  for (let i = 0; i < values.length; i += BATCH_SIZE) {
    const batch = values.slice(i, i + BATCH_SIZE);
    await db.insert(article).values(batch);
    console.log(`Inserted articles ${i + 1} to ${Math.min(i + BATCH_SIZE, values.length)}`);
  }

  console.log("Successfully imported 1000 articles.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to seed performance articles:", err);
  process.exit(1);
});
