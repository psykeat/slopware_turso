import { createFileRoute } from "@tanstack/react-router";
import { DataGrid } from "@repo/ui/components/data-grid";
import { useQuery } from "@tanstack/react-query";
import { EntityMask } from "@repo/ui/components/entity-mask";
import { useFocus } from "@repo/ui/platform/focus-manager";

export const Route = createFileRoute("/_auth/app/admin/organizations")({
  component: OrganizationsAdmin,
});

function OrganizationsAdmin() {
  const { state: focusState } = useFocus();

  const { data: orgs = [], isLoading } = useQuery({
    queryKey: ["admin", "organization"],
    queryFn: async () => {
      const res = await fetch("/api/admin/data/organization");
      if (!res.ok) throw new Error("Failed to fetch organizations");
      return res.json();
    },
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
      <div className="flex flex-col min-h-0 bg-canvas rounded-lg border border-hairline overflow-hidden">
        <div className="p-4 border-b border-hairline bg-canvas-soft flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Organizations</h2>
        </div>
        <DataGrid
          entityName="organization"
          panelId="admin-org-grid"
          data={orgs}
          isLoading={isLoading}
          keyExtractor={(row: any) => row.organizationId}
          className="flex-1 border-none"
        />
      </div>

      <div className="flex flex-col min-h-0">
        <EntityMask
          entityName="organization"
          recordId={focusState.recordId}
          title="Organization Configuration"
          className="h-full shadow-none"
          apiBase="/api/admin/data"
        />
      </div>
    </div>
  );
}
