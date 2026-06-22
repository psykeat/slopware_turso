import { Button } from "@repo/ui/components/button";
import { Label } from "@repo/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { cn } from "@repo/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { DownloadIcon, Loader2Icon, PlayIcon, RefreshCwIcon, RotateCwIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { capability } from "#/server-fns/capabilities";

export const Route = createFileRoute("/_auth/app/settings/commerce-sync")({
  component: CommerceSyncPage,
});

interface SalesChannelRecord {
  salesChannelId: string;
  name: string;
  platform: string;
  isActive: boolean;
}

interface SyncRunRecord {
  runId: string;
  salesChannelId: string;
  status: string;
  direction: string;
  mode: string;
  dryRun: boolean;
  requestedEntities: string[];
  totalItems: number;
  succeededItems: number;
  failedItems: number;
  errorSummary: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface DlqItemRecord {
  itemId: string;
  runId: string;
  salesChannelId: string;
  entityType: string;
  internalId: string;
  errorMessage: string;
  attemptCount: number;
  status: string;
  lastAttemptedAt: string;
  nextRetryAt: string | null;
}

const SYNC_ENTITIES = [
  { value: "category", label: "Kategorien" },
  { value: "address", label: "Adressen/Kunden" },
  { value: "media_asset", label: "Medien/Bilder" },
  { value: "article", label: "Artikel" },
  { value: "document", label: "Bestellungen" },
] as const;

// Outbound push covers everything except orders, which are inbound-only (pull).
const PUSH_ENTITIES = SYNC_ENTITIES.filter((e) => e.value !== "document");

const RUN_STATUS_META: Record<string, { label: string; tone: string }> = {
  queued: { label: "In Warteschlange", tone: "bg-slate-500/15 text-slate-600" },
  running: { label: "Läuft", tone: "bg-blue-500/15 text-blue-600" },
  success: { label: "Erfolgreich", tone: "bg-green-500/15 text-green-600" },
  partial_error: { label: "Teilfehler", tone: "bg-amber-500/15 text-amber-600" },
  error: { label: "Fehler", tone: "bg-red-500/15 text-red-600" },
  cancel_requested: { label: "Abbruch angefordert", tone: "bg-amber-500/15 text-amber-600" },
  cancelled: { label: "Abgebrochen", tone: "bg-slate-500/15 text-slate-600" },
};

const DLQ_STATUS_META: Record<string, { label: string; tone: string }> = {
  pending: { label: "Ausstehend", tone: "bg-amber-500/15 text-amber-600" },
  resolved: { label: "Aufgelöst", tone: "bg-green-500/15 text-green-600" },
  abandoned: { label: "Aufgegeben", tone: "bg-red-500/15 text-red-600" },
};

function StatusBadge({ meta }: { meta: { label: string; tone: string } | undefined }) {
  if (!meta) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        meta.tone,
      )}
    >
      {meta.label}
    </span>
  );
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt || !completedAt) return "—";
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.round(s % 60)}s`;
}

function downloadCsv(filename: string, rows: Array<Record<string, string | number | boolean>>) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: string | number | boolean) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ].join("\n");
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function KpiCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-hairline bg-canvas-soft px-4 py-3">
      <span className="text-[11px] font-medium tracking-wider text-ink-mute uppercase">
        {label}
      </span>
      <span className={cn("text-[20px] font-semibold text-ink tabular-nums", tone)}>{value}</span>
      {hint && <span className="text-[11px] text-ink-mute">{hint}</span>}
    </div>
  );
}

function CommerceSyncView() {
  const queryClient = useQueryClient();

  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [runStatusFilter, setRunStatusFilter] = useState<string>("all");
  const [dlqStatusFilter, setDlqStatusFilter] = useState<string>("pending");

  // Live-trigger form
  const [triggerEntities, setTriggerEntities] = useState<string[]>(["article"]);
  const [triggerMode, setTriggerMode] = useState<"single" | "full">("full");
  const [triggerDryRun, setTriggerDryRun] = useState(true);
  const [triggerForceFull, setTriggerForceFull] = useState(false);
  const [importDryRun, setImportDryRun] = useState(true);
  const [importForceFull, setImportForceFull] = useState(false);

  const { data: channels = [] } = useQuery<SalesChannelRecord[]>({
    queryKey: ["commerce", "salesChannels"],
    queryFn: async () => {
      const { items } = await capability("commerce.salesChannel.list")({});
      return items as unknown as SalesChannelRecord[];
    },
  });

  // Derived: explicit selection wins, otherwise default to the first active channel.
  const channelId =
    selectedChannelId ??
    channels.find((c) => c.isActive)?.salesChannelId ??
    channels[0]?.salesChannelId ??
    null;

  const refetchInterval = autoRefresh ? 5000 : false;

  const {
    data: runs = [],
    isLoading: runsLoading,
    refetch: refetchRuns,
    isFetching: runsFetching,
  } = useQuery<SyncRunRecord[]>({
    queryKey: ["commerce", "syncRuns", channelId],
    enabled: !!channelId,
    refetchInterval,
    queryFn: async () => {
      const { runs } = await capability("commerce.commerceSyncRun.list")({
        salesChannelId: channelId!,
        limit: 200,
      });
      return runs as unknown as SyncRunRecord[];
    },
  });

  const { data: dlqItems = [], isLoading: dlqLoading } = useQuery<DlqItemRecord[]>({
    queryKey: ["commerce", "syncDlq", channelId],
    enabled: !!channelId,
    refetchInterval,
    queryFn: async () => {
      const { items } = await capability("commerce.commerceSyncDeadLetter.list")({
        salesChannelId: channelId!,
      });
      return items as unknown as DlqItemRecord[];
    },
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      if (!channelId) throw new Error("Kein Verkaufskanal ausgewählt");
      return capability("commerce.commerceSyncRun.start")({
        salesChannelId: channelId,
        direction: "push",
        mode: triggerMode,
        entities: triggerEntities as ("category" | "address" | "media_asset" | "article")[],
        dryRun: triggerDryRun,
        forceFullSync: triggerForceFull,
      });
    },
    onSuccess: (result) => {
      const run = (result as { run: SyncRunRecord }).run;
      queryClient.invalidateQueries({ queryKey: ["commerce", "syncRuns", channelId] });
      queryClient.invalidateQueries({ queryKey: ["commerce", "syncDlq", channelId] });
      toast.success(
        triggerDryRun
          ? `Probelauf abgeschlossen: ${run.succeededItems}/${run.totalItems} ok`
          : `Sync abgeschlossen: ${run.succeededItems}/${run.totalItems} ok`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!channelId) throw new Error("Kein Verkaufskanal ausgewählt");
      return capability("commerce.commerceSyncRun.start")({
        salesChannelId: channelId,
        direction: "pull",
        mode: "full",
        entities: ["document"],
        dryRun: importDryRun,
        forceFullSync: importForceFull,
      });
    },
    onSuccess: (result) => {
      const run = (result as { run: SyncRunRecord }).run;
      queryClient.invalidateQueries({ queryKey: ["commerce", "syncRuns", channelId] });
      toast.success(
        importDryRun
          ? `Import-Probelauf: ${run.totalItems} Bestellung(en) gefunden`
          : `Import abgeschlossen: ${run.succeededItems}/${run.totalItems} importiert`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const retryMutation = useMutation({
    mutationFn: async () => {
      if (!channelId) throw new Error("Kein Verkaufskanal ausgewählt");
      return capability("commerce.commerceSyncDeadLetter.retry")({ salesChannelId: channelId });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["commerce", "syncDlq", channelId] });
      queryClient.invalidateQueries({ queryKey: ["commerce", "syncRuns", channelId] });
      toast.success(
        `${result.attempted} versucht · ${result.resolved} gelöst · ${result.stillFailed} offen · ${result.abandoned} aufgegeben`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filteredRuns = useMemo(
    () =>
      runs.filter((r) => {
        if (runStatusFilter !== "all" && r.status !== runStatusFilter) return false;
        if (entityFilter !== "all" && !r.requestedEntities.includes(entityFilter)) return false;
        return true;
      }),
    [runs, runStatusFilter, entityFilter],
  );

  const filteredDlq = useMemo(
    () =>
      dlqItems.filter((i) => {
        if (dlqStatusFilter !== "all" && i.status !== dlqStatusFilter) return false;
        if (entityFilter !== "all" && i.entityType !== entityFilter) return false;
        return true;
      }),
    [dlqItems, dlqStatusFilter, entityFilter],
  );

  const kpis = useMemo(() => {
    const completed = runs.filter((r) => r.status !== "queued" && r.status !== "running");
    const succeededRuns = completed.filter((r) => r.status === "success").length;
    const successRate =
      completed.length > 0 ? Math.round((succeededRuns / completed.length) * 100) : null;
    const lastRun = runs[0];
    const pendingDlq = dlqItems.filter((i) => i.status === "pending").length;

    let overall: { label: string; tone: string };
    if (runs.some((r) => r.status === "error") || pendingDlq > 0) {
      overall = { label: "🔴 Fehler", tone: "text-red-600" };
    } else if (runs.some((r) => r.status === "partial_error")) {
      overall = { label: "🟡 Warnung", tone: "text-amber-600" };
    } else if (completed.length > 0) {
      overall = { label: "🟢 OK", tone: "text-green-600" };
    } else {
      overall = { label: "— Kein Lauf", tone: "text-ink-mute" };
    }

    return { successRate, lastRun, pendingDlq, overall, totalRuns: completed.length };
  }, [runs, dlqItems]);

  const toggleTriggerEntity = (value: string) => {
    setTriggerEntities((prev) =>
      prev.includes(value) ? prev.filter((e) => e !== value) : [...prev, value],
    );
  };

  const pendingDlqCount = dlqItems.filter((i) => i.status === "pending").length;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-canvas">
      {/* Toolbar */}
      <div className="flex h-11 shrink-0 items-center gap-3 border-b border-hairline px-6">
        <span className="text-[13px] font-semibold text-ink">Sync-Monitoring</span>
        <div className="ml-2 w-56">
          <Select value={channelId ?? ""} onValueChange={(v) => v && setSelectedChannelId(v)}>
            <SelectTrigger className="h-7 text-[12px]">
              <SelectValue placeholder="Verkaufskanal wählen" />
            </SelectTrigger>
            <SelectContent>
              {channels.map((c) => (
                <SelectItem key={c.salesChannelId} value={c.salesChannelId}>
                  {c.name}
                  {!c.isActive && " (inaktiv)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-ink-secondary">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="size-3.5 accent-primary"
            />
            Auto-Refresh (5s)
          </label>
          <Button variant="outline" size="sm" onClick={() => refetchRuns()} disabled={!channelId}>
            <RefreshCwIcon className={cn("mr-1.5 size-3.5", runsFetching && "animate-spin")} />
            Aktualisieren
          </Button>
        </div>
      </div>

      {!channelId ? (
        <div className="flex flex-1 items-center justify-center text-[13px] text-ink-mute">
          {channels.length === 0
            ? "Kein Verkaufskanal vorhanden. Legen Sie zuerst einen Verkaufskanal an."
            : "Wählen Sie einen Verkaufskanal"}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-6">
            {/* KPI Overview */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiCard label="Status" value={kpis.overall.label} tone={kpis.overall.tone} />
              <KpiCard
                label="Erfolgsrate"
                value={kpis.successRate === null ? "—" : `${kpis.successRate}%`}
                hint={`${kpis.totalRuns} abgeschlossene Läufe`}
              />
              <KpiCard
                label="Letzte Dauer"
                value={
                  kpis.lastRun
                    ? formatDuration(kpis.lastRun.startedAt, kpis.lastRun.completedAt)
                    : "—"
                }
                hint={kpis.lastRun ? formatDateTime(kpis.lastRun.createdAt) : undefined}
              />
              <KpiCard
                label="DLQ ausstehend"
                value={String(kpis.pendingDlq)}
                tone={kpis.pendingDlq > 0 ? "text-red-600" : undefined}
                hint={`${dlqItems.length} gesamt`}
              />
            </div>

            {/* Live trigger */}
            <section className="flex flex-col gap-3 rounded-lg border border-hairline bg-canvas-soft px-4 py-4">
              <h2 className="text-[14px] font-semibold text-ink">Manueller Push-Sync</h2>
              <div className="flex flex-wrap items-end gap-5">
                <div className="flex flex-col gap-1.5">
                  <Label>Entitäten</Label>
                  <div className="flex gap-3">
                    {PUSH_ENTITIES.map((e) => (
                      <label
                        key={e.value}
                        className="flex cursor-pointer items-center gap-1.5 text-[13px] text-ink"
                      >
                        <input
                          type="checkbox"
                          checked={triggerEntities.includes(e.value)}
                          onChange={() => toggleTriggerEntity(e.value)}
                          className="size-4 accent-primary"
                        />
                        {e.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Modus</Label>
                  <Select
                    value={triggerMode}
                    onValueChange={(v) => v && setTriggerMode(v as "single" | "full")}
                  >
                    <SelectTrigger className="h-8 w-32 text-[13px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">Voll</SelectItem>
                      <SelectItem value="single">Einzeln</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <label className="flex h-8 cursor-pointer items-center gap-2 text-[13px] text-ink">
                  <input
                    type="checkbox"
                    checked={triggerDryRun}
                    onChange={(e) => setTriggerDryRun(e.target.checked)}
                    className="size-4 accent-primary"
                  />
                  Probelauf (Dry-Run)
                </label>

                <label
                  className="flex h-8 cursor-pointer items-center gap-2 text-[13px] text-ink"
                  title="Standard ist Delta-Sync: nur seit dem letzten Push geänderte Datensätze werden übertragen. Erzwingt einen vollständigen Push aller Datensätze."
                >
                  <input
                    type="checkbox"
                    checked={triggerForceFull}
                    onChange={(e) => setTriggerForceFull(e.target.checked)}
                    className="size-4 accent-primary"
                  />
                  Vollständig (kein Delta)
                </label>

                <Button
                  size="sm"
                  className="ml-auto"
                  onClick={() => startMutation.mutate()}
                  disabled={triggerEntities.length === 0 || startMutation.isPending}
                >
                  {startMutation.isPending ? (
                    <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
                  ) : (
                    <PlayIcon className="mr-1.5 size-3.5" />
                  )}
                  {triggerDryRun ? "Probelauf starten" : "Sync starten"}
                </Button>
              </div>
            </section>

            {/* Order import (pull) */}
            <section className="flex flex-col gap-3 rounded-lg border border-hairline bg-canvas-soft px-4 py-4">
              <h2 className="text-[14px] font-semibold text-ink">Bestell-Import (Pull)</h2>
              <p className="text-[12px] text-ink-mute">
                Holt Shop-Bestellungen als Auftrags-Entwürfe (Belegtyp „Auftrag"). Standardmäßig
                inkrementell nach Bestelldatum; bereits importierte Bestellungen werden
                übersprungen.
              </p>
              <div className="flex flex-wrap items-end gap-5">
                <label className="flex h-8 cursor-pointer items-center gap-2 text-[13px] text-ink">
                  <input
                    type="checkbox"
                    checked={importDryRun}
                    onChange={(e) => setImportDryRun(e.target.checked)}
                    className="size-4 accent-primary"
                  />
                  Probelauf (Dry-Run)
                </label>

                <label
                  className="flex h-8 cursor-pointer items-center gap-2 text-[13px] text-ink"
                  title="Standard ist inkrementell ab dem letzten erfolgreichen Import. Holt alle Bestellungen erneut (bereits importierte bleiben übersprungen)."
                >
                  <input
                    type="checkbox"
                    checked={importForceFull}
                    onChange={(e) => setImportForceFull(e.target.checked)}
                    className="size-4 accent-primary"
                  />
                  Alle Bestellungen (kein Delta)
                </label>

                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto"
                  onClick={() => importMutation.mutate()}
                  disabled={importMutation.isPending}
                >
                  {importMutation.isPending ? (
                    <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
                  ) : (
                    <PlayIcon className="mr-1.5 size-3.5" />
                  )}
                  {importDryRun ? "Import-Probelauf" : "Bestellungen importieren"}
                </Button>
              </div>
            </section>

            {/* Shared filters */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[11px] font-medium tracking-wider text-ink-mute uppercase">
                Filter
              </span>
              <Select value={entityFilter} onValueChange={(v) => v && setEntityFilter(v)}>
                <SelectTrigger className="h-7 w-40 text-[12px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Entitäten</SelectItem>
                  {SYNC_ENTITIES.map((e) => (
                    <SelectItem key={e.value} value={e.value}>
                      {e.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Run history */}
            <section className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <h2 className="text-[14px] font-semibold text-ink">Sync-Verlauf</h2>
                <Select value={runStatusFilter} onValueChange={(v) => v && setRunStatusFilter(v)}>
                  <SelectTrigger className="h-7 w-40 text-[12px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Status</SelectItem>
                    {Object.entries(RUN_STATUS_META).map(([k, m]) => (
                      <SelectItem key={k} value={k}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto"
                  disabled={filteredRuns.length === 0}
                  onClick={() =>
                    downloadCsv(
                      `sync-verlauf-${new Date().toISOString().slice(0, 10)}.csv`,
                      filteredRuns.map((r) => ({
                        runId: r.runId,
                        status: r.status,
                        mode: r.mode,
                        dryRun: r.dryRun,
                        entities: r.requestedEntities.join("|"),
                        total: r.totalItems,
                        succeeded: r.succeededItems,
                        failed: r.failedItems,
                        createdAt: r.createdAt,
                        completedAt: r.completedAt ?? "",
                      })),
                    )
                  }
                >
                  <DownloadIcon className="mr-1.5 size-3.5" />
                  CSV
                </Button>
              </div>

              <div className="overflow-hidden rounded-lg border border-hairline">
                <table className="w-full text-[12px]">
                  <thead className="bg-canvas-soft text-ink-mute">
                    <tr className="border-b border-hairline">
                      <th className="px-3 py-2 text-left font-medium">Status</th>
                      <th className="px-3 py-2 text-left font-medium">Zeitpunkt</th>
                      <th className="px-3 py-2 text-left font-medium">Entitäten</th>
                      <th className="px-3 py-2 text-left font-medium">Modus</th>
                      <th className="px-3 py-2 text-right font-medium">Gesamt</th>
                      <th className="px-3 py-2 text-right font-medium">OK</th>
                      <th className="px-3 py-2 text-right font-medium">Fehler</th>
                      <th className="px-3 py-2 text-right font-medium">Dauer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runsLoading ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-6 text-center text-ink-mute">
                          Laden…
                        </td>
                      </tr>
                    ) : filteredRuns.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-6 text-center text-ink-mute">
                          Keine Sync-Läufe.
                        </td>
                      </tr>
                    ) : (
                      filteredRuns.map((r) => (
                        <tr
                          key={r.runId}
                          className="border-b border-hairline/60 last:border-0 hover:bg-canvas-soft/50"
                          title={r.errorSummary ?? undefined}
                        >
                          <td className="px-3 py-2">
                            <StatusBadge meta={RUN_STATUS_META[r.status]} />
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-ink-secondary">
                            {formatDateTime(r.createdAt)}
                          </td>
                          <td className="px-3 py-2 text-ink-secondary">
                            {r.requestedEntities
                              .map((e) => SYNC_ENTITIES.find((s) => s.value === e)?.label ?? e)
                              .join(", ")}
                          </td>
                          <td className="px-3 py-2 text-ink-secondary">
                            {r.mode === "full" ? "Voll" : "Einzeln"}
                            {r.dryRun && " · Probe"}
                          </td>
                          <td className="px-3 py-2 text-right text-ink-secondary tabular-nums">
                            {r.totalItems}
                          </td>
                          <td className="px-3 py-2 text-right text-green-600 tabular-nums">
                            {r.succeededItems}
                          </td>
                          <td
                            className={cn(
                              "px-3 py-2 text-right tabular-nums",
                              r.failedItems > 0 ? "text-red-600" : "text-ink-mute",
                            )}
                          >
                            {r.failedItems}
                          </td>
                          <td className="px-3 py-2 text-right text-ink-secondary tabular-nums">
                            {formatDuration(r.startedAt, r.completedAt)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Dead-letter queue */}
            <section className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <h2 className="text-[14px] font-semibold text-ink">
                  Fehlerwarteschlange (DLQ)
                  {pendingDlqCount > 0 && (
                    <span className="ml-2 rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-medium text-red-600">
                      {pendingDlqCount} ausstehend
                    </span>
                  )}
                </h2>
                <Select value={dlqStatusFilter} onValueChange={(v) => v && setDlqStatusFilter(v)}>
                  <SelectTrigger className="h-7 w-36 text-[12px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Status</SelectItem>
                    {Object.entries(DLQ_STATUS_META).map(([k, m]) => (
                      <SelectItem key={k} value={k}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  className="ml-auto"
                  disabled={pendingDlqCount === 0 || retryMutation.isPending}
                  onClick={() => retryMutation.mutate()}
                >
                  {retryMutation.isPending ? (
                    <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
                  ) : (
                    <RotateCwIcon className="mr-1.5 size-3.5" />
                  )}
                  Fällige erneut versuchen
                </Button>
              </div>

              <div className="overflow-hidden rounded-lg border border-hairline">
                <table className="w-full text-[12px]">
                  <thead className="bg-canvas-soft text-ink-mute">
                    <tr className="border-b border-hairline">
                      <th className="px-3 py-2 text-left font-medium">Status</th>
                      <th className="px-3 py-2 text-left font-medium">Entität</th>
                      <th className="px-3 py-2 text-left font-medium">Interne ID</th>
                      <th className="px-3 py-2 text-left font-medium">Fehler</th>
                      <th className="px-3 py-2 text-right font-medium">Versuche</th>
                      <th className="px-3 py-2 text-left font-medium">Zuletzt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dlqLoading ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-ink-mute">
                          Laden…
                        </td>
                      </tr>
                    ) : filteredDlq.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-ink-mute">
                          Keine Einträge in der Fehlerwarteschlange.
                        </td>
                      </tr>
                    ) : (
                      filteredDlq.map((i) => (
                        <tr
                          key={i.itemId}
                          className="border-b border-hairline/60 align-top last:border-0 hover:bg-canvas-soft/50"
                        >
                          <td className="px-3 py-2">
                            <StatusBadge meta={DLQ_STATUS_META[i.status]} />
                          </td>
                          <td className="px-3 py-2 text-ink-secondary">
                            {SYNC_ENTITIES.find((s) => s.value === i.entityType)?.label ??
                              i.entityType}
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px] text-ink-mute">
                            {i.internalId.slice(0, 8)}…
                          </td>
                          <td className="max-w-md px-3 py-2 text-red-600/90">{i.errorMessage}</td>
                          <td className="px-3 py-2 text-right text-ink-secondary tabular-nums">
                            {i.attemptCount}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-ink-secondary">
                            {formatDateTime(i.lastAttemptedAt)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

function CommerceSyncPage() {
  return <CommerceSyncView />;
}
