import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { DataGrid } from "@repo/ui/components/data-grid";
import { useCommands } from "@repo/ui/platform/command-registry";
import { useFocus } from "@repo/ui/platform/focus-manager";

export const Route = createFileRoute("/_auth/app/settings/")({
  component: SettingsPage,
});

const HELPER_TABLES = [
  { key: "paymentTerm", labelEn: "Payment Terms", labelDe: "Zahlungsbedingungen" },
  { key: "taxCode", labelEn: "Tax Codes", labelDe: "Steuercodes" },
  { key: "shippingMethod", labelEn: "Shipping Methods", labelDe: "Versandarten" },
  { key: "warehouse", labelEn: "Warehouses", labelDe: "Lager" },
  { key: "costCenter", labelEn: "Cost Centers", labelDe: "Kostenstellen" },
] as const;

type HelperTableKey = (typeof HELPER_TABLES)[number]["key"];

function SettingsPage() {
  const [selected, setSelected] = useState<HelperTableKey>("paymentTerm");
  const { t, i18n } = useTranslation("ui");
  const lang = i18n.language === "de" ? "de" : "en";
  const { registerCommand, executeCommand } = useCommands();
  const { state: focusState } = useFocus();

  const currentTable = HELPER_TABLES.find((h) => h.key === selected)!;
  const tableLabel = lang === "de" ? currentTable.labelDe : currentTable.labelEn;

  const { data = [], isLoading } = useQuery({
    queryKey: ["data", selected],
    queryFn: async () => {
      const res = await fetch(`/api/data/${selected}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selected,
  });

  useEffect(() => {
    const unreg = registerCommand({
      id: "create-record",
      scope: "context",
      label: { en: "New Record", de: "Neu" },
      shortcut: "F3",
      handler: () => {
        // stub for settings — most helper tables are managed via inline editing
      },
    });
    return unreg;
  }, [registerCommand]);

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Left sidebar */}
      <div className="w-52 shrink-0 bg-canvas-soft border-r border-hairline flex flex-col overflow-hidden">
        <div className="h-8 flex items-center px-3 shrink-0 border-b border-hairline text-[11px] uppercase tracking-wider font-medium text-ink-mute">
          {t("nav.settings")}
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {HELPER_TABLES.map((table) => {
            const isActive = selected === table.key;
            const label = lang === "de" ? table.labelDe : table.labelEn;
            return (
              <button
                key={table.key}
                onClick={() => setSelected(table.key)}
                className="w-full flex items-center h-8 px-3 text-left text-[13px] cursor-pointer transition-colors"
                style={
                  isActive
                    ? { background: "var(--primary)", color: "var(--primary-fg)" }
                    : undefined
                }
              >
                <span className={isActive ? "" : "text-ink-secondary hover:text-ink"}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main grid area */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <DataGrid
          entityName={selected}
          data={data}
          keyExtractor={(row: any) => row[`${selected}Id`] ?? row.id ?? String(Math.random())}
          isLoading={isLoading}
          title={tableLabel}
          emptyTitle={`No ${tableLabel}`}
          emptySubtitle="Create helper table entries to use them in documents."
          emptyAction={{ label: `New ${tableLabel}`, kbd: "F3", onClick: () => executeCommand("create-record") }}
          panelId="settings-grid"
        />
      </div>
    </div>
  );
}
