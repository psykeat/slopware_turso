import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/app/admin/")({
  beforeLoad: ({ context }) => {
    if (!(context.user as any)?.isSystemAdmin) {
      throw redirect({ to: "/app/addresses" });
    }
    throw redirect({ to: "/app/admin/tenants" });
  },
  component: () => null,
});
