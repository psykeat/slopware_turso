import { sql } from "drizzle-orm";

import { db } from "../src/index";
import { inventoryBalance } from "../src/schema/app.schema";

async function test() {
  const tenantId = "019e41b9-9173-76d1-913a-ab9201a2f988";
  const warehouseId = "019e41b9-917b-7890-95a3-e56f80858590";
  const articleId = "019e41b9-9212-73d8-89c1-2f6f42af7f09";
  const companyId = "019e41b9-9177-7c3e-9b4c-7ec99bbcfb3e";

  console.log("Cleaning up...");
  await db.delete(inventoryBalance).where(sql`true`);

  console.log("Inserting initial balance -100...");
  await db.insert(inventoryBalance).values({
    tenantId,
    companyId,
    warehouseId,
    articleId,
    onHandQty: "-100",
    reservedQty: "0",
    availableQty: "-100",
    gldPurchase: "10",
    gldCost: "10",
  });

  console.log("Updating with qty=100 (should hit CASE 0)...");
  const qty = 100;
  const lineNetPrice = 1;

  try {
    const query = db
      .insert(inventoryBalance)
      .values({
        tenantId,
        companyId,
        warehouseId,
        articleId,
        onHandQty: String(qty),
        reservedQty: "0",
        availableQty: String(qty),
        gldPurchase: String(lineNetPrice),
        gldCost: String(lineNetPrice),
      })
      .onConflictDoUpdate({
        target: [
          inventoryBalance.tenantId,
          inventoryBalance.warehouseId,
          inventoryBalance.articleId,
        ],
        set: {
          onHandQty: sql`${inventoryBalance.onHandQty} + ${qty}`,
          availableQty: sql`${inventoryBalance.onHandQty} + ${qty} - ${inventoryBalance.reservedQty}`,
          gldPurchase: sql`CASE WHEN (${inventoryBalance.onHandQty} + ${qty}) = 0 THEN 0
            ELSE (COALESCE(${inventoryBalance.gldPurchase}, 0) * ${inventoryBalance.onHandQty} + ${lineNetPrice} * ${qty}) / (${inventoryBalance.onHandQty} + ${qty})
            END`,
        },
      });

    console.log("Executing query...");
    await query;
    console.log("Success!");
  } catch (err) {
    console.error("Failed!", err);
  }

  process.exit(0);
}

test();
