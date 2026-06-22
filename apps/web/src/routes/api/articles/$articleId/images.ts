import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import { auth } from "@repo/auth/auth";
import { db, activePersistence, runInTenantScope } from "@repo/db";
import { article, articleImage } from "@repo/db/schema";
import { createFileRoute } from "@tanstack/react-router";
import { and, eq } from "drizzle-orm";

import { resolveTenantContext } from "#/lib/resolve-tenant";

export const Route = createFileRoute("/api/articles/$articleId/images")({
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
          return await runInTenantScope(context, async () => {
            const records = await db
              .select()
              .from(articleImage)
              .where(
                and(eq(articleImage.articleId, params.articleId), eq(articleImage.archived, false)),
              )
              .orderBy(articleImage.sortOrder);

            return new Response(JSON.stringify(records), {
              headers: { "content-type": "application/json" },
            });
          });
        } catch (err: any) {
          return new Response(err.message, { status: 500 });
        }
      },
      POST: async ({ request, params }) => {
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
          const formData = await request.formData();
          const file = formData.get("file") as File | null;
          if (!file) {
            return new Response("File is required", { status: 400 });
          }

          const altText = formData.get("altText") as string | null;

          const uuid = crypto.randomUUID();
          const fileName = file.name;
          const mimeType = file.type || "application/octet-stream";
          const fileSize = file.size;

          const storageRoot = process.env.STORAGE_PATH || join(homedir(), "slopware/storage");
          const storageDir = join(
            storageRoot,
            `tenant-${context.tenantId}`,
            "articles",
            params.articleId,
          );
          await mkdir(storageDir, { recursive: true });

          const safeFileName = `${uuid}-${fileName}`;
          const storageKey = `tenant-${context.tenantId}/articles/${params.articleId}/${safeFileName}`;
          const absolutePath = join(storageDir, safeFileName);

          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          await writeFile(absolutePath, buffer);

          const newImage = await runInTenantScope(context, async () => {
            return await db.transaction(async (tx) => {
              const existingImages = await tx
                .select({ sortOrder: articleImage.sortOrder })
                .from(articleImage)
                .where(
                  and(
                    eq(articleImage.articleId, params.articleId),
                    eq(articleImage.archived, false),
                  ),
                );

              const nextSortOrder =
                existingImages.length > 0
                  ? Math.max(...existingImages.map((img) => img.sortOrder)) + 1
                  : 0;

              const insertValues: any = {
                articleImageId: uuid,
                articleId: params.articleId,
                storageKey,
                fileName,
                mimeType,
                fileSize,
                altText,
                sortOrder: nextSortOrder,
                archived: false,
              };

              if (activePersistence.provider === "postgres") {
                insertValues.tenantId = context.tenantId;
              }

              const [inserted] = await tx.insert(articleImage).values(insertValues).returning();

              const [art] = await tx
                .select({ primaryImageId: article.primaryImageId })
                .from(article)
                .where(eq(article.articleId, params.articleId));

              if (art && !art.primaryImageId) {
                await tx
                  .update(article)
                  .set({ primaryImageId: inserted.articleImageId })
                  .where(eq(article.articleId, params.articleId));
              }

              return inserted;
            });
          });

          return new Response(JSON.stringify(newImage), {
            status: 201,
            headers: { "content-type": "application/json" },
          });
        } catch (err: any) {
          return new Response(err.message, { status: 500 });
        }
      },
    },
  },
});
