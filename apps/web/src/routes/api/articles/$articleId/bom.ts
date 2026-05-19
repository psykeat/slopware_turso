import { auth } from "@repo/auth/auth";
import { db } from "@repo/db";
import { articleBom, article, unit } from "@repo/db/schema";
import { createFileRoute } from "@tanstack/react-router";
import { and, eq, asc, max, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { resolveTenantContext } from "#/lib/resolve-tenant";

export const Route = createFileRoute("/api/articles/$articleId/bom")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });

        const isSystemAdmin = (session.user as any).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) return new Response("No active tenant found", { status: 403 });

        const baseUnit = alias(unit, "component_base_unit");
        const salesUnit = alias(unit, "component_sales_unit");

        const rows = await db
          .select({
            bomId: articleBom.bomId,
            componentArticleId: articleBom.componentArticleId,
            articleNo: article.articleNo,
            name: article.name,
            quantity: articleBom.quantity,
            scrapPercentage: articleBom.scrapPercentage,
            sortOrder: articleBom.sortOrder,
            baseUnitCode: baseUnit.code,
            salesUnitCode: salesUnit.code,
          })
          .from(articleBom)
          .innerJoin(article, eq(article.articleId, articleBom.componentArticleId))
          .leftJoin(baseUnit, eq(baseUnit.unitId, article.baseUnitId))
          .leftJoin(salesUnit, eq(salesUnit.unitId, article.salesUnitId))
          .where(
            and(
              eq(articleBom.tenantId, context.tenantId),
              eq(articleBom.headerArticleId, params.articleId),
              eq(articleBom.archived, false),
              isNull(article.archivedAt),
            ),
          )
          .orderBy(asc(articleBom.sortOrder));

        const components = rows.map((r) => ({
          bomId: r.bomId,
          componentArticleId: r.componentArticleId,
          articleNo: r.articleNo,
          name: r.name,
          quantity: String(r.quantity),
          scrapPercentage: String(r.scrapPercentage),
          sortOrder: r.sortOrder,
          unit: r.salesUnitCode ?? r.baseUnitCode ?? null,
        }));

        return new Response(JSON.stringify({ components }), {
          headers: { "content-type": "application/json" },
        });
      },

      POST: async ({ request, params }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });

        const isSystemAdmin = (session.user as any).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) return new Response("No active tenant found", { status: 403 });

        // Verify header article belongs to this tenant
        const headerArticle = await db
          .select({ articleId: article.articleId })
          .from(article)
          .where(
            and(eq(article.articleId, params.articleId), eq(article.tenantId, context.tenantId)),
          )
          .limit(1);
        if (headerArticle.length === 0) return new Response("Article not found", { status: 404 });

        const body = (await request.json()) as {
          componentArticleId: string;
          quantity: number;
          scrapPercentage?: number;
          sortOrder?: number;
        };

        if (!body.componentArticleId || !body.quantity) {
          return new Response("Missing required fields", { status: 400 });
        }

        // Compute default sortOrder if not provided
        let sortOrder = body.sortOrder;
        if (sortOrder === undefined) {
          const maxRow = await db
            .select({ maxSort: max(articleBom.sortOrder) })
            .from(articleBom)
            .where(
              and(
                eq(articleBom.tenantId, context.tenantId),
                eq(articleBom.headerArticleId, params.articleId),
                eq(articleBom.archived, false),
              ),
            );
          sortOrder = (maxRow[0]?.maxSort ?? 0) + 10;
        }

        const [inserted] = await db
          .insert(articleBom)
          .values({
            tenantId: context.tenantId,
            headerArticleId: params.articleId,
            componentArticleId: body.componentArticleId,
            quantity: String(body.quantity),
            scrapPercentage: String(body.scrapPercentage ?? 0),
            sortOrder,
          })
          .returning();

        return new Response(JSON.stringify({ bom: inserted }), {
          status: 201,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
