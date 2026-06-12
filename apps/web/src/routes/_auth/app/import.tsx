import { Button } from "@repo/ui/components/button";
import { Dialog, DialogContent } from "@repo/ui/components/dialog";
import { Label } from "@repo/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { cn } from "@repo/ui/lib/utils";
import { useActionBar } from "@repo/ui/platform/action-bar-context";
import { useCommands } from "@repo/ui/platform/command-registry";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  UploadCloudIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ShieldCheckIcon,
  MinusCircleIcon,
  ThumbsUpIcon,
  SendIcon,
  FileTextIcon,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";

import { capability } from "#/server-fns/capabilities";

export const Route = createFileRoute("/_auth/app/import")({
  component: ImportModule,
});

// ── Types ──────────────────────────────────────────────────────────────────
type BatchStatus = "pending" | "validating" | "approved" | "posted" | "failed" | "rejected";

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

interface ImportBatch {
  batchId: string;
  profileId: string;
  status: BatchStatus;
  rowCount: number;
  createdAt: string;
  targetEntity: string;
}

interface BatchRow {
  rowId: string;
  status: string;
  payload: Record<string, unknown>;
  errorDetail?: { message?: string } | null;
  postedAt?: string | null;
}

interface BatchDetail {
  batch: ImportBatch & { profileLabel?: string };
  rows: BatchRow[];
}

// ── Status badge ───────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  BatchStatus,
  { label: string; className: string; icon: React.ComponentType<{ className?: string }> }
> = {
  pending: {
    label: "Pending",
    className: "bg-amber-100 text-amber-700 border-amber-200",
    icon: ClockIcon,
  },
  validating: {
    label: "Validating",
    className: "bg-blue-100 text-blue-700 border-blue-200",
    icon: ShieldCheckIcon,
  },
  approved: {
    label: "Approved",
    className: "bg-indigo-100 text-indigo-700 border-indigo-200",
    icon: CheckCircleIcon,
  },
  posted: {
    label: "Posted",
    className: "bg-emerald-100 text-emerald-700 border-emerald-200",
    icon: CheckCircleIcon,
  },
  failed: {
    label: "Failed",
    className: "bg-red-100 text-red-700 border-red-200",
    icon: XCircleIcon,
  },
  rejected: {
    label: "Rejected",
    className: "bg-gray-100 text-gray-600 border-gray-200",
    icon: MinusCircleIcon,
  },
};

function StatusBadge({ status }: { status: BatchStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.failed;
  const Icon = cfg.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        cfg.className,
      )}
    >
      <Icon className="size-3" />
      {cfg.label}
    </span>
  );
}

// ── Relative time helper ───────────────────────────────────────────────────
function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Payload preview ────────────────────────────────────────────────────────
function PayloadPreview({ payload }: { payload: Record<string, unknown> }) {
  const entries = Object.entries(payload).slice(0, 3);
  return (
    <span className="max-w-xs truncate font-mono text-[11px] text-ink-secondary">
      {entries.map(([k, v]) => `${k}: ${String(v)}`).join(" · ")}
    </span>
  );
}

// ── Upload CSV Modal ───────────────────────────────────────────────────────
function UploadModal({
  open,
  onClose,
  profiles,
  connectors,
}: {
  open: boolean;
  onClose: () => void;
  profiles: ImportProfile[];
  connectors: ImportConnector[];
}) {
  const queryClient = useQueryClient();
  const [profileId, setProfileId] = useState("");
  const [connectorId, setConnectorId] = useState("");
  const [delimiter, setDelimiter] = useState(",");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file || !profileId || !connectorId) throw new Error("Please fill in all fields.");
      const csvText = await file.text();
      return capability("import.importBatch.upload")({
        csvText,
        profileId,
        tenantConnectorId: connectorId,
        delimiter,
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["import", "batches"] });
      toast.success(`Batch created: ${data.rowCount} rows`);
      onClose();
      // reset
      setProfileId("");
      setConnectorId("");
      setDelimiter(",");
      setFile(null);
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <div className="flex flex-col gap-4 p-1">
          <h2 className="text-[15px] font-semibold text-ink">Upload CSV</h2>

          {/* Profile */}
          <div className="flex flex-col gap-1.5">
            <Label>Import Profile</Label>
            <Select value={profileId} onValueChange={(v) => v && setProfileId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select profile…" />
              </SelectTrigger>
              <SelectContent>
                {profiles
                  .filter((p) => !p.archived)
                  .map((p) => (
                    <SelectItem key={p.profileId} value={p.profileId}>
                      {p.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Connector */}
          <div className="flex flex-col gap-1.5">
            <Label>Connector</Label>
            <Select value={connectorId} onValueChange={(v) => v && setConnectorId(v)}>
              <SelectTrigger>
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

          {/* File drop */}
          <div className="flex flex-col gap-1.5">
            <Label>CSV File</Label>
            <button
              type="button"
              className={cn(
                "flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 transition-colors",
                isDragging
                  ? "border-primary bg-[color-mix(in_oklab,var(--primary)_8%,transparent)]"
                  : "border-hairline hover:border-hairline-input",
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloudIcon className="size-8 text-ink-mute" />
              {file ? (
                <span className="text-[13px] font-medium text-ink">{file.name}</span>
              ) : (
                <>
                  <span className="text-[13px] text-ink-secondary">
                    Drag & drop a CSV file here
                  </span>
                  <span className="text-[11px] text-ink-mute">or click to browse</span>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setFile(f);
                }}
              />
            </button>
          </div>

          {/* Delimiter */}
          <div className="flex flex-col gap-1.5">
            <Label>Delimiter</Label>
            <input
              type="text"
              value={delimiter}
              onChange={(e) => setDelimiter(e.target.value)}
              maxLength={3}
              className="h-8 w-24 rounded border border-hairline bg-canvas px-2 text-[13px] focus:border-primary focus:outline-none"
              placeholder=","
            />
          </div>

          {error && <p className="text-[13px] text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button
              onClick={() => mutation.mutate()}
              disabled={!profileId || !connectorId || !file || mutation.isPending}
            >
              {mutation.isPending ? "Uploading…" : "Upload"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Batch Detail Panel ─────────────────────────────────────────────────────
function BatchDetailPanel({ batchId, profiles }: { batchId: string; profiles: ImportProfile[] }) {
  const queryClient = useQueryClient();
  const [isBusy, setIsBusy] = useState(false);

  const { data, isLoading } = useQuery<BatchDetail>({
    queryKey: ["import", "batch", batchId],
    queryFn: async () =>
      (await capability("import.importBatch.get")({ batchId })) as unknown as BatchDetail,
  });

  const profile = data ? profiles.find((p) => p.profileId === data.batch.profileId) : null;

  const handleApprove = async () => {
    setIsBusy(true);
    try {
      await capability("import.importBatch.approve")({ batchId });
      queryClient.invalidateQueries({ queryKey: ["import", "batch", batchId] });
      queryClient.invalidateQueries({ queryKey: ["import", "batches"] });
      toast.success("Batch approved");
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setIsBusy(false);
    }
  };

  const handlePost = async () => {
    setIsBusy(true);
    try {
      const result = await capability("import.importBatch.post")({ batchId });
      queryClient.invalidateQueries({ queryKey: ["import", "batch", batchId] });
      queryClient.invalidateQueries({ queryKey: ["import", "batches"] });
      toast.success(
        `Posted ${result.posted} rows${result.failed ? `, ${result.failed} failed` : ""}`,
      );
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setIsBusy(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-[13px] text-ink-mute">
        Loading…
      </div>
    );
  }

  if (!data) return null;

  const { batch, rows } = data;
  const showApprove = batch.status === "pending" || batch.status === "validating";
  const showPost = batch.status === "approved";

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-canvas">
      {/* Header */}
      <div className="flex shrink-0 items-start gap-3 border-b border-hairline px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <StatusBadge status={batch.status} />
            <span className="text-[11px] text-ink-mute">{relativeTime(batch.createdAt)}</span>
          </div>
          <div className="truncate text-[13px] font-medium text-ink">
            {profile?.label ?? batch.targetEntity}
          </div>
          <div className="text-[12px] text-ink-mute">{batch.rowCount} rows</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {showApprove && (
            <Button size="sm" variant="outline" onClick={handleApprove} disabled={isBusy}>
              <ThumbsUpIcon className="mr-1 size-3.5" />
              Approve
            </Button>
          )}
          {showPost && (
            <Button size="sm" onClick={handlePost} disabled={isBusy}>
              <SendIcon className="mr-1 size-3.5" />
              Post
            </Button>
          )}
        </div>
      </div>

      {/* Row table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-[12px]">
          <thead className="sticky top-0 border-b border-hairline bg-canvas-soft">
            <tr>
              <th className="w-10 px-3 py-2 text-left text-[10px] font-medium tracking-wider text-ink-mute uppercase">
                #
              </th>
              <th className="w-24 px-3 py-2 text-left text-[10px] font-medium tracking-wider text-ink-mute uppercase">
                Status
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-medium tracking-wider text-ink-mute uppercase">
                Payload
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-medium tracking-wider text-ink-mute uppercase">
                Error
              </th>
              <th className="w-28 px-3 py-2 text-left text-[10px] font-medium tracking-wider text-ink-mute uppercase">
                Posted At
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={row.rowId}
                className={cn(
                  "border-b border-hairline",
                  idx % 2 === 0 ? "bg-canvas" : "bg-canvas-soft/40",
                )}
              >
                <td className="px-3 py-2 text-ink-mute tabular-nums">{idx + 1}</td>
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      "text-[11px] font-medium",
                      row.status === "posted"
                        ? "text-emerald-600"
                        : row.status === "failed"
                          ? "text-red-600"
                          : row.status === "pending"
                            ? "text-amber-600"
                            : "text-ink-secondary",
                    )}
                  >
                    {row.status}
                  </span>
                </td>
                <td className="max-w-xs px-3 py-2">
                  <PayloadPreview payload={row.payload} />
                </td>
                <td className="max-w-xs px-3 py-2">
                  {row.errorDetail?.message ? (
                    <span
                      className="block max-w-[200px] truncate text-[11px] text-red-600"
                      title={row.errorDetail.message}
                    >
                      {row.errorDetail.message.slice(0, 80)}
                      {row.errorDetail.message.length > 80 ? "…" : ""}
                    </span>
                  ) : (
                    <span className="text-ink-mute">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-ink-mute">
                  {row.postedAt ? new Date(row.postedAt).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-[13px] text-ink-mute">
                  No rows in this batch.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
function ImportModule() {
  const { registerCommand } = useCommands();
  const { setSubCrumb } = useActionBar();
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [filterProfileId, setFilterProfileId] = useState("all");
  const [filterStatus, setFilterStatus] = useState<"all" | BatchStatus>("all");

  useEffect(() => () => setSubCrumb(undefined), [setSubCrumb]);

  const { data: profiles = [] } = useQuery<ImportProfile[]>({
    queryKey: ["import", "profiles"],
    queryFn: async () => {
      const { items } = await capability("import.importProfile.list")({});
      return items as unknown as ImportProfile[];
    },
  });

  const { data: connectors = [] } = useQuery<ImportConnector[]>({
    queryKey: ["import", "connectors"],
    queryFn: async () => {
      const { items } = await capability("import.tenantConnector.list")({});
      return items as unknown as ImportConnector[];
    },
  });

  const { data: batches = [], isLoading } = useQuery<ImportBatch[]>({
    queryKey: ["import", "batches", filterProfileId, filterStatus],
    queryFn: async () => {
      const { items } = await capability("import.importBatch.list")({
        ...(filterProfileId !== "all" ? { profileId: filterProfileId } : {}),
        ...(filterStatus !== "all" ? { status: filterStatus } : {}),
      });
      return items as unknown as ImportBatch[];
    },
  });

  useEffect(() => {
    const unrg = registerCommand({
      id: "import-upload",
      scope: "context",
      label: { en: "Upload CSV", de: "CSV hochladen" },
      shortcut: "F3",
      group: "import",
      handler: () => setUploadOpen(true),
    });
    return unrg;
  }, [registerCommand]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left panel ── */}
      <div className="flex w-80 shrink-0 flex-col overflow-hidden border-r border-hairline bg-canvas-soft">
        {/* Panel header */}
        <div className="flex shrink-0 items-center justify-between border-b border-hairline px-3 py-2">
          <span className="text-[13px] font-medium text-ink">Import</span>
          <button
            onClick={() => setUploadOpen(true)}
            className="flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium transition-colors"
            style={{ background: "var(--primary)", color: "var(--primary-fg)" }}
          >
            <UploadCloudIcon className="size-3.5" />
            Upload CSV
          </button>
        </div>

        {/* Filters */}
        <div className="flex shrink-0 gap-2 border-b border-hairline px-3 py-2">
          <select
            value={filterProfileId}
            onChange={(e) => setFilterProfileId(e.target.value)}
            className="h-7 flex-1 rounded border border-hairline bg-canvas px-2 text-[12px] text-ink focus:border-primary focus:outline-none"
          >
            <option value="all">All profiles</option>
            {profiles.map((p) => (
              <option key={p.profileId} value={p.profileId}>
                {p.label}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as "all" | BatchStatus)}
            className="h-7 w-28 rounded border border-hairline bg-canvas px-2 text-[12px] text-ink focus:border-primary focus:outline-none"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="validating">Validating</option>
            <option value="approved">Approved</option>
            <option value="posted">Posted</option>
            <option value="failed">Failed</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {/* Batch list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex h-24 items-center justify-center text-[13px] text-ink-mute">
              Loading…
            </div>
          ) : batches.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center gap-2 text-ink-mute">
              <FileTextIcon className="size-8 opacity-30" />
              <span className="text-[13px]">No batches found</span>
            </div>
          ) : (
            batches.map((batch) => {
              const profile = profiles.find((p) => p.profileId === batch.profileId);
              const isSelected = batch.batchId === selectedBatchId;
              return (
                <button
                  key={batch.batchId}
                  onClick={() => {
                    setSelectedBatchId(batch.batchId);
                    setSubCrumb(profile?.label ?? batch.targetEntity);
                  }}
                  className={cn(
                    "w-full border-b border-hairline px-3 py-2.5 text-left transition-colors",
                    isSelected
                      ? "border-l-2 border-l-primary bg-[color-mix(in_oklab,var(--primary)_8%,var(--canvas))]"
                      : "hover:bg-canvas",
                  )}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="max-w-[140px] truncate text-[13px] font-medium text-ink">
                      {profile?.label ?? batch.targetEntity}
                    </span>
                    <StatusBadge status={batch.status} />
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-ink-mute">
                    <span>{batch.rowCount} rows</span>
                    <span>·</span>
                    <span>{relativeTime(batch.createdAt)}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex flex-1 flex-col overflow-hidden bg-canvas">
        {selectedBatchId ? (
          <BatchDetailPanel batchId={selectedBatchId} profiles={profiles} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-ink-mute">
            <FileTextIcon className="size-12 opacity-20" />
            <span className="text-[14px]">Select a batch to view details</span>
          </div>
        )}
      </div>

      {/* ── Upload modal ── */}
      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        profiles={profiles}
        connectors={connectors}
      />
    </div>
  );
}
