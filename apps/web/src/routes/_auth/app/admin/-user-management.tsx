import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { EntityMask } from "@repo/ui/components/entity-mask";
import { PlusIcon, Trash2Icon, Loader2Icon, ShieldCheckIcon, GlobeIcon } from "lucide-react";

interface UserAssignmentToolProps {
  userId: string;
}

export function UserAssignmentTool({ userId }: UserAssignmentToolProps) {
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
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true }),
      });
      if (!res.ok) throw new Error("Failed to remove assignment");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "user-assignments", userId] });
    },
  });

  return (
    <div className="flex flex-col h-full bg-canvas-soft overflow-hidden">
      <div className="h-12 flex items-center px-4 shrink-0 border-b border-hairline bg-canvas">
        <ShieldCheckIcon className="size-4 text-primary mr-2" />
        <span className="text-[12px] font-bold text-ink uppercase tracking-widest">
          Tenant Assignments
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isAssignmentsLoading ? (
          <div className="flex justify-center py-12">
            <Loader2Icon className="size-6 animate-spin text-ink-mute" />
          </div>
        ) : (
          <div className="space-y-3">
            {assignments.map((as: any) => (
              <div
                key={as.id}
                className="group flex items-center justify-between p-3 rounded-lg bg-canvas border border-hairline shadow-sm hover:border-primary/20 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-full bg-canvas-soft border border-hairline grid place-items-center shrink-0">
                    <GlobeIcon className="size-4 text-ink-mute" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[13px] font-semibold text-ink leading-none mb-1">
                      {as.tenantName || as.tenantId}
                    </span>
                    <span className="text-[11px] text-ink-mute uppercase tracking-tighter font-medium">
                      {as.role}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => deleteMutation.mutate(as.id)}
                  disabled={deleteMutation.isPending}
                  className="size-8 rounded-md grid place-items-center text-ink-mute hover:bg-destructive/10 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                  title="Remove Access"
                >
                  <Trash2Icon size={14} />
                </button>
              </div>
            ))}
            {assignments.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-hairline rounded-xl bg-canvas/50">
                <GlobeIcon className="size-8 text-ink-mute/30 mb-2" />
                <p className="text-[12px] text-ink-mute font-medium uppercase tracking-wider">No active assignments</p>
              </div>
            )}
          </div>
        )}

        {adding ? (
          <div className="p-4 rounded-xl bg-canvas border border-primary/20 space-y-4 shadow-md animate-in fade-in zoom-in-95 duration-200">
            <div className="space-y-1.5">
              <label 
                htmlFor="assign-tenant-select"
                className="text-[10px] uppercase font-bold text-ink-mute tracking-widest pl-0.5"
              >
                Select Tenant
              </label>
              <select
                id="assign-tenant-select"
                value={newTenantId}
                onChange={(e) => setNewTenantId(e.target.value)}
                className="w-full h-9 bg-canvas-soft border border-hairline-input rounded-md px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer"
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
                className="text-[10px] uppercase font-bold text-ink-mute tracking-widest pl-0.5"
              >
                Assign Role
              </label>
              <select
                id="assign-role-select"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="w-full h-9 bg-canvas-soft border border-hairline-input rounded-md px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer"
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
                className="flex-1 h-9 bg-primary text-primary-fg rounded-md text-[13px] font-semibold disabled:opacity-50 hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-95"
              >
                {addMutation.isPending ? "Assigning..." : "Assign Access"}
              </button>
              <button
                onClick={() => setAdding(false)}
                className="px-4 h-9 border border-hairline rounded-md text-[13px] font-medium hover:bg-canvas-soft transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full flex items-center justify-center gap-2 h-11 border-2 border-dashed border-hairline rounded-xl text-ink-mute hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all group"
          >
            <PlusIcon size={16} className="group-hover:scale-110 transition-transform" />
            <span className="text-[13px] font-bold uppercase tracking-wider">Assign to Tenant</span>
          </button>
        )}
      </div>
      
      <div className="p-4 border-t border-hairline bg-canvas">
        <p className="text-[11px] text-ink-mute leading-relaxed italic">
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
    <div className="flex h-[850px] w-full overflow-hidden bg-canvas rounded-lg shadow-2xl">
      {/* Left Column: User Data */}
      <div className="flex-1 overflow-y-auto min-w-0 bg-canvas border-r border-hairline">
        <EntityMask
          entityName="user"
          recordId={userId}
          mode="edit"
          layout="single"
          title={`${t("actions.edit")} User Profile`}
          onCancel={onCancel}
          onSaved={onSaved}
          apiBase="/api/admin/data"
          className="border-none shadow-none rounded-none m-0 p-8"
        />
      </div>

      {/* Right Column: Tenant Assignments */}
      <div className="w-[340px] shrink-0">
        <UserAssignmentTool userId={userId} />
      </div>
    </div>
  );
}
