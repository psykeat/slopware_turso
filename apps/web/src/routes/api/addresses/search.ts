import { createFileRoute } from "@tanstack/react-router";
import { db } from "@repo/db";
import { address } from "@repo/db/schema";
import { auth } from "@repo/auth/auth";
import { resolveTenantContext } from "#/lib/resolve-tenant";
import { and, eq, ilike, or } from "drizzle-orm";

export const Route = createFileRoute("/api/addresses/search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });

        const isSystemAdmin = (session.user as any).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) return new Response("No active tenant found", { status: 403 });

        const url = new URL(request.url);
        const q = url.searchParams.get("q") ?? "";
        const limit = Math.min(50, Number(url.searchParams.get("limit") ?? "20"));

        const rows = await db
          .select({
            addressId: address.addressId,
            addressNo: address.addressNo,
            companyName: address.companyName,
            firstName: address.firstName,
            lastName: address.lastName,
            addressLine1: address.addressLine1,
            postalCode: address.postalCode,
            city: address.city,
            countryCode: address.countryCode,
            currencyId: address.currencyId,
            paymentTermId: address.paymentTermId,
            defaultDeliveryAddressId: address.defaultDeliveryAddressId,
          })
          .from(address)
          .where(
            and(
              eq(address.tenantId, context.tenantId),
              q.length > 0
                ? or(
                    ilike(address.companyName, `%${q}%`),
                    ilike(address.addressNo, `%${q}%`),
                    ilike(address.city, `%${q}%`),
                    ilike(address.searchText, `%${q}%`),
                  )
                : undefined,
            ),
          )
          .limit(limit);

        return new Response(JSON.stringify(rows), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
