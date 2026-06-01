import "./load-env";
import { eq } from "drizzle-orm";

import { db } from "../index";
import * as schema from "../schema/app.schema";
import { decryptEmailCredentials } from "../services/email/credential-crypto";
import { GraphProviderAdapter } from "../services/email/graph-provider-adapter";

async function main() {
  console.log("🔍 Inspecting Microsoft Graph folder properties...");
  const accounts = await db
    .select()
    .from(schema.emailAccount)
    .where(eq(schema.emailAccount.provider, "microsoft"));

  if (accounts.length === 0) {
    console.log("❌ No Microsoft account found!");
    return;
  }

  for (const account of accounts) {
    console.log(`\n📧 Account: ${account.primaryEmail}`);
    const adapter = new GraphProviderAdapter();

    const foldersRes = await (adapter as any).request(
      account.credentialsEncrypted,
      "/me/mailFolders?$top=100",
    );

    console.log("Folders raw response items:");
    for (const folder of foldersRes?.value ?? []) {
      console.log(`- DisplayName: "${folder.displayName}"`);
      console.log(`  ID: ${folder.id}`);
      console.log(`  wellKnownName: ${folder.wellKnownName}`);
      console.log(`  parentFolderId: ${folder.parentFolderId}`);
      console.log("---");
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
