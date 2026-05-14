import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { cn } from "@repo/ui/lib/utils";

export const Route = createFileRoute("/_auth/app/admin")({
  component: AdminLayout,
});

const ADMIN_TABS = [
  { label: "Tenants", to: "/app/admin/tenants" },
  { label: "Users", to: "/app/admin/users" },
  { label: "Organizations", to: "/app/admin/organizations" },
] as const;

function AdminLayout() {
  const location = useLocation();

  return (
    <div className="flex flex-col h-full">
      <div className="h-9 flex items-center gap-0.5 px-3 bg-canvas-soft border-b border-hairline shrink-0">
        {ADMIN_TABS.map((tab) => {
          const active = location.pathname.startsWith(tab.to);
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={cn(
                "h-7 px-3 rounded-md text-[13px] transition-colors",
                active
                  ? "text-primary-fg"
                  : "text-ink-secondary hover:bg-canvas hover:text-ink",
              )}
              style={active ? { background: "var(--primary)" } : undefined}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
