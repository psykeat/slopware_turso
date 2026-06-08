import "./load-env";
import { closeDb } from "../index";
import { backfillDefaultArticleVariants } from "../services/default-variant-backfill";

async function main() {
  const result = await backfillDefaultArticleVariants();

  console.log(
    [
      `Scanned ${result.candidateArticles} article${result.candidateArticles === 1 ? "" : "s"} without variants.`,
      `Created ${result.createdVariants} default variant${result.createdVariants === 1 ? "" : "s"}.`,
      `Created ${result.createdInventoryItems} inventory item${result.createdInventoryItems === 1 ? "" : "s"}.`,
      `Skipped ${result.skippedArticles} article${result.skippedArticles === 1 ? "" : "s"}.`,
    ].join(" "),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
