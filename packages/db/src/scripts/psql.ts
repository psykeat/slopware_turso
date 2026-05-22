import "dotenv/config";
import { spawn } from "node:child_process";
import process from "node:process";

const connection = process.env.DATABASE_URL;

if (!connection) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const forwardedArgs = process.argv.slice(2).filter((arg) => arg !== "--");

const child = spawn("psql", [connection, ...forwardedArgs], {
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
