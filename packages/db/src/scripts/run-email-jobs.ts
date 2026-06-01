import "./load-env";
import { EmailJobService } from "../services/email/job-service";
import { EmailSyncService } from "../services/email/sync-service";

// Setze feste Umgebungskonstanten
const tenantId = "019e633a-0229-7382-b386-d035d73c8759";
const userId = "t9SWuzFZPDj1YEu13IROi4DRb4aN6BvB";

async function main() {
  console.log("🚀 Starte E-Mail Job-Runner für Tenant:", tenantId);

  const jobService = new EmailJobService(tenantId);
  const syncService = new EmailSyncService(tenantId, userId);
  const workerId = "script-runner";

  let executedCount = 0;
  while (true) {
    const job = await jobService.claimNext(workerId);
    if (!job) {
      console.log("✅ Keine weiteren ausstehenden Jobs in der Warteschlange.");
      break;
    }

    console.log(`\n📦 Verarbeite Job: ${job.jobType} (${job.emailJobId})`);
    console.log(`   - Account: ${job.emailAccountId}`);
    console.log(`   - Idempotency Key: ${job.idempotencyKey}`);

    try {
      const result = await syncService.runJob(job.emailJobId);
      await jobService.complete(job.emailJobId, workerId);
      console.log(`   🎉 Job erfolgreich abgeschlossen!`, result);
      executedCount++;
    } catch (error: any) {
      console.error(`   ❌ Job fehlgeschlagen:`, error.message);
      await jobService.fail(job.emailJobId, error, new Date(Date.now() + 60_000), workerId);
    }
  }

  console.log(`\n🏁 Fertig! Insgesamt ${executedCount} Jobs ausgeführt.`);
}

main().catch((err) => {
  console.error("Fataler Fehler im Job-Runner:", err);
  process.exit(1);
});
