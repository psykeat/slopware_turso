import { EntityMask } from "@repo/ui/components/entity-mask";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { PlusIcon, Trash2Icon, Loader2Icon, ShieldCheckIcon, GlobeIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface UserAssignmentToolProps {
  userId: string;
}

function UserAssignmentTool({ userId }: UserAssignmentToolProps) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [newTenantId, setNewTenantId] = useState("");
  const [newRole, setNewRole] = useState("member");

  // Fetch current assignments for this user
  const { data: assignments = [], isLoading: isAssignmentsLoading } = useQuery({
    queryKey: ["admin", "user-assignments", userId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/data/userTenant?userId=${userId}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch all available tenants for the dropdown
  const { data: allTenants = [] } = useQuery({
    queryKey: ["admin", "data", "tenant"],
    queryFn: async () => {
      const res = await fetch("/api/admin/data/tenant");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/data/userTenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, tenantId: newTenantId, role: newRole }),
      });
      if (!res.ok) throw new Error("Failed to add assignment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "user-assignments", userId] });
      setAdding(false);
      setNewTenantId("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/data/userTenant/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to remove assignment");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "user-assignments", userId] });
    },
  });

  return (
    <div className="flex h-full flex-col overflow-hidden bg-canvas-soft">
      <div className="flex h-12 shrink-0 items-center border-b border-hairline bg-canvas px-4">
        <ShieldCheckIcon className="mr-2 size-4 text-primary" />
        <span className="text-[12px] font-bold tracking-widest text-ink uppercase">
          Tenant Assignments
        </span>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {isAssignmentsLoading ? (
          <div className="flex justify-center py-12">
            <Loader2Icon className="size-6 animate-spin text-ink-mute" />
          </div>
        ) : (
          <div className="space-y-3">
            {assignments.map((as: any) => (
              <div
                key={as.id}
                className="group flex items-center justify-between rounded-lg border border-hairline bg-canvas p-3 shadow-sm transition-all hover:border-primary/20"
              >
                <div className="flex items-center gap-3">
                  <div className="grid size-8 shrink-0 place-items-center rounded-full border border-hairline bg-canvas-soft">
                    <GlobeIcon className="size-4 text-ink-mute" />
                  </div>
                  <div className="flex flex-col">
                    <span className="mb-1 text-[13px] leading-none font-semibold text-ink">
                      {as.tenantName || as.tenantId}
                    </span>
                    <span className="text-[11px] font-medium tracking-tighter text-ink-mute uppercase">
                      {as.role}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => deleteMutation.mutate(as.id)}
                  disabled={deleteMutation.isPending}
                  className="grid size-8 place-items-center rounded-md text-ink-mute opacity-0 transition-colors group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                  title="Remove Access"
                >
                  <Trash2Icon size={14} />
                </button>
              </div>
            ))}
            {assignments.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-hairline bg-canvas/50 py-12">
                <GlobeIcon className="mb-2 size-8 text-ink-mute/30" />
                <p className="text-[12px] font-medium tracking-wider text-ink-mute uppercase">
                  No active assignments
                </p>
              </div>
            )}
          </div>
        )}

        {adding ? (
          <div className="animate-in space-y-4 rounded-xl border border-primary/20 bg-canvas p-4 shadow-md duration-200 zoom-in-95 fade-in">
            <div className="space-y-1.5">
              <label
                htmlFor="assign-tenant-select"
                className="pl-0.5 text-[10px] font-bold tracking-widest text-ink-mute uppercase"
              >
                Select Tenant
              </label>
              <select
                id="assign-tenant-select"
                value={newTenantId}
                onChange={(e) => setNewTenantId(e.target.value)}
                className="h-9 w-full cursor-pointer appearance-none rounded-md border border-hairline-input bg-canvas-soft px-3 text-[13px] focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
              >
                <option value="">Choose...</option>
                {allTenants.map((t: any) => (
                  <option key={t.tenantId} value={t.tenantId}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="assign-role-select"
                className="pl-0.5 text-[10px] font-bold tracking-widest text-ink-mute uppercase"
              >
                Assign Role
              </label>
              <select
                id="assign-role-select"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="h-9 w-full cursor-pointer appearance-none rounded-md border border-hairline-input bg-canvas-soft px-3 text-[13px] focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                <option value="owner">Owner</option>
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => addMutation.mutate()}
                disabled={!newTenantId || addMutation.isPending}
                className="h-9 flex-1 rounded-md bg-primary text-[13px] font-semibold text-primary-fg transition-all hover:shadow-lg hover:shadow-primary/20 active:scale-95 disabled:opacity-50"
              >
                {addMutation.isPending ? "Assigning..." : "Assign Access"}
              </button>
              <button
                onClick={() => setAdding(false)}
                className="h-9 rounded-md border border-hairline px-4 text-[13px] font-medium transition-colors hover:bg-canvas-soft"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="group flex h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-hairline text-ink-mute transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
          >
            <PlusIcon size={16} className="transition-transform group-hover:scale-110" />
            <span className="text-[13px] font-bold tracking-wider uppercase">Assign to Tenant</span>
          </button>
        )}
      </div>

      <div className="border-t border-hairline bg-canvas p-4">
        <p className="text-[11px] leading-relaxed text-ink-mute italic">
          User must be assigned to at least one active tenant to access the application.
        </p>
      </div>
    </div>
  );
}

interface UserManagementViewProps {
  userId: string;
  onCancel: () => void;
  onSaved: () => void;
}

export function UserManagementView({ userId, onCancel, onSaved }: UserManagementViewProps) {
  const { t } = useTranslation("ui");

  return (
    <div className="flex h-[850px] w-full overflow-hidden rounded-lg bg-canvas shadow-2xl">
      {/* Left Column: User Data */}
      <div className="min-w-0 flex-1 overflow-y-auto border-r border-hairline bg-canvas">
        <EntityMask
          entityName="user"
          recordId={userId}
          mode="edit"
          layout="single"
          title={`${t("actions.edit")} User Profile`}
          onCancel={onCancel}
          onSaved={onSaved}
          apiBase="/api/admin/data"
          className="m-0 rounded-none border-none p-8 shadow-none"
        />
      </div>

      {/* Right Column: Tenant Assignments */}
      <div className="w-[340px] shrink-0">
        <UserAssignmentTool userId={userId} />
      </div>
    </div>
  );
}
