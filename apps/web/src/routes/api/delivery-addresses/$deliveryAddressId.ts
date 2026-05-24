import { auth } from "@repo/auth/auth";
import { db } from "@repo/db";
import { address, deliveryAddress } from "@repo/db/schema";
import { createFileRoute } from "@tanstack/react-router";
import { and, eq } from "drizzle-orm";

import { resolveTenantContext } from "#/lib/resolve-tenant";

export const Route = createFileRoute("/api/delivery-addresses/$deliveryAddressId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });

        const isSystemAdmin = (session.user as any).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) return new Response("No active tenant found", { status: 403 });

        const [row] = await db
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
              eq(deliveryAddress.deliveryAddressId, params.deliveryAddressId),
              eq(deliveryAddress.tenantId, context.tenantId),
              eq(address.tenantId, context.tenantId),
            ),
          )
          .limit(1);

        if (!row) return new Response("Delivery address not found", { status: 404 });

        return new Response(JSON.stringify(row), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
