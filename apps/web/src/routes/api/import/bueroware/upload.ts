import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { auth } from "@repo/auth/auth";
import { runInTenantScope } from "@repo/db";
import { ImportService } from "@repo/db/services/import-service";
import { createFileRoute } from "@tanstack/react-router";
import { Unzip, UnzipInflate } from "fflate";

import { resolveTenantContext } from "#/lib/resolve-tenant";

function storageRoot() {
  return process.env.STORAGE_ROOT ?? join(process.cwd(), "storage");
}

function isZipUpload(request: Request, fileName: string) {
  const contentType = request.headers.get("content-type") ?? "";
  return contentType.includes("application/zip") || fileName.toLowerCase().endsWith(".zip");
}

async function extractSingleSedb(zipPath: string, outputPath: string): Promise<string> {
  let sedbCount = 0;
  let sedbName = "";
  let output: ReturnType<typeof createWriteStream> | null = null;
  let outputFinished: Promise<void> = Promise.resolve();

  const unzip = new Unzip((file) => {
    if (!file.name.toLowerCase().endsWith(".sedb")) return;
    sedbCount++;
    sedbName = basename(file.name);
    if (sedbCount > 1) {
      file.terminate();
      return;
    }

    output = createWriteStream(outputPath);
    outputFinished = new Promise((resolve, reject) => {
      output?.on("finish", resolve);
      output?.on("error", reject);
    });
    file.ondata = (error, data, final) => {
      if (error) {
        output?.destroy(error);
        return;
      }
      output?.write(data);
      if (final) output?.end();
    };
    file.start();
  });
  unzip.register(UnzipInflate);

  for await (const chunk of createReadStream(zipPath)) {
    if (sedbCount > 1) break;
    unzip.push(chunk, false);
  }
  unzip.push(new Uint8Array(), true);

  if (sedbCount !== 1) {
    if (output) {
      (output as ReturnType<typeof createWriteStream>).destroy();
    }
    throw new Error(`ZIP upload must contain exactly one .sedb file, found ${sedbCount}`);
  }

  await outputFinished;
  return sedbName;
}

export const Route = createFileRoute("/api/import/bueroware/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });

        const context = await resolveTenantContext(
          request,
          session.user.id,
          Boolean((session.user as { isSystemAdmin?: boolean }).isSystemAdmin),
        );
        if (!context) return new Response("Forbidden", { status: 403 });

        if (!request.body) return Response.json({ error: "Missing request body" }, { status: 400 });

        const url = new URL(request.url);
        const mappingVersionId = url.searchParams.get("mappingVersionId") ?? undefined;
        const layoutId = url.searchParams.get("layoutId") ?? undefined;
        const profileId = url.searchParams.get("profileId") ?? undefined;
        const fileName = basename(url.searchParams.get("fileName") ?? "upload.sedb");

        const batchId = randomUUID();
        const importDir = join(storageRoot(), "imports", context.tenantId);
        await mkdir(importDir, { recursive: true });

        const sedbPath = join(importDir, `${batchId}.sedb`);
        const uploadIsZip = isZipUpload(request, fileName);
        const incomingPath = uploadIsZip ? join(importDir, `${batchId}.zip`) : sedbPath;
        let sourceFileName = fileName;

        const bodyStream = request.body as unknown as Parameters<typeof Readable.fromWeb>[0];
        await pipeline(Readable.fromWeb(bodyStream), createWriteStream(incomingPath));

        try {
          if (uploadIsZip) {
            sourceFileName = await extractSingleSedb(incomingPath, sedbPath);
            await rm(incomingPath, { force: true });
          }

          return await runInTenantScope(context, async () => {
            const importService = new ImportService(context.tenantId, session.user.id);
            const result = await importService.queueBuerowareFile({
              layoutId,
              profileId,
              mappingVersionId,
              sourceFileName,
              filePath: sedbPath,
              isDryRun: true,
            });

            // Always return the file's data areas so the UI can show the picker when needed.
            const layouts = await importService.listLayoutsForFile(sourceFileName);
            return Response.json({ ...result, layouts });
          });
        } catch (error) {
          await rm(incomingPath, { force: true });
          await rm(sedbPath, { force: true });
          const message = error instanceof Error ? error.message : String(error);
          return Response.json({ error: message }, { status: 400 });
        }
      },
    },
  },
});
