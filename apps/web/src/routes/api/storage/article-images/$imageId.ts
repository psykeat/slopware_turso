import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { auth } from "@repo/auth/auth";
import { db } from "@repo/db";
import { articleImage } from "@repo/db/schema";
import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";

import { resolveTenantContext } from "#/lib/resolve-tenant";

export const Route = createFileRoute("/api/storage/article-images/$imageId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) {
          return new Response("Unauthorized", { status: 401 });
        }

        const isSystemAdmin = (session.user as any).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) {
          return new Response("No active tenant found", { status: 403 });
        }

        try {
          const [imageRecord] = await db
            .select()
            .from(articleImage)
            .where(eq(articleImage.articleImageId, params.imageId))
            .limit(1);

          if (!imageRecord) {
            return new Response("Not Found", { status: 404 });
          }

          if (imageRecord.tenantId !== context.tenantId) {
            return new Response("Forbidden", { status: 403 });
          }

          const storageRoot = process.env.STORAGE_PATH || "/home/joerg/slopware/storage";
          const baseDir = join(storageRoot, "..");
          const absolutePath = join(baseDir, imageRecord.storageKey);

          const fileData = await readFile(absolutePath);
          return new Response(fileData, {
            headers: {
              "Content-Type": imageRecord.mimeType,
            },
          });
        } catch (err: any) {
          if (err.code === "ENOENT") {
            return new Response("File Not Found on Disk", { status: 404 });
          }
          return new Response(err.message, { status: 500 });
        }
      },
    },
  },
});
