import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { extname, join, normalize } from "node:path";

import { auth } from "@repo/auth/auth";
import { db } from "@repo/db";
import { articleImage } from "@repo/db/schema";
import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";

import { resolveTenantContext } from "#/lib/resolve-tenant";

function storageRoot() {
  return process.env.STORAGE_PATH || join(homedir(), "slopware/storage");
}

function safeStoragePath(storageKey: string) {
  const relativeKey = storageKey.replace(/^storage\//, "");
  const root = storageRoot();
  const absolutePath = normalize(join(root, relativeKey));
  const normalizedRoot = normalize(root);

  if (!absolutePath.startsWith(normalizedRoot)) {
    throw new Error("Invalid storage key");
  }

  return absolutePath;
}

function contentTypeFor(path: string) {
  switch (extname(path).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    default:
      return "application/octet-stream";
  }
}

function debugResponse(message: string, details: Record<string, unknown>, status = 404) {
  return new Response(JSON.stringify({ message, ...details }, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-Slopware-Storage-Debug": "article-image-v2",
      "Cache-Control": "no-store",
    },
  });
}

export const Route = createFileRoute("/api/storage/article-images/$imageId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        console.log(`[Storage] article image request ${params.imageId}`);
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) {
          console.log(`[Storage] unauthorized ${params.imageId}`);
          return debugResponse("Unauthorized", { imageId: params.imageId }, 401);
        }

        const isSystemAdmin = (session.user as any).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) {
          console.log(`[Storage] no tenant ${params.imageId}`);
          return debugResponse("No active tenant found", { imageId: params.imageId }, 403);
        }

        const [record] = await db
          .select()
          .from(articleImage)
          .where(eq(articleImage.articleImageId, params.imageId))
          .limit(1);

        if (!record) {
          console.log(`[Storage] record not found ${params.imageId}`);
          return debugResponse("Image record not found", { imageId: params.imageId });
        }
        if (record.tenantId !== context.tenantId && !isSystemAdmin) {
          console.log(
            `[Storage] forbidden ${params.imageId} record=${record.tenantId} context=${context.tenantId}`,
          );
          return debugResponse(
            "Forbidden",
            {
              imageId: params.imageId,
              recordTenantId: record.tenantId,
              contextTenantId: context.tenantId,
            },
            403,
          );
        }

        try {
          const path = safeStoragePath(record.storageKey);
          console.log(`[Storage] read ${params.imageId} ${path}`);
          const file = await readFile(path);

          return new Response(file, {
            headers: {
              "Content-Type": record.mimeType || contentTypeFor(path),
              "Cache-Control": "no-store",
              "X-Slopware-Storage-Debug": "article-image-v2",
            },
          });
        } catch (error: any) {
          const path = safeStoragePath(record.storageKey);
          console.log(`[Storage] read failed ${params.imageId} ${path} ${error?.code ?? ""}`);
          return debugResponse(
            error?.code === "ENOENT" ? "Image file not found" : "Storage error",
            {
              imageId: params.imageId,
              storageRoot: storageRoot(),
              storageKey: record.storageKey,
              path,
              errorCode: error?.code,
              errorMessage: error?.message,
            },
            error?.code === "ENOENT" ? 404 : 500,
          );
        }
      },
    },
  },
});
