import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { auth } from "@repo/auth/auth";
import { db } from "@repo/db";
import { address, deliveryAddress } from "@repo/db/schema";
import { resolveTenantContext } from "#/lib/resolve-tenant";

export const Route = createFileRoute("/api/delivery-addresses/search")({
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
        const addressId = url.searchParams.get("addressId");

        const rows = await db
          .select({
            deliveryAddressId: deliveryAddress.deliveryAddressId,
            addressNo: address.addressNo,
            name: deliveryAddress.name,
            companyName: address.companyName,
            addressLine1: deliveryAddress.addressLine1,
            postalCode: deliveryAddress.postalCode,
            city: deliveryAddress.city,
            countryCode: deliveryAddress.countryCode,
          })
          .from(deliveryAddress)
          .innerJoin(address, eq(deliveryAddress.addressId, address.addressId))
          .where(
            and(
              eq(deliveryAddress.tenantId, context.tenantId),
              eq(address.tenantId, context.tenantId),
              addressId ? eq(deliveryAddress.addressId, addressId) : undefined,
              q.length > 0
                ? or(
                    ilike(deliveryAddress.name, `%${q}%`),
                    ilike(deliveryAddress.addressLine1, `%${q}%`),
                    ilike(deliveryAddress.city, `%${q}%`),
                    ilike(deliveryAddress.postalCode, `%${q}%`),
                    ilike(address.addressNo, `%${q}%`),
                    ilike(address.companyName, `%${q}%`),
                    ilike(address.searchText, `%${q}%`),
                  )
                : undefined,
            ),
          )
          .orderBy(desc(deliveryAddress.createdAt))
          .limit(limit);

        return new Response(JSON.stringify(rows), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
