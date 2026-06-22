import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { afterEach } from "node:test";

import { loadDraftAttachment } from "./mime";

let previousStoragePath: string | undefined;
const cleanupPaths: string[] = [];

afterEach(async () => {
  if (previousStoragePath === undefined) {
    delete process.env.STORAGE_PATH;
  } else {
    process.env.STORAGE_PATH = previousStoragePath;
  }
  previousStoragePath = undefined;

  await Promise.all(
    cleanupPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

test("loadDraftAttachment reads document PDFs from STORAGE_PATH", async () => {
  previousStoragePath = process.env.STORAGE_PATH;
  const storageDir = join(tmpdir(), `slopware-mail-storage-${randomUUID()}`);
  cleanupPaths.push(storageDir);
  process.env.STORAGE_PATH = storageDir;

  const storageKey = "tenant-test/documents/doc-1.pdf";
  await mkdir(join(storageDir, "tenant-test", "documents"), { recursive: true });
  await writeFile(join(storageDir, storageKey), "%PDF-1.3\n", "utf8");

  const attachment = await loadDraftAttachment({
    fileName: "doc-1.pdf",
    contentType: "application/pdf",
    storageKey,
  });

  assert.equal(attachment?.fileName, "doc-1.pdf");
  assert.equal(attachment?.bytes.toString("utf8"), "%PDF-1.3\n");
});

test("loadDraftAttachment rejects path traversal storage keys", async () => {
  previousStoragePath = process.env.STORAGE_PATH;
  const storageDir = join(tmpdir(), `slopware-mail-storage-${randomUUID()}`);
  cleanupPaths.push(storageDir);
  process.env.STORAGE_PATH = storageDir;

  const attachment = await loadDraftAttachment({
    fileName: "secret.txt",
    storageKey: "../secret.txt",
  });

  assert.equal(attachment, null);
});
