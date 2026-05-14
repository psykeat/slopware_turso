import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/app/")({
  beforeLoad: () => {
    throw redirect({ to: "/app/addresses" });
  },
  component: () => null,
});
