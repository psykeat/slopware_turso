import "dotenv/config";
import fs from "node:fs/promises";
import process from "node:process";

import postgres from "postgres";

async function readInput(args: string[]) {
  const fileIndex = args.findIndex((arg) => arg === "--file" || arg === "-f");
  if (fileIndex !== -1) {
    const file = args[fileIndex + 1];
    if (!file) {
      throw new Error("Missing file path after --file/-f.");
    }
    return fs.readFile(file, "utf8");
  }

  const inline = args
    .filter((arg) => !arg.startsWith("-"))
    .join(" ")
    .trim();
  if (inline) return inline;

  if (!process.stdin.isTTY) {
    return new Promise<string>((resolve, reject) => {
      let input = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => {
        input += chunk;
      });
      process.stdin.on("end", () => resolve(input.trim()));
      process.stdin.on("error", reject);
    });
  }

  return "";
}

async function main() {
  const sqlText = await readInput(process.argv.slice(2));

  if (!sqlText) {
    console.error(
      [
        "Usage:",
        '  pnpm db:sql -- "select id, email from \\"user\\" limit 5"',
        "  pnpm db:sql -- --file ./query.sql",
        "  cat query.sql | pnpm db:sql",
      ].join("\n"),
    );
    process.exit(1);
  }

  const connection = process.env.DATABASE_URL;
  if (!connection) {
    throw new Error("DATABASE_URL is not set.");
  }

  const client = postgres(connection, { max: 1 });
  try {
    const result = await client.unsafe(sqlText);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await client.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error(message);
  process.exit(1);
});
