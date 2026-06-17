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
import { isLocalizedText, resolveLocalizedText } from "@repo/ui/lib/localized-text";
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
type BatchStatus =
  | "pending"
  | "queued"
  | "processing"
  | "validating"
  | "validated"
  | "approved"
  | "posted"
  | "failed"
  | "rejected";

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
  profileId?: string | null;
  status: BatchStatus;
  rowCount: number;
  createdAt: string;
  targetEntity: string;
}

interface BatchRow {
  rowId: string;
  status: string;
  payload: Record<string, unknown>;
  missingReferences?: Record<string, unknown> | null;
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
  queued: {
    label: "Queued",
    className: "bg-slate-100 text-slate-700 border-slate-200",
    icon: ClockIcon,
  },
  processing: {
    label: "Processing",
    className: "bg-blue-100 text-blue-700 border-blue-200",
    icon: ShieldCheckIcon,
  },
  validating: {
    label: "Validating",
    className: "bg-blue-100 text-blue-700 border-blue-200",
    icon: ShieldCheckIcon,
  },
  validated: {
    label: "Validated",
    className: "bg-teal-100 text-teal-700 border-teal-200",
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

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ── Büroware types ───────────────────────────────────────────────────────────
interface BuerowareLayout {
  layoutId: string;
  fileName: string;
  dataArea: string;
  qualifier: string | null;
  defaultTargetEntity: string | null;
  fieldCount: number;
}

interface UploadResult {
  batchId: string;
  status: string;
  needsLayoutSelection?: boolean;
  layouts: BuerowareLayout[];
}

interface LayoutField {
  fieldId: string;
  buerowareFieldId: string;
  label: string | null;
  sampleValue: string | null;
  position: number | null;
  length: number | null;
  formatting: string | null;
  included: boolean;
  targetField: string | null;
  referenceEntity: string | null;
}

interface TargetField {
  fieldName: string;
  label: unknown;
  isRequired?: boolean;
}

interface LayoutFieldsResult {
  layout: BuerowareLayout;
  targetEntity: string | null;
  metadataEntity: string | null;
  targetFields: TargetField[];
  resolvedVersionId: string | null;
  fields: LayoutField[];
}

interface BuerowareTemplate {
  profileId: string;
  label: string;
  slug: string;
  versionId: string;
}

const NOT_IMPORTED = "__none__";

function localized(label: unknown): string {
  if (typeof label === "string") return label;
  return isLocalizedText(label) ? resolveLocalizedText(label, "de") : "";
}

// ── Field assignment mask (hybrid: import field ↔ tenant target field) ────────
function FieldAssignmentMask({
  batchId,
  layout,
  onRan,
}: {
  batchId: string;
  layout: BuerowareLayout;
  onRan: (batchId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [templateProfileId, setTemplateProfileId] = useState<string>("");
  const assignmentSourceKey = `${layout.layoutId}:${templateProfileId}`;
  const [editsState, setEditsState] = useState<{
    sourceKey: string;
    edits: Record<string, { included: boolean; targetField: string }>;
  }>(() => ({ sourceKey: assignmentSourceKey, edits: {} }));
  const edits = editsState.sourceKey === assignmentSourceKey ? editsState.edits : {};
  const [filter, setFilter] = useState("");
  const [onlyMapped, setOnlyMapped] = useState(false);
  const [templateName, setTemplateName] = useState("");

  const { data: templates = [] } = useQuery<BuerowareTemplate[]>({
    queryKey: ["import", "bw-templates", layout.layoutId],
    queryFn: async () => {
      const { items } = await capability("import.bueroware.listTemplates")({
        layoutId: layout.layoutId,
      });
      return items as unknown as BuerowareTemplate[];
    },
  });

  const { data: fieldsData, isLoading } = useQuery<LayoutFieldsResult>({
    queryKey: ["import", "bw-fields", layout.layoutId, templateProfileId],
    queryFn: async () =>
      (await capability("import.bueroware.getLayoutFields")({
        layoutId: layout.layoutId,
        ...(templateProfileId ? { templateProfileId } : {}),
      })) as unknown as LayoutFieldsResult,
  });

  const targetFields = fieldsData?.targetFields ?? [];
  const fields = fieldsData?.fields ?? [];

  const effectiveRow = (f: LayoutField) => {
    const e = edits[f.buerowareFieldId];
    return {
      included: e?.included ?? f.included,
      targetField: e?.targetField ?? f.targetField ?? "",
    };
  };

  const setRow = (id: string, patch: Partial<{ included: boolean; targetField: string }>) => {
    setEditsState((prevState) => {
      const prev = prevState.sourceKey === assignmentSourceKey ? prevState.edits : {};
      const base = prev[id] ?? {
        included: fields.find((f) => f.buerowareFieldId === id)?.included ?? false,
        targetField: fields.find((f) => f.buerowareFieldId === id)?.targetField ?? "",
      };
      return {
        sourceKey: assignmentSourceKey,
        edits: { ...prev, [id]: { ...base, ...patch } },
      };
    });
  };

  const assignedFields = () =>
    fields
      .map((f) => ({ f, r: effectiveRow(f) }))
      .filter(({ r }) => r.included && r.targetField && r.targetField !== NOT_IMPORTED)
      .map(({ f, r }) => ({ buerowareFieldId: f.buerowareFieldId, targetField: r.targetField }));

  const saveTemplateMutation = useMutation({
    mutationFn: async () => {
      if (!templateName.trim()) throw new Error("Vorlagenname erforderlich.");
      return capability("import.bueroware.saveTemplate")({
        layoutId: layout.layoutId,
        label: templateName.trim(),
        fields: assignedFields(),
      });
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ["import", "bw-templates", layout.layoutId] });
      setTemplateProfileId(res.profileId);
      setTemplateName("");
      setEditsState({ sourceKey: `${layout.layoutId}:${res.profileId}`, edits: {} });
      toast.success(`Vorlage gespeichert (${res.fieldCount} Felder)`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      // Bind the chosen data area + mapping source to the batch, then process it.
      await capability("import.bueroware.selectLayout")({
        batchId,
        layoutId: layout.layoutId,
        ...(templateProfileId ? { profileId: templateProfileId } : {}),
      });
      return capability("import.bueroware.runNextJob")({});
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["import", "batches"] });
      toast.success(result.status === "idle" ? "Kein Job in der Queue" : `Job ${result.status}`);
      onRan(batchId);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const visibleFields = fields.filter((f) => {
    if (onlyMapped && !effectiveRow(f).included) return false;
    if (!filter) return true;
    const hay = `${f.label ?? ""} ${f.buerowareFieldId}`.toLowerCase();
    return hay.includes(filter.toLowerCase());
  });

  const assignedCount = fields.filter((f) => effectiveRow(f).included && effectiveRow(f).targetField)
    .length;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-canvas">
      <div className="shrink-0 border-b border-hairline bg-canvas-soft px-6 py-4">
        <div className="text-[11px] font-medium tracking-[0.18em] text-ink-mute uppercase">
          Feldzuweisung · {layout.fileName}
        </div>
        <h1 className="mt-1 text-[18px] font-semibold text-ink">
          {layout.dataArea}
          <span className="ml-2 text-[12px] font-normal text-ink-mute">
            Satzkürzel {layout.qualifier ?? "*"} → {fieldsData?.targetEntity ?? "—"} ·{" "}
            {assignedCount}/{layout.fieldCount} zugewiesen
          </span>
        </h1>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Select
            value={templateProfileId || "__default__"}
            onValueChange={(v) => setTemplateProfileId(!v || v === "__default__" ? "" : v)}
          >
            <SelectTrigger className="h-8 w-64">
              <SelectValue placeholder="Vorlage…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__default__">Zentrale Default-Zuweisung</SelectItem>
              {templates.map((t) => (
                <SelectItem key={t.profileId} value={t.profileId}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Felder filtern…"
            className="h-8 w-48 rounded border border-hairline bg-canvas px-2 text-[12px] focus:border-primary focus:outline-none"
          />
          <label className="flex items-center gap-1.5 text-[12px] text-ink-secondary">
            <input
              type="checkbox"
              checked={onlyMapped}
              onChange={(e) => setOnlyMapped(e.target.checked)}
            />
            Nur zugewiesene
          </label>
          <div className="ml-auto flex items-center gap-2">
            <input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Vorlagenname"
              className="h-8 w-44 rounded border border-hairline bg-canvas px-2 text-[12px] focus:border-primary focus:outline-none"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => saveTemplateMutation.mutate()}
              disabled={saveTemplateMutation.isPending || !templateName.trim()}
            >
              Als Vorlage speichern
            </Button>
            <Button size="sm" onClick={() => runMutation.mutate()} disabled={runMutation.isPending}>
              <SendIcon className="mr-1 size-3.5" />
              {runMutation.isPending ? "Import läuft…" : "Importieren"}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center text-[13px] text-ink-mute">
            Lade Felder…
          </div>
        ) : (
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 z-10 border-b border-hairline bg-canvas-soft">
              <tr>
                <th className="w-10 px-3 py-2"></th>
                <th className="px-3 py-2 text-left text-[10px] font-medium tracking-wider text-ink-mute uppercase">
                  Importfeld (Büroware)
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-medium tracking-wider text-ink-mute uppercase">
                  Beispiel · Pos/Länge
                </th>
                <th className="w-72 px-3 py-2 text-left text-[10px] font-medium tracking-wider text-ink-mute uppercase">
                  Zielfeld ({fieldsData?.targetEntity ?? "—"})
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleFields.map((f, idx) => {
                const row = effectiveRow(f);
                const isCustom = row.targetField.startsWith("customAttributes.");
                return (
                  <tr
                    key={f.fieldId}
                    className={cn(
                      "border-b border-hairline",
                      idx % 2 === 0 ? "bg-canvas" : "bg-canvas-soft/40",
                    )}
                  >
                    <td className="px-3 py-1.5">
                      <input
                        type="checkbox"
                        checked={row.included}
                        onChange={(e) => setRow(f.buerowareFieldId, { included: e.target.checked })}
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="font-medium text-ink">{f.label ?? f.buerowareFieldId}</div>
                      <div className="font-mono text-[10px] text-ink-mute">{f.buerowareFieldId}</div>
                    </td>
                    <td className="px-3 py-1.5 text-ink-secondary">
                      <span className="font-mono text-[11px]">{f.sampleValue || "—"}</span>
                      <span className="ml-2 text-[10px] text-ink-mute">
                        {f.position ?? "?"}/{f.length ?? "?"}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">
                      <select
                        value={row.targetField || NOT_IMPORTED}
                        onChange={(e) =>
                          setRow(f.buerowareFieldId, {
                            targetField: e.target.value === NOT_IMPORTED ? "" : e.target.value,
                            included: e.target.value !== NOT_IMPORTED,
                          })
                        }
                        className="h-7 w-full rounded border border-hairline bg-canvas px-2 text-[12px] focus:border-primary focus:outline-none"
                      >
                        <option value={NOT_IMPORTED}>— nicht importieren —</option>
                        {isCustom && (
                          <option value={row.targetField}>Custom: {row.targetField.slice(17)}</option>
                        )}
                        {targetFields.map((t) => (
                          <option key={t.fieldName} value={t.fieldName}>
                            {localized(t.label) || t.fieldName}
                            {t.isRequired ? " *" : ""}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
              {visibleFields.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-[13px] text-ink-mute">
                    Keine Felder.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function BuerowareAssistant({ onSelectBatch }: { onSelectBatch: (batchId: string) => void }) {
  const queryClient = useQueryClient();
  const [dataFile, setDataFile] = useState<File | null>(null);
  const [upload, setUpload] = useState<UploadResult | null>(null);
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!dataFile) throw new Error("Büroware-Datei ist erforderlich.");
      const params = new URLSearchParams({ fileName: dataFile.name });
      const response = await fetch(`/api/import/bueroware/upload?${params.toString()}`, {
        method: "POST",
        headers: {
          "content-type": dataFile.name.toLowerCase().endsWith(".zip")
            ? "application/zip"
            : "application/octet-stream",
        },
        body: dataFile,
      });
      const body = (await response.json()) as UploadResult & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Büroware upload failed");
      if (!body.batchId) throw new Error("Upload returned no batch id");
      return body;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["import", "batches"] });
      setUpload(result);
      // Auto-select when there is exactly one data area.
      setSelectedLayoutId(result.layouts.length === 1 ? result.layouts[0].layoutId : null);
      if (result.layouts.length === 0) {
        toast.error("Für diese Datei ist kein zentrales Layout registriert.");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reconcileMutation = useMutation({
    mutationFn: async () => capability("import.bueroware.reconcile")({}),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["import", "batches"] });
      toast.success(
        `Reconcile: ${result.posted} posted, ${result.pendingReferences} pending, ${result.failed} failed`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const selectedLayout = upload?.layouts.find((l) => l.layoutId === selectedLayoutId) ?? null;

  // Field assignment view once a data area is chosen.
  if (upload && selectedLayout) {
    return (
      <FieldAssignmentMask
        batchId={upload.batchId}
        layout={selectedLayout}
        onRan={(batchId) => {
          setUpload(null);
          setSelectedLayoutId(null);
          setDataFile(null);
          onSelectBatch(batchId);
        }}
      />
    );
  }

  return (
    <div className="flex h-full flex-col overflow-auto bg-canvas">
      <div className="border-b border-hairline bg-canvas-soft px-6 py-5">
        <div className="text-[11px] font-medium tracking-[0.18em] text-ink-mute uppercase">
          Büroware Import
        </div>
        <h1 className="mt-1 text-[20px] font-semibold text-ink">Import-Assistent</h1>
        <p className="mt-1 max-w-3xl text-[13px] text-ink-secondary">
          Lade eine Büroware `.SEDB` oder `.zip` hoch. Das System erkennt die Datei über den Namen
          und ihre Datenbereiche aus dem zentralen Satzbeschreibungs-Katalog. Bei mehreren
          Datenbereichen wählst du zuerst den passenden, danach weist du die Felder zu.
        </p>
      </div>

      <div className="grid gap-4 p-6 xl:grid-cols-3">
        <section className="rounded-xl border border-hairline bg-canvas p-4 shadow-sm">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold text-primary">Schritt 1</div>
              <h2 className="text-[15px] font-semibold text-ink">Datei hochladen</h2>
            </div>
            <UploadCloudIcon className="size-5 text-ink-mute" />
          </div>

          <p className="mb-3 text-[12px] text-ink-secondary">
            Akzeptiert `.SEDB` und `.zip`. ZIP-Dateien werden serverseitig entpackt. Der enthaltene
            `.sedb` Dateiname bestimmt die Schema-Erkennung.
          </p>

          <div className="flex flex-col gap-3">
            <div className="rounded-lg border border-dashed border-hairline bg-canvas-soft px-4 py-6">
              <input
                type="file"
                accept=".sedb,.SEDB,.zip,application/zip"
                onChange={(e) => setDataFile(e.target.files?.[0] ?? null)}
                className="text-[12px] text-ink-secondary file:mr-3 file:rounded-md file:border-0 file:bg-canvas file:px-3 file:py-1.5 file:text-[12px] file:text-ink"
              />
              {dataFile && (
                <div className="mt-3 text-[12px] text-ink-secondary">
                  {dataFile.name} · {formatBytes(dataFile.size)}
                </div>
              )}
            </div>

            <Button
              onClick={() => uploadMutation.mutate()}
              disabled={uploadMutation.isPending || !dataFile}
            >
              {uploadMutation.isPending ? "Upload läuft…" : "Hochladen & erkennen"}
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-hairline bg-canvas p-4 shadow-sm">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold text-primary">Schritt 2</div>
              <h2 className="text-[15px] font-semibold text-ink">Datenbereich wählen</h2>
            </div>
            <ShieldCheckIcon className="size-5 text-ink-mute" />
          </div>

          {!upload ? (
            <p className="text-[12px] text-ink-secondary">
              Nach dem Upload erscheinen hier die Datenbereiche der Datei (z.B. Artikel,
              Warengruppe, Lager). Bei nur einem Bereich geht es direkt zur Feldzuweisung.
            </p>
          ) : upload.layouts.length === 0 ? (
            <p className="text-[12px] text-red-600">
              Kein zentrales Layout für {upload.layouts[0]?.fileName ?? "diese Datei"} registriert.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {upload.layouts.map((l) => (
                <button
                  key={l.layoutId}
                  onClick={() => setSelectedLayoutId(l.layoutId)}
                  className={cn(
                    "flex items-center justify-between rounded-lg border px-3 py-2 text-left text-[12px] transition-colors",
                    selectedLayoutId === l.layoutId
                      ? "border-primary bg-[color-mix(in_oklab,var(--primary)_8%,transparent)]"
                      : "border-hairline hover:bg-canvas-soft",
                  )}
                >
                  <span className="font-medium text-ink">{l.dataArea}</span>
                  <span className="text-[11px] text-ink-mute">
                    {l.qualifier ?? "*"} · {l.fieldCount} Felder
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-hairline bg-canvas p-4 shadow-sm">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold text-primary">Schritt 3</div>
              <h2 className="text-[15px] font-semibold text-ink">Offene Referenzen</h2>
            </div>
            <FileTextIcon className="size-5 text-ink-mute" />
          </div>

          <p className="mb-3 text-[12px] text-ink-secondary">
            Importe, deren Fremdschlüssel (z.B. Warengruppe) noch fehlten, werden nach dem Nachladen
            der referenzierten Daten erneut aufgelöst.
          </p>

          <Button
            variant="outline"
            onClick={() => reconcileMutation.mutate()}
            disabled={reconcileMutation.isPending}
          >
            {reconcileMutation.isPending ? "Reconcile läuft…" : "Offene Referenzen auflösen"}
          </Button>
        </section>
      </div>
    </div>
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
  const showApprove =
    batch.status === "pending" || batch.status === "validating" || batch.status === "validated";
  const showPost = batch.status === "approved";
  const validCount = rows.filter((row) => row.status === "valid" || row.status === "posted").length;
  const pendingReferenceCount = rows.filter((row) => row.status === "pending_references").length;
  const failedCount = rows.filter((row) => row.status === "failed").length;

  const handleDownloadErrorReport = () => {
    const reportRows = rows
      .filter((row) => row.status === "failed" || row.status === "pending_references")
      .map((row) => ({
        rowId: row.rowId,
        status: row.status,
        missingReferences: row.missingReferences ?? null,
        error: row.errorDetail?.message ?? null,
        payload: row.payload,
      }));
    const blob = new Blob([JSON.stringify(reportRows, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `import-errors-${batchId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

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
          <div className="text-[12px] text-ink-mute">
            {validCount} valid / {pendingReferenceCount} pending references / {failedCount} failed
          </div>
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
          <Button size="sm" variant="outline" onClick={handleDownloadErrorReport}>
            Error report
          </Button>
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
                References / Error
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
                  {row.missingReferences && Object.keys(row.missingReferences).length > 0 ? (
                    <span
                      className="block max-w-[240px] truncate text-[11px] text-amber-700"
                      title={JSON.stringify(row.missingReferences)}
                    >
                      Missing {Object.keys(row.missingReferences).join(", ")}
                    </span>
                  ) : row.errorDetail?.message ? (
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
        <div className="flex shrink-0 flex-col gap-2 border-b border-hairline px-3 py-2">
          <span className="text-[13px] font-medium text-ink">Import</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setSelectedBatchId(null);
                setSubCrumb("Büroware");
              }}
              className="flex h-7 items-center justify-center gap-1.5 rounded-md border border-hairline px-2.5 text-[12px] font-medium transition-colors hover:bg-canvas"
            >
              <ShieldCheckIcon className="size-3.5" />
              Büroware
            </button>
            <button
              onClick={() => setUploadOpen(true)}
              className="flex h-7 items-center justify-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium transition-colors"
              style={{ background: "var(--primary)", color: "var(--primary-fg)" }}
            >
              <UploadCloudIcon className="size-3.5" />
              CSV
            </button>
          </div>
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
            <option value="queued">Queued</option>
            <option value="processing">Processing</option>
            <option value="validating">Validating</option>
            <option value="validated">Validated</option>
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
          <BuerowareAssistant
            onSelectBatch={(batchId) => {
              setSelectedBatchId(batchId);
              setSubCrumb("Büroware");
            }}
          />
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
