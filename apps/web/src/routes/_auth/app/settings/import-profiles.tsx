import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useActionBar } from "@repo/ui/platform/action-bar-context";
import { Button } from "@repo/ui/components/button";
import { Label } from "@repo/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/select";
import { cn } from "@repo/ui/lib/utils";
import {
  PlusIcon,
  Trash2Icon,
  SaveIcon,
  ZapIcon,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_auth/app/settings/import-profiles")({
  component: ImportProfilesPage,
});

// ── Types ──────────────────────────────────────────────────────────────────
interface ImportProfile {
  profileId: string;
  slug: string;
  label: string;
  targetEntity: string;
  targetCommandKey: string;
  requiresApproval: boolean;
  archived: boolean;
}

interface ImportConnector {
  tenantConnectorId: string;
  label: string;
  slug: string;
}

interface MappingRow {
  _localId: string; // for keying UI rows
  mappingId?: string;
  sourceField: string;
  targetTable: string;
  targetColumn: string;
  transform: string;
  defaultValue: string;
}

const EMPTY_ROW = (): MappingRow => ({
  _localId: crypto.randomUUID(),
  sourceField: "",
  targetTable: "",
  targetColumn: "",
  transform: "",
  defaultValue: "",
});

// ── Import Profiles View ───────────────────────────────────────────────────
function ImportProfilesView() {
  const { setSubCrumb } = useActionBar();
  const queryClient = useQueryClient();

  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form state for the selected / new profile
  const [formLabel, setFormLabel] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formTargetEntity, setFormTargetEntity] = useState("article");
  const [formCommandKey, setFormCommandKey] = useState("upsert");
  const [formRequiresApproval, setFormRequiresApproval] = useState(false);
  const [formArchived, setFormArchived] = useState(false);

  // Mapping section
  const [selectedConnectorId, setSelectedConnectorId] = useState("");
  const [mappingRows, setMappingRows] = useState<MappingRow[]>([]);
  const [mappingsLoaded, setMappingsLoaded] = useState(false);

  useEffect(() => () => setSubCrumb(undefined), [setSubCrumb]);

  // ── Data fetching ──────────────────────────────────────────────────────
  const { data: profiles = [], isLoading: isProfilesLoading } = useQuery<ImportProfile[]>({
    queryKey: ["import", "profiles"],
    queryFn: async () => {
      const res = await fetch("/api/import/profiles");
      return res.ok ? res.json() : [];
    },
  });

  const { data: connectors = [] } = useQuery<ImportConnector[]>({
    queryKey: ["import", "connectors"],
    queryFn: async () => {
      const res = await fetch("/api/import/connectors");
      return res.ok ? res.json() : [];
    },
  });

  // Load mappings when connector or profile changes
  const { data: serverMappings } = useQuery({
    queryKey: ["import", "mappings", selectedProfileId, selectedConnectorId],
    queryFn: async () => {
      const res = await fetch(
        `/api/import/profiles/${selectedProfileId}/mappings?connectorId=${selectedConnectorId}`,
      );
      return res.ok ? (res.json() as Promise<MappingRow[]>) : [];
    },
    enabled: !!selectedProfileId && !!selectedConnectorId,
  });

  useEffect(() => {
    if (serverMappings && !mappingsLoaded) {
      setMappingRows(serverMappings.map((m) => ({ ...m, _localId: crypto.randomUUID() })));
      setMappingsLoaded(true);
    }
  }, [serverMappings, mappingsLoaded]);

  // Reset mappings when connector changes
  useEffect(() => {
    setMappingRows([]);
    setMappingsLoaded(false);
  }, [selectedConnectorId, selectedProfileId]);

  // ── Profile form helpers ───────────────────────────────────────────────
  const loadProfile = (p: ImportProfile) => {
    setSelectedProfileId(p.profileId);
    setIsCreating(false);
    setFormLabel(p.label);
    setFormSlug(p.slug);
    setFormTargetEntity(p.targetEntity);
    setFormCommandKey(p.targetCommandKey);
    setFormRequiresApproval(p.requiresApproval);
    setFormArchived(p.archived);
    setSelectedConnectorId("");
    setMappingRows([]);
    setMappingsLoaded(false);
    setSubCrumb(p.label);
  };

  const startCreate = () => {
    setSelectedProfileId(null);
    setIsCreating(true);
    setFormLabel("");
    setFormSlug("");
    setFormTargetEntity("article");
    setFormCommandKey("upsert");
    setFormRequiresApproval(false);
    setFormArchived(false);
    setSelectedConnectorId("");
    setMappingRows([]);
    setMappingsLoaded(false);
    setSubCrumb("New Profile");
  };

  // ── Mutations ──────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/import/profiles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: formSlug,
          label: formLabel,
          targetEntity: formTargetEntity,
          targetCommandKey: formCommandKey,
          requiresApproval: formRequiresApproval,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<ImportProfile>;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["import", "profiles"] });
      loadProfile(created);
      toast.success("Profile created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/import/profiles/${selectedProfileId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          label: formLabel,
          targetEntity: formTargetEntity,
          targetCommandKey: formCommandKey,
          requiresApproval: formRequiresApproval,
          archived: formArchived,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<ImportProfile>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import", "profiles"] });
      toast.success("Profile saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveMappingsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/import/profiles/${selectedProfileId}/mappings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          connectorId: selectedConnectorId,
          rows: mappingRows.map(({ _localId: _l, ...rest }) => rest),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import", "mappings", selectedProfileId, selectedConnectorId] });
      toast.success("Mappings saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/import/profiles/${selectedProfileId}/activate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ connectorId: selectedConnectorId }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ versionId: string; versionNo: number }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["import", "profiles"] });
      toast.success(`Version ${data.versionNo} activated`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Mapping row helpers ────────────────────────────────────────────────
  const updateRow = (localId: string, field: keyof Omit<MappingRow, "_localId">, value: string) => {
    setMappingRows((rows) => rows.map((r) => (r._localId === localId ? { ...r, [field]: value } : r)));
  };

  const removeRow = (localId: string) => {
    setMappingRows((rows) => rows.filter((r) => r._localId !== localId));
  };

  const addRow = () => {
    setMappingRows((rows) => [...rows, EMPTY_ROW()]);
  };

  // ── Render ─────────────────────────────────────────────────────────────
  const showPanel = isCreating || selectedProfileId !== null;
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* ── Left: Profile list ── */}
      <div className="w-60 shrink-0 bg-canvas-soft border-r border-hairline flex flex-col overflow-hidden">
        <div className="h-8 flex items-center justify-between px-3 shrink-0 border-b border-hairline">
          <span className="text-[11px] uppercase tracking-wider font-medium text-ink-mute">Import Profiles</span>
          <button
            onClick={startCreate}
            className="size-5 flex items-center justify-center rounded hover:bg-canvas-soft text-ink-mute hover:text-ink transition-colors"
            title="New Profile"
          >
            <PlusIcon className="size-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {isProfilesLoading ? (
            <div className="px-3 py-4 text-[12px] text-ink-mute">Loading…</div>
          ) : profiles.length === 0 ? (
            <div className="px-3 py-4 text-[12px] text-ink-mute">No profiles yet.</div>
          ) : (
            profiles.map((p) => {
              const isActive = p.profileId === selectedProfileId;
              return (
                <button
                  key={p.profileId}
                  onClick={() => loadProfile(p)}
                  className={cn(
                    "w-full flex flex-col items-start h-auto px-3 py-2 text-left cursor-pointer transition-colors",
                    isActive
                      ? "bg-primary text-primary-fg"
                      : "text-ink-secondary hover:bg-canvas hover:text-ink",
                  )}
                >
                  <span className="text-[13px] truncate w-full">{p.label}</span>
                  <span className={cn("text-[10px] font-mono", isActive ? "text-primary-fg/70" : "text-ink-mute")}>
                    {p.slug}
                  </span>
                </button>
              );
            })
          )}

          {isCreating && (
            <div className="px-3 py-2 bg-[color-mix(in_oklab,var(--primary)_8%,var(--canvas))] border-l-2 border-primary text-[13px] text-ink">
              New Profile…
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Edit form + mappings ── */}
      {showPanel ? (
        <div className="flex-1 min-w-0 overflow-y-auto bg-canvas">
          <div className="max-w-2xl mx-auto px-6 py-6 flex flex-col gap-6">
            {/* Profile form */}
            <section className="flex flex-col gap-4">
              <h2 className="text-[14px] font-semibold text-ink border-b border-hairline pb-2">
                {isCreating ? "New Import Profile" : "Profile Settings"}
              </h2>

              <div className="grid grid-cols-2 gap-4">
                {/* Label */}
                <div className="flex flex-col gap-1.5">
                  <Label>Label</Label>
                  <input
                    type="text"
                    value={formLabel}
                    onChange={(e) => setFormLabel(e.target.value)}
                    placeholder="My Import Profile"
                    className="h-8 rounded border border-hairline px-2.5 text-[13px] bg-canvas focus:outline-none focus:border-primary"
                  />
                </div>

                {/* Slug */}
                <div className="flex flex-col gap-1.5">
                  <Label>Slug {!isCreating && <span className="text-[10px] text-ink-mute">(read-only)</span>}</Label>
                  <input
                    type="text"
                    value={formSlug}
                    onChange={(e) => isCreating && setFormSlug(e.target.value)}
                    readOnly={!isCreating}
                    placeholder="my-import-profile"
                    className={cn(
                      "h-8 rounded border border-hairline px-2.5 text-[13px] font-mono bg-canvas focus:outline-none focus:border-primary",
                      !isCreating && "opacity-60 cursor-default bg-canvas-soft",
                    )}
                  />
                </div>

                {/* Target Entity */}
                <div className="flex flex-col gap-1.5">
                  <Label>Target Entity</Label>
                  <Select value={formTargetEntity} onValueChange={(v) => v && setFormTargetEntity(v)}>
                    <SelectTrigger className="h-8 text-[13px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="article">Article</SelectItem>
                      <SelectItem value="address">Address</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Target Command Key */}
                <div className="flex flex-col gap-1.5">
                  <Label>Target Command Key</Label>
                  <input
                    type="text"
                    value={formCommandKey}
                    onChange={(e) => setFormCommandKey(e.target.value)}
                    placeholder="upsert"
                    className="h-8 rounded border border-hairline px-2.5 text-[13px] font-mono bg-canvas focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formRequiresApproval}
                    onChange={(e) => setFormRequiresApproval(e.target.checked)}
                    className="size-4 accent-primary"
                  />
                  <span className="text-[13px] text-ink">Requires Approval</span>
                </label>

                {!isCreating && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!formArchived}
                      onChange={(e) => setFormArchived(!e.target.checked)}
                      className="size-4 accent-primary"
                    />
                    <span className="text-[13px] text-ink">Active</span>
                  </label>
                )}
              </div>

              {/* Save button */}
              <div className="flex justify-end">
                <Button
                  onClick={() => (isCreating ? createMutation.mutate() : updateMutation.mutate())}
                  disabled={!formLabel || !formSlug || isPending}
                  size="sm"
                >
                  <SaveIcon className="size-3.5 mr-1.5" />
                  {isCreating ? "Create Profile" : "Save Profile"}
                </Button>
              </div>
            </section>

            {/* Field Mappings section — only after profile exists */}
            {!isCreating && selectedProfileId && (
              <section className="flex flex-col gap-4">
                <h2 className="text-[14px] font-semibold text-ink border-b border-hairline pb-2">
                  Field Mappings
                </h2>

                {/* Connector selector */}
                <div className="flex flex-col gap-1.5 max-w-xs">
                  <Label>Connector</Label>
                  <Select value={selectedConnectorId} onValueChange={(v) => v && setSelectedConnectorId(v)}>
                    <SelectTrigger className="h-8 text-[13px]">
                      <SelectValue placeholder="Select connector…" />
                    </SelectTrigger>
                    <SelectContent>
                      {connectors.map((c) => (
                        <SelectItem key={c.tenantConnectorId} value={c.tenantConnectorId}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Mapping table */}
                {selectedConnectorId && (
                  <>
                    <div className="border border-hairline rounded-md overflow-hidden">
                      <table className="w-full text-[12px]">
                        <thead className="bg-canvas-soft border-b border-hairline">
                          <tr>
                            <th className="px-2 py-2 text-left text-[10px] uppercase tracking-wider font-medium text-ink-mute">Source Field</th>
                            <th className="px-2 py-2 text-left text-[10px] uppercase tracking-wider font-medium text-ink-mute">Target Table</th>
                            <th className="px-2 py-2 text-left text-[10px] uppercase tracking-wider font-medium text-ink-mute">Target Column</th>
                            <th className="px-2 py-2 text-left text-[10px] uppercase tracking-wider font-medium text-ink-mute">Transform</th>
                            <th className="px-2 py-2 text-left text-[10px] uppercase tracking-wider font-medium text-ink-mute">Default</th>
                            <th className="w-8" />
                          </tr>
                        </thead>
                        <tbody>
                          {mappingRows.map((row) => (
                            <tr key={row._localId} className="border-b border-hairline last:border-0">
                              {(["sourceField", "targetTable", "targetColumn", "transform", "defaultValue"] as const).map((field) => (
                                <td key={field} className="px-1 py-1">
                                  <input
                                    type="text"
                                    value={row[field]}
                                    onChange={(e) => updateRow(row._localId, field, e.target.value)}
                                    className="w-full h-7 rounded border border-transparent px-1.5 text-[12px] bg-transparent hover:border-hairline focus:border-primary focus:outline-none"
                                    placeholder="…"
                                  />
                                </td>
                              ))}
                              <td className="px-1 py-1 text-center">
                                <button
                                  onClick={() => removeRow(row._localId)}
                                  className="size-6 flex items-center justify-center rounded text-ink-mute hover:text-red-500 hover:bg-red-50 transition-colors"
                                  title="Remove row"
                                >
                                  <Trash2Icon className="size-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {mappingRows.length === 0 && (
                            <tr>
                              <td colSpan={6} className="px-3 py-4 text-center text-[12px] text-ink-mute">
                                No mappings yet. Add a row to get started.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center justify-between">
                      <button
                        onClick={addRow}
                        className="flex items-center gap-1.5 text-[13px] text-ink-secondary hover:text-ink transition-colors"
                      >
                        <PlusIcon className="size-3.5" />
                        Add Row
                      </button>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => saveMappingsMutation.mutate()}
                          disabled={saveMappingsMutation.isPending}
                        >
                          <SaveIcon className="size-3.5 mr-1.5" />
                          {saveMappingsMutation.isPending ? "Saving…" : "Save Mappings"}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => activateMutation.mutate()}
                          disabled={activateMutation.isPending || mappingRows.length === 0}
                        >
                          <ZapIcon className="size-3.5 mr-1.5" />
                          {activateMutation.isPending ? "Activating…" : "Activate Version"}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </section>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-[13px] text-ink-mute bg-canvas">
          Select a profile or create a new one
        </div>
      )}
    </div>
  );
}

function ImportProfilesPage() {
  return <ImportProfilesView />;
}
