import "dotenv/config";
import { db } from "../index";
import { tenantFields } from "../schema/app.schema";

async function main() {
  console.log("Seeding global metadata...");

  // Addresses
  await db.insert(tenantFields).values([
    {
      entityName: "address",
      fieldName: "addressNo",
      scope: "global",
      label: { en: "No.", de: "Nr." },
      fieldType: "text",
      isVisible: true,
    },
    {
      entityName: "address",
      fieldName: "companyName",
      scope: "global",
      label: { en: "Name", de: "Name" },
      fieldType: "text",
      isVisible: true,
    },
    {
      entityName: "address",
      fieldName: "city",
      scope: "global",
      label: { en: "City", de: "Stadt" },
      fieldType: "text",
      isVisible: true,
    },
    {
      entityName: "address",
      fieldName: "countryCode",
      scope: "global",
      label: { en: "Country", de: "Land" },
      fieldType: "text",
      isVisible: true,
    },
  ]).onConflictDoNothing();

  // Articles
  await db.insert(tenantFields).values([
    {
      entityName: "article",
      fieldName: "articleNo",
      scope: "global",
      label: { en: "Article No.", de: "Artikel-Nr." },
      fieldType: "text",
      isVisible: true,
    },
    {
      entityName: "article",
      fieldName: "name",
      scope: "global",
      label: { en: "Name", de: "Name" },
      fieldType: "text",
      isVisible: true,
    },
    {
      entityName: "article",
      fieldName: "baseUnit",
      scope: "global",
      label: { en: "Unit", de: "Einheit" },
      fieldType: "text",
      isVisible: true,
    },
  ]).onConflictDoNothing();

  // Documents
  await db.insert(tenantFields).values([
    {
      entityName: "document",
      fieldName: "documentNo",
      scope: "global",
      label: { en: "Doc No.", de: "Beleg-Nr." },
      fieldType: "text",
      isVisible: true,
    },
    {
      entityName: "document",
      fieldName: "documentDate",
      scope: "global",
      label: { en: "Date", de: "Datum" },
      fieldType: "date",
      isVisible: true,
    },
    {
      entityName: "document",
      fieldName: "totalGross",
      scope: "global",
      label: { en: "Total", de: "Gesamt" },
      fieldType: "numeric",
      isVisible: true,
    },
    {
      entityName: "document",
      fieldName: "status",
      scope: "global",
      label: { en: "Status", de: "Status" },
      fieldType: "text",
      isVisible: true,
    },
  ]).onConflictDoNothing();

  console.log("Global metadata seeded.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error seeding:", err);
  process.exit(1);
});
