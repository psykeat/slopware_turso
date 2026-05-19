import { Button } from "@repo/ui/components/button";
import { DataGrid } from "@repo/ui/components/data-grid";
import { Dialog, DialogContent } from "@repo/ui/components/dialog";
import { Label } from "@repo/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { useActionBar } from "@repo/ui/platform/action-bar-context";
import { useCommands } from "@repo/ui/platform/command-registry";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_auth/app/accounting")({
  component: AccountingModule,
});

interface ExportBatch {
  batchId: string;
  companyId: string;
  fiscalPeriodId: string;
  status: "pending" | "exported" | "failed";
  rowCount: number;
  createdAt: string;
  exportedAt: string | null;
}

interface FiscalPeriod {
  fiscalPeriodId: string;
  companyId: string;
  fiscalYear: number;
  periodNo: number;
  startDate: string;
  endDate: string;
}

interface Company {
  companyId: string;
  name: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Offen",
  exported: "Exportiert",
  failed: "Fehlgeschlagen",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "text-amber-600",
  exported: "text-emerald-600",
  failed: "text-red-600",
};

function AccountingModule() {
  const { t } = useTranslation("ui");
  const { registerCommand } = useCommands();
  const { setSubCrumb } = useActionBar();
  const queryClient = useQueryClient();

  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [createDialog, setCreateDialog] = useState(false);
  const [newCompanyId, setNewCompanyId] = useState<string>("");
  const [newPeriodId, setNewPeriodId] = useState<string>("");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => setSubCrumb(undefined), [setSubCrumb]);

  const { data: batches = [], isLoading } = useQuery<ExportBatch[]>({
    queryKey: ["accounting", "batches"],
    queryFn: async () => {
      const res = await fetch("/api/accounting/batches");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["data", "company"],
    queryFn: async () => {
      const res = await fetch("/api/data/company");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: periods = [] } = useQuery<FiscalPeriod[]>({
    queryKey: ["data", "fiscal_period", newCompanyId],
    enabled: !!newCompanyId,
    queryFn: async () => {
      const res = await fetch(`/api/data/fiscal_period?companyId=${newCompanyId}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const selectedBatch = batches.find((b) => b.batchId === selectedBatchId) ?? null;

  const handleCreate = async () => {
    if (!newCompanyId || !newPeriodId) return;
    setIsBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/accounting/batches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ companyId: newCompanyId, fiscalPeriodId: newPeriodId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fehler beim Erstellen");
      await queryClient.invalidateQueries({ queryKey: ["accounting", "batches"] });
      setSelectedBatchId(data.batchId);
      setCreateDialog(false);
      setNewCompanyId("");
      setNewPeriodId("");
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleBuild = async () => {
    if (!selectedBatchId) return;
    setIsBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounting/batches/${selectedBatchId}/build`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fehler beim Aufbauen");
      await queryClient.invalidateQueries({ queryKey: ["accounting", "batches"] });
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleExport = async () => {
    if (!selectedBatchId) return;
    setIsBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounting/batches/${selectedBatchId}/export`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fehler beim Exportieren");
      await queryClient.invalidateQueries({ queryKey: ["accounting", "batches"] });
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleRebuild = async () => {
    if (!selectedBatchId) return;
    setIsBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounting/batches/${selectedBatchId}/rebuild`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fehler beim Neuaufbauen");
      await queryClient.invalidateQueries({ queryKey: ["accounting", "batches"] });
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleDownload = () => {
    if (!selectedBatchId) return;
    window.open(`/api/accounting/batches/${selectedBatchId}/csv`, "_blank");
  };

  useEffect(() => {
    const unregNew = registerCommand({
      id: "accounting-new",
      scope: "context",
      label: { en: "New Export Batch", de: "Neuer Export-Batch" },
      shortcut: "F3",
      group: "accounting",
      handler: () => setCreateDialog(true),
    });

    const unregBuild = registerCommand({
      id: "accounting-build",
      scope: "context",
      label: { en: "Build Export", de: "Export aufbauen" },
      shortcut: "F9",
      group: "accounting",
      isEnabled: () => !!selectedBatchId && selectedBatch?.status !== "exported",
      handler: handleBuild,
    });

    const unregExport = registerCommand({
      id: "accounting-export",
      scope: "context",
      label: { en: "Mark as Exported", de: "Als exportiert markieren" },
      group: "accounting",
      isEnabled: () => !!selectedBatchId && (selectedBatch?.rowCount ?? 0) > 0,
      handler: handleExport,
    });

    const unregRebuild = registerCommand({
      id: "accounting-rebuild",
      scope: "context",
      label: { en: "Rebuild", de: "Neu aufbauen" },
      group: "accounting",
      isEnabled: () => !!selectedBatchId && selectedBatch?.status !== "exported",
      handler: handleRebuild,
    });

    const unregDownload = registerCommand({
      id: "accounting-download",
      scope: "context",
      label: { en: "Download CSV", de: "CSV herunterladen" },
      group: "accounting",
      isEnabled: () => !!selectedBatchId && (selectedBatch?.rowCount ?? 0) > 0,
      handler: handleDownload,
    });

    return () => {
      unregNew();
      unregBuild();
      unregExport();
      unregRebuild();
      unregDownload();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerCommand, selectedBatchId, selectedBatch]);

  const columns = [
    {
      key: "status",
      header: "Status",
      width: "120px",
      render: (row: ExportBatch) => (
        <span className={STATUS_COLORS[row.status] ?? ""}>
          {STATUS_LABELS[row.status] ?? row.status}
        </span>
      ),
    },
    { key: "fiscalPeriodId", header: "Fiskalperiode", width: "280px" },
    { key: "rowCount", header: "Zeilen", width: "80px", isNumeric: true },
    {
      key: "createdAt",
      header: "Erstellt",
      width: "160px",
      render: (row: ExportBatch) => new Date(row.createdAt).toLocaleDateString("de"),
    },
    {
      key: "exportedAt",
      header: "Exportiert",
      width: "160px",
      render: (row: ExportBatch) =>
        row.exportedAt ? new Date(row.exportedAt).toLocaleDateString("de") : "—",
    },
  ] satisfies import("@repo/ui/components/data-grid").ColumnDef<ExportBatch>[];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-8 shrink-0 items-center border-b border-hairline bg-canvas-soft px-4 text-[11px] font-medium tracking-wider text-ink-mute uppercase">
        {t("nav.accounting")}
      </div>

      {error && (
        <div className="mx-4 mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Batch list */}
      <div className="flex-1 overflow-hidden">
        <DataGrid
          entityName="accounting-batch"
          data={batches}
          columns={columns}
          isLoading={isLoading}
          keyExtractor={(row) => row.batchId}
          onRowClick={(row) => {
            setSelectedBatchId(row.batchId);
            setSubCrumb(`Batch ${row.batchId.slice(0, 8)}…`);
          }}
        />
      </div>

      {/* Create Batch Dialog */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col gap-4 p-1">
            <h2 className="text-base font-semibold text-ink">Neuer Buchungsexport</h2>

            <div className="flex flex-col gap-1.5">
              <Label>Gesellschaft</Label>
              <Select value={newCompanyId} onValueChange={(v) => setNewCompanyId(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Gesellschaft wählen…" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.companyId} value={c.companyId}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Fiskalperiode</Label>
              <Select
                value={newPeriodId}
                onValueChange={(v) => setNewPeriodId(v ?? "")}
                disabled={!newCompanyId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Periode wählen…" />
                </SelectTrigger>
                <SelectContent>
                  {periods.map((p) => (
                    <SelectItem key={p.fiscalPeriodId} value={p.fiscalPeriodId}>
                      {p.fiscalYear} / P{String(p.periodNo).padStart(2, "0")} ({p.startDate} –{" "}
                      {p.endDate})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setCreateDialog(false)} disabled={isBusy}>
                {t("actions.cancel")}
              </Button>
              <Button onClick={handleCreate} disabled={!newCompanyId || !newPeriodId || isBusy}>
                {isBusy ? "Erstelle…" : "Batch erstellen"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
