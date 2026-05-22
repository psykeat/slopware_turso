import { DataService } from "../services/data";
import { getTenantContextById } from "../services/tenant";

async function main() {
  const tenantId = "019e2889-5cd7-714b-9922-08a75fdfbaac";
  console.log("Checking tenant context for tenant ID:", tenantId);
  const context = await getTenantContextById(tenantId);
  console.log("Context:", context);

  const service = new DataService(tenantId, false);
  console.log("Listing countries via DataService...");
  const result = await service.list("country", {}, { limit: 5 });
  console.log(
    "DataService.list('country') result length:",
    Array.isArray(result) ? result.length : (result as any).data?.length,
  );
  console.log("Sample result:", JSON.stringify(result, null, 2));
}

main().catch(console.error);
