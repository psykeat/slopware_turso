import { DataGrid, type DataGridHandle } from "@repo/ui/components/data-grid";
import { Dialog, DialogContent } from "@repo/ui/components/dialog";
import { EntityMask, type FieldDef } from "@repo/ui/components/entity-mask";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { useActionBar } from "@repo/ui/platform/action-bar-context";
import { useCommands } from "@repo/ui/platform/command-registry";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles as SparklesIcon, CalendarRange as CalendarRangeIcon } from "lucide-react";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { TenantEmailSettingsPanel } from "#/components/email/TenantEmailSettingsPanel";
import { LlmConfigForm } from "#/components/llm/LlmConfigForm";
import { SetupGuide } from "#/components/setup/SetupGuide";
import { YearEndAssistant } from "#/components/setup/YearEndAssistant";
import { useGridUrlState } from "#/hooks/use-grid-url-state";
import { entityDelete, entityList, entityListPage } from "#/lib/entity-capabilities";

export const Route = createFileRoute("/_auth/app/settings/")({
  component: SettingsPage,
});

interface SettingsRegistryEntry {
  tableName: string;
  label: Record<string, string> | string;
  group: string | null;
}

const GROUP_ORDER = [
  "master",
  "organisation",
  "vertrieb",
  "email",
  "lager_artikel",
  "finanzen",
  "geodaten",
];
const SETTINGS_GRID_PANEL_ID = "settings-grid";
const COMPANY_SCOPED_SETTINGS = new Set([
  "bankAccount",
  "numberSequence",
  "documentGroup",
  "warehouse",
  "accountDeterminationRule",
  "costCenter",
  "glAccount",
  "tenantLlmConfig",
]);

const COMPANY_FIELD_OVERRIDES: Partial<FieldDef>[] = [];

function resolveSettingsLabel(label: SettingsRegistryEntry["label"], language: string) {
  if (typeof label === "string") return label;
  return label[language] || label.en || label.de || "";
}

function resolveLocalizedLabel(value: unknown, language: string) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  return ((language === "de" ? record.de : record.en) ?? record.en ?? record.de ?? "") as string;
}

function resolveGroupLabel(
  groupId: string,
  t: (key: string, options?: { defaultValue?: string }) => string,
) {
  if (groupId === "master") {
    return t("settings.groups.master", { defaultValue: "Master" });
  }
  if (groupId === "other") {
    return t("settings.groups.other", { defaultValue: "Other" });
  }
  return t(`settings.groups.${groupId}`, { defaultValue: groupId });
}

function getSettingsRowId(selectedKey: string, row: Record<string, any>) {
  if (selectedKey === "addressCategory") {
    return row.categoryId ?? row.addressCategoryId ?? row.id ?? row.code ?? row.rowId;
  }

  return (
    row[`${selectedKey}Id`] ??
    row.id ??
    row.code ??
    row.iso2Code ??
    row.accountNo ??
    row.batchId ??
    row.rowId
  );
}

function SettingsView() {
  const [selectedKey, setSelectedKey] = useState<string>("company");
  const { t, i18n } = useTranslation("ui");
  const { registerCommand } = useCommands();
  const { setSubCrumb } = useActionBar();
  const queryClient = useQueryClient();
  const sidebarItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const settingsGridRef = useRef<DataGridHandle>(null);

  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [showYearEndWizard, setShowYearEndWizard] = useState(false);
  const [wizardCompany, setWizardCompany] = useState<{ id: string; name: string } | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const gridState = useGridUrlState({ defaultPageSize: 50 });
  const {
    page,
    pageSize,
    sort,
    search,
    filters,
    setPageSize,
    setSort,
    setSearch,
    setFilters,
    queryParams,
  } = gridState;
  const setPageRef = useRef(gridState.setPage);

  useEffect(() => {
    setPageRef.current = gridState.setPage;
  }, [gridState.setPage]);

  // Fetch the dynamic settings registry
  const { data: registry = [], isLoading: isRegistryLoading } = useQuery<SettingsRegistryEntry[]>({
    queryKey: ["metadata", "settings-registry"],
    queryFn: async () => {
      const res = await fetch("/api/metadata/settings-registry");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: units = [] } = useQuery({
    queryKey: ["data", "unit"],
    queryFn: () => entityList("unit").catch(() => []),
  });

  const { data: taxClasses = [] } = useQuery({
    queryKey: ["data", "taxClass"],
    queryFn: () => entityList("taxClass").catch(() => []),
  });

  const { data: paymentTerms = [] } = useQuery({
    queryKey: ["data", "paymentTerm"],
    queryFn: () => entityList("paymentTerm").catch(() => []),
  });

  const { data: currencies = [] } = useQuery({
    queryKey: ["data", "currency"],
    queryFn: () => entityList("currency").catch(() => []),
  });

  const unitLabelMap = useMemo(
    () => new Map<string, string>(units.map((row: any) => [row.unitId, row.code ?? row.unitId])),
    [units],
  );
  const taxClassLabelMap = useMemo(
    () =>
      new Map<string, string>(
        taxClasses.map((row: any) => [
          row.taxClassId,
          row.code ?? resolveLocalizedLabel(row.name, i18n.language),
        ]),
      ),
    [taxClasses, i18n.language],
  );
  const paymentTermLabelMap = useMemo(
    () =>
      new Map<string, string>(
        paymentTerms.map((row: any) => [
          row.paymentTermId,
          resolveLocalizedLabel(row.name, i18n.language) || row.paymentTermId,
        ]),
      ),
    [paymentTerms, i18n.language],
  );
  const currencyLabelMap = useMemo(
    () =>
      new Map<string, string>(
        currencies.map((row: any) => [row.currencyId, row.code ?? row.currencyId]),
      ),
    [currencies],
  );

  const orderedEntries = useMemo(() => {
    const localized = registry.map((entry) => ({
      tableName: entry.tableName,
      label: resolveSettingsLabel(entry.label, i18n.language),
      group: entry.group || "other",
    }));

    if (!localized.some((entry) => entry.tableName === "emailTemplate")) {
      localized.push({
        tableName: "emailTemplate",
        label: t("settings.entities.emailTemplate", { defaultValue: "E-Mail-Vorlagen" }),
        group: "email",
      });
    }

    return localized.sort((a, b) => {
      const aGroup = GROUP_ORDER.indexOf(a.group);
      const bGroup = GROUP_ORDER.indexOf(b.group);
      const groupDelta =
        (aGroup === -1 ? GROUP_ORDER.length : aGroup) -
        (bGroup === -1 ? GROUP_ORDER.length : bGroup);
      if (groupDelta !== 0) return groupDelta;
      const labelDelta = a.label.localeCompare(b.label, i18n.language);
      if (labelDelta !== 0) return labelDelta;
      return a.tableName.localeCompare(b.tableName);
    });
  }, [registry, i18n.language, t]);

  const groupedEntries = useMemo(() => {
    const grouped = new Map<string, typeof orderedEntries>();
    for (const entry of orderedEntries) {
      if (!grouped.has(entry.group)) grouped.set(entry.group, []);
      grouped.get(entry.group)!.push(entry);
    }
    return GROUP_ORDER.filter((id) => grouped.has(id))
      .map((id) => ({ id, entities: grouped.get(id)! }))
      .concat(grouped.has("other") ? [{ id: "other", entities: grouped.get("other")! }] : []);
  }, [orderedEntries]);

  const selectedEntry = orderedEntries.find((e) => e.tableName === selectedKey);
  const tableLabel = selectedEntry?.label || t(`settings.entities.${selectedKey}`);
  const isCompanyMaster = selectedKey === "company";
  const isCompanyScopedSetting = COMPANY_SCOPED_SETTINGS.has(selectedKey);
  const selectedIndex = useMemo(() => {
    const idx = orderedEntries.findIndex((entry) => entry.tableName === selectedKey);
    return idx >= 0 ? idx : 0;
  }, [orderedEntries, selectedKey]);

  const selectedColumns = useMemo(() => {
    if (selectedKey === "articleGroup") {
      return [
        { key: "code", header: "Code", sortable: true },
        {
          key: "name",
          header: "Name",
          sortable: true,
          render: (row: any) => resolveLocalizedLabel(row.name, i18n.language) || "—",
        },
        {
          key: "taxClassId",
          header: "Tax Class",
          render: (row: any) =>
            row.taxClassId ? (taxClassLabelMap.get(row.taxClassId) ?? row.taxClassId) : "—",
        },
        {
          key: "baseUnitId",
          header: "Base Unit",
          render: (row: any) =>
            row.baseUnitId ? (unitLabelMap.get(row.baseUnitId) ?? row.baseUnitId) : "—",
        },
        {
          key: "salesUnitId",
          header: "Sales Unit",
          render: (row: any) =>
            row.salesUnitId ? (unitLabelMap.get(row.salesUnitId) ?? row.salesUnitId) : "—",
        },
        {
          key: "purchaseUnitId",
          header: "Purchase Unit",
          render: (row: any) =>
            row.purchaseUnitId ? (unitLabelMap.get(row.purchaseUnitId) ?? row.purchaseUnitId) : "—",
        },
        { key: "trackingMode", header: "Tracking" },
        { key: "bomType", header: "BOM" },
        {
          key: "printPositionTexts",
          header: "Print Texts",
          render: (row: any) => (
            <span className="font-mono text-[11px] text-ink-mute">
              {row.printPositionTexts ? "On" : "—"}
            </span>
          ),
        },
      ];
    }

    if (selectedKey === "addressCategory") {
      return [
        {
          key: "name",
          header: "Name",
          sortable: true,
          render: (row: any) => resolveLocalizedLabel(row.name, i18n.language) || "—",
        },
        {
          key: "taxClassId",
          header: "Tax Class",
          render: (row: any) =>
            row.taxClassId ? (taxClassLabelMap.get(row.taxClassId) ?? row.taxClassId) : "—",
        },
        {
          key: "paymentTermId",
          header: "Payment Terms",
          render: (row: any) =>
            row.paymentTermId
              ? (paymentTermLabelMap.get(row.paymentTermId) ?? row.paymentTermId)
              : "—",
        },
        {
          key: "currencyId",
          header: "Currency",
          render: (row: any) =>
            row.currencyId ? (currencyLabelMap.get(row.currencyId) ?? row.currencyId) : "—",
        },
      ];
    }

    if (selectedKey === "tenantLlmConfig") {
      return [
        { key: "endpointUrl", header: "Endpoint URL", sortable: true },
        { key: "model", header: "Model", sortable: true },
        {
          key: "apiKey",
          header: "API Key",
          render: (row: any) => (
            <span className="font-mono text-[11px] text-ink-mute">
              {row.apiKey ? "••••••••" : "—"}
            </span>
          ),
        },
        {
          key: "isActive",
          header: "Active",
          render: (row: any) => (
            <span className="font-mono text-[11px] text-ink-mute">
              {row.isActive ? "Yes" : "—"}
            </span>
          ),
        },
      ];
    }

    if (selectedKey === "emailTemplate") {
      return [
        {
          key: "category",
          header: t("emailTemplate.columns.category"),
          sortable: true,
          width: "110px",
        },
        { key: "code", header: t("emailTemplate.columns.code"), sortable: true, width: "140px" },
        { key: "name", header: t("emailTemplate.columns.name"), sortable: true },
        {
          key: "language",
          header: t("emailTemplate.columns.language"),
          sortable: true,
          width: "70px",
        },
        {
          key: "archived",
          header: t("emailTemplate.columns.archived"),
          sortable: true,
          width: "80px",
        },
      ];
    }

    return undefined;
  }, [
    currencyLabelMap,
    i18n.language,
    paymentTermLabelMap,
    selectedKey,
    taxClassLabelMap,
    t,
    unitLabelMap,
  ]);

  const selectedFieldOverrides = useMemo<Partial<FieldDef>[] | undefined>(() => {
    if (selectedKey === "tenantLlmConfig") {
      return [
        {
          key: "apiKey",
          type: "password" as const,
        },
      ];
    }

    if (selectedKey === "emailTemplate") {
      return [
        { key: "category", label: "Category", labelDe: "Kategorie" },
        { key: "code", label: "Code", labelDe: "Code" },
        { key: "name", label: "Name", labelDe: "Name" },
        {
          key: "subjectTemplate",
          label: "Subject Template",
          labelDe: "Betreffvorlage",
          helpText: "Supports {{path}} placeholders.",
          helpTextDe: "Unterstützt {{path}}-Platzhalter.",
        },
        {
          key: "bodyHtmlTemplate",
          label: "Body HTML Template",
          labelDe: "HTML-Textvorlage",
          helpText: "Rendered HTML body.",
          helpTextDe: "Gerenderter HTML-Inhalt.",
        },
        {
          key: "bodyTextTemplate",
          label: "Body Text Template",
          labelDe: "Textvorlage",
          helpText: "Optional plain-text fallback.",
          helpTextDe: "Optionale Klartext-Alternative.",
        },
        { key: "language", label: "Language", labelDe: "Sprache" },
      ];
    }

    if (selectedKey !== "articleGroup") return undefined;
    return [
      {
        key: "trackingMode",
        type: "select" as const,
        options: [
          { value: "serial", label: "Serial" },
          { value: "batch", label: "Batch" },
        ],
      },
      {
        key: "bomType",
        type: "select" as const,
        options: [
          { value: "none", label: "None" },
          { value: "sales", label: "Sales (H)" },
          { value: "production", label: "Production (P)" },
        ],
      },
      { key: "printPositionTexts" },
    ];
  }, [selectedKey]);

  useEffect(() => {
    setSubCrumb(tableLabel);
  }, [tableLabel, setSubCrumb]);

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await fetch("/api/me");
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: companyOptions = [], isLoading: areCompaniesLoading } = useQuery({
    queryKey: ["data", "company", "tenant-options"],
    queryFn: () =>
      entityList("company", {}, { orderBy: "companyNo:asc", limit: 200 }).catch(() => []),
  });

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (companyOptions.length === 0) {
        setSelectedCompanyId(null);
        return;
      }
      setSelectedCompanyId((current) => {
        if (current && companyOptions.some((row: any) => row.companyId === current)) return current;
        const preferred = me?.lastCompanyId;
        if (preferred && companyOptions.some((row: any) => row.companyId === preferred)) {
          return preferred;
        }
        return companyOptions[0]?.companyId ?? null;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [companyOptions, me?.lastCompanyId]);

  const selectedCompany = useMemo(
    () => companyOptions.find((row: any) => row.companyId === selectedCompanyId) ?? null,
    [companyOptions, selectedCompanyId],
  );

  const persistSelectedCompany = useCallback(
    async (companyId: string) => {
      setSelectedCompanyId(companyId);
      await fetch("/api/me/company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    [queryClient],
  );

  const createInitialValues = useMemo(() => {
    if (selectedKey === "emailTemplate") {
      return {
        category: "document",
        code: "",
        name: "",
        subjectTemplate: "",
        bodyHtmlTemplate: "<p></p>",
        bodyTextTemplate: "",
        language: null,
      };
    }
    return isCompanyScopedSetting && selectedCompanyId
      ? { companyId: selectedCompanyId }
      : undefined;
  }, [isCompanyScopedSetting, selectedCompanyId, selectedKey]);

  useEffect(() => () => setSubCrumb(undefined), [setSubCrumb]);

  useEffect(() => {
    sidebarItemRefs.current[selectedKey]?.scrollIntoView({ block: "nearest" });
  }, [selectedKey]);

  const resetEntityDialogs = useCallback(() => {
    setShowCreate(false);
    setShowEdit(false);
    setDeleteConfirm(false);
    setEditId(null);
    setDeleteId(null);
  }, []);

  const selectEntityByIndex = useCallback(
    (index: number) => {
      const entry = orderedEntries[index];
      if (!entry) return;
      resetEntityDialogs();
      setSelectedKey(entry.tableName);
      setPageRef.current(1);
      requestAnimationFrame(() => settingsGridRef.current?.restoreFocus(null));
    },
    [orderedEntries, resetEntityDialogs],
  );

  const selectEntity = useCallback(
    (entityName: string) => {
      resetEntityDialogs();
      setSelectedKey(entityName);
      setPageRef.current(1);
      requestAnimationFrame(() => settingsGridRef.current?.restoreFocus(null));
    },
    [resetEntityDialogs],
  );

  // Fetch data for the selected entity — paginated
  const { data: entityData, isLoading: isDataLoading } = useQuery({
    queryKey: [
      "data",
      selectedKey,
      queryParams.page,
      queryParams.limit,
      queryParams.orderBy,
      queryParams.search,
      queryParams.filters,
      isCompanyScopedSetting ? selectedCompanyId : null,
    ],
    queryFn: async () => {
      const filters: Record<string, string> = {};
      if (isCompanyScopedSetting && selectedCompanyId) filters.companyId = selectedCompanyId;
      try {
        const { items, total } = await entityListPage<any>(selectedKey, filters, {
          limit: queryParams.limit,
          offset: (queryParams.page - 1) * queryParams.limit,
          orderBy: queryParams.orderBy || undefined,
          search: queryParams.search || undefined,
          filterRules: queryParams.filters || undefined,
        });
        return { data: items, total };
      } catch {
        return { data: [], total: 0 };
      }
    },
    enabled:
      !!selectedKey &&
      !isCompanyMaster &&
      selectedKey !== "tenantLlmConfig" &&
      (!isCompanyScopedSetting || !!selectedCompanyId),
  });

  const companyRecord = selectedCompany;
  const data = useMemo(
    () => (isCompanyMaster ? (companyRecord ? [companyRecord] : []) : (entityData?.data ?? [])),
    [companyRecord, entityData, isCompanyMaster],
  );
  const isLoading = isCompanyMaster ? areCompaniesLoading : isDataLoading;

  useEffect(() => {
    const modalOpen = showCreate || showEdit || deleteConfirm;
    const isFocusedRow = (state: {
      panel: string | null;
      entity: string | null;
      recordId: string | null;
    }) =>
      state.panel === SETTINGS_GRID_PANEL_ID && state.entity === selectedKey && !!state.recordId;

    const unregDown = registerCommand({
      id: "settings-nav-down",
      scope: "context",
      group: "navigation",
      label: { en: "Next Settings Item", de: "Nächster Einstellungs-Eintrag" },
      shortcut: "Ctrl+ArrowDown",
      isEnabled: () => !modalOpen && orderedEntries.length > 0,
      handler: () => selectEntityByIndex(Math.min(selectedIndex + 1, orderedEntries.length - 1)),
    });
    const unregUp = registerCommand({
      id: "settings-nav-up",
      scope: "context",
      group: "navigation",
      label: { en: "Previous Settings Item", de: "Vorheriger Einstellungs-Eintrag" },
      shortcut: "Ctrl+ArrowUp",
      isEnabled: () => !modalOpen && orderedEntries.length > 0,
      handler: () => selectEntityByIndex(Math.max(selectedIndex - 1, 0)),
    });

    if (isCompanyMaster || selectedKey === "tenantLlmConfig") {
      return () => {
        unregDown();
        unregUp();
      };
    }

    const unregCreate = registerCommand({
      id: "create-record",
      scope: "context",
      group: "recordOps",
      label: { en: t("commands.newRecord"), de: "Neu" },
      shortcut: "F3",
      isEnabled: () => !modalOpen,
      handler: () => setShowCreate(true),
    });
    const unregEdit = registerCommand({
      id: "edit-record",
      scope: "context",
      group: "recordOps",
      label: { en: "Edit", de: "Bearbeiten" },
      shortcut: "F2",
      isEnabled: (state) => !modalOpen && isFocusedRow(state),
      handler: (state) => {
        if (!state.recordId) return;
        setEditId(state.recordId);
        setShowEdit(true);
      },
    });
    const unregDelete = registerCommand({
      id: "delete-record",
      scope: "context",
      group: "recordOps",
      label: { en: "Delete", de: "Löschen" },
      shortcut: "F4",
      isEnabled: (state) => !modalOpen && isFocusedRow(state),
      handler: (state) => {
        if (!state.recordId) return;
        setDeleteId(state.recordId);
        setDeleteConfirm(true);
      },
    });
    return () => {
      unregDown();
      unregUp();
      unregCreate();
      unregEdit();
      unregDelete();
    };
  }, [
    registerCommand,
    selectedKey,
    orderedEntries,
    selectedIndex,
    showCreate,
    showEdit,
    deleteConfirm,
    selectEntityByIndex,
    t,
    isCompanyMaster,
  ]);

  return (
    <div className="sw-root flex h-full w-full overflow-hidden">
      {/* Left sidebar */}
      <div className="flex w-60 shrink-0 flex-col overflow-hidden border-r border-hairline bg-canvas-soft">
        <div className="flex h-8 shrink-0 items-center border-b border-hairline px-3 text-[11px] font-medium tracking-wider text-ink-mute uppercase">
          {t("nav.settings")}
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {isRegistryLoading ? (
            <div className="space-y-4 px-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-2 w-16 opacity-50" />
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {groupedEntries.map((group) => (
                <div key={group.id} className="mb-4">
                  <div className="mb-1 px-3 text-[10px] font-bold tracking-widest text-ink-mute/60 uppercase">
                    {resolveGroupLabel(group.id, t)}
                  </div>
                  {group.entities.map((entity) => {
                    const isActive = selectedKey === entity.tableName;
                    return (
                      <button
                        key={entity.tableName}
                        ref={(node) => {
                          sidebarItemRefs.current[entity.tableName] = node;
                        }}
                        onClick={() => selectEntity(entity.tableName)}
                        className={cn(
                          "group flex h-7 w-full cursor-pointer items-center px-3 text-left text-[13px] transition-colors",
                          isActive
                            ? "bg-primary text-primary-fg"
                            : "text-ink-secondary hover:bg-canvas-soft hover:text-ink",
                        )}
                      >
                        <span>{entity.label}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
              <div className="mb-4">
                <div className="mb-1 px-3 text-[10px] font-bold tracking-widest text-ink-mute/60 uppercase">
                  Werkzeuge
                </div>
                <Link
                  to="/app/settings/variant-templates"
                  className="group flex h-7 w-full cursor-pointer items-center px-3 text-left text-[13px] text-ink-secondary transition-colors hover:bg-canvas-soft hover:text-ink"
                >
                  <span>Variantenvorlagen</span>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-canvas">
        {(isCompanyMaster || isCompanyScopedSetting) && (
          <div className="flex h-10 shrink-0 items-center gap-2 border-b border-hairline bg-canvas px-4">
            <span className="text-[11px] font-medium tracking-wider text-ink-mute uppercase">
              Company
            </span>
            <select
              value={selectedCompanyId ?? ""}
              disabled={areCompaniesLoading || companyOptions.length === 0}
              onChange={(event) => {
                if (event.target.value) void persistSelectedCompany(event.target.value);
              }}
              className="h-7 min-w-56 rounded border border-hairline-input bg-canvas px-2 text-[12px] text-ink outline-none focus-visible:border-primary"
            >
              {companyOptions.map((row: any) => (
                <option key={row.companyId} value={row.companyId}>
                  {[row.companyNo, row.name].filter(Boolean).join(" - ")}
                </option>
              ))}
            </select>
          </div>
        )}
        {isCompanyMaster && (
          <div className="flex items-center justify-between border-b border-hairline bg-canvas-soft/40 px-6 py-4 backdrop-blur-md transition-all duration-300">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
                <SparklesIcon className="size-5 animate-pulse" />
              </div>
              <div>
                <h2 className="text-sm leading-tight font-semibold text-ink">
                  Firmen-Assistent & Ersteinrichtung
                </h2>
                <p className="mt-0.5 text-xs text-ink-mute">
                  Richten Sie Ihr Unternehmen für Deutschland (SKR03) oder Österreich (EKR) ein oder
                  führen Sie einen Jahreswechsel durch.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (companyRecord) {
                    setWizardCompany({
                      id: getSettingsRowId("company", companyRecord),
                      name: companyRecord.name,
                    });
                    setShowSetupWizard(true);
                  } else {
                    toast.error("Bitte legen Sie zuerst eine Firma an (F3).");
                  }
                }}
                className="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-hairline bg-canvas px-4 text-xs font-semibold text-ink shadow-sm transition-all hover:bg-canvas-soft hover:shadow active:scale-98"
              >
                <SparklesIcon className="size-3.5 text-primary" />
                Ersteinrichtung starten
              </button>
              <button
                type="button"
                onClick={() => {
                  if (companyRecord) {
                    setWizardCompany({
                      id: getSettingsRowId("company", companyRecord),
                      name: companyRecord.name,
                    });
                    setShowYearEndWizard(true);
                  } else {
                    toast.error("Bitte legen Sie zuerst eine Firma an.");
                  }
                }}
                className="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-hairline bg-canvas px-4 text-xs font-semibold text-ink shadow-sm transition-all hover:bg-canvas-soft hover:shadow active:scale-98"
              >
                <CalendarRangeIcon className="size-3.5 text-secondary-foreground" />
                Jahreswechsel
              </button>
            </div>
          </div>
        )}
        {isCompanyMaster ? (
          <div className="min-h-0 flex-1 overflow-auto">
            {areCompaniesLoading ? (
              <div className="space-y-4 p-6">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-[120px] w-full" />
                <Skeleton className="h-[120px] w-full" />
                <Skeleton className="h-[120px] w-full" />
              </div>
            ) : companyRecord ? (
              <EntityMask
                entityName="company"
                recordId={companyRecord.companyId}
                mode="edit"
                inline
                title={tableLabel}
                className="h-full"
                fieldOverrides={COMPANY_FIELD_OVERRIDES}
              />
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-[13px] text-ink-mute">
                Kein Firmenstammsatz für den aktiven Mandanten gefunden.
              </div>
            )}
          </div>
        ) : selectedKey === "tenantLlmConfig" ? (
          <div className="min-h-0 flex-1 overflow-auto">
            <LlmConfigForm
              scope="tenant"
              title={tableLabel}
              description="Configure the tenant-specific LLM service, credentials and provider settings for the selected company."
              companyId={selectedCompanyId}
            />
          </div>
        ) : selectedKey === "tenantEmailSettings" ? (
          <div className="min-h-0 flex-1 overflow-auto">
            <TenantEmailSettingsPanel title={tableLabel} />
          </div>
        ) : (
          <DataGrid
            ref={settingsGridRef}
            entityName={selectedKey}
            data={data}
            columns={selectedColumns}
            keyExtractor={(row: any) => getSettingsRowId(selectedKey, row)}
            isLoading={isLoading}
            title={tableLabel}
            totalCount={entityData?.total}
            page={page}
            pageSize={pageSize}
            sort={sort}
            onPageChange={gridState.setPage}
            onPageSizeChange={setPageSize}
            onSortChange={setSort}
            search={search}
            onSearchChange={setSearch}
            filters={filters}
            onFiltersChange={setFilters}
            emptyTitle={`${t("empty.noData")} ${tableLabel}`}
            emptySubtitle={t("empty.subtitle")}
            emptyAction={{
              label: `${t("actions.new")} ${tableLabel}`,
              kbd: "F3",
              onClick: () => setShowCreate(true),
            }}
            onRowClick={(row: any) => {
              const id = getSettingsRowId(selectedKey, row);
              setEditId(id);
              setShowEdit(true);
            }}
            onRowOpen={(row: any) => {
              const id = getSettingsRowId(selectedKey, row);
              setEditId(id);
              setShowEdit(true);
            }}
            panelId={SETTINGS_GRID_PANEL_ID}
          />
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sw-root max-w-2xl overflow-hidden p-0" variant="form">
          <EntityMask
            entityName={selectedKey}
            mode="create"
            title={`${t("actions.new")} ${tableLabel}`}
            onCancel={() => setShowCreate(false)}
            fieldOverrides={selectedFieldOverrides}
            initialValues={createInitialValues}
            onSaved={(record) => {
              setShowCreate(false);
              queryClient.invalidateQueries({ queryKey: ["data", selectedKey] });
              settingsGridRef.current?.restoreFocus(
                (record as any)?.[`${selectedKey}Id`] ?? (record as any)?.id ?? null,
              );
            }}
            className="m-0 rounded-none border-none shadow-none"
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="sw-root max-w-2xl overflow-hidden p-0">
          <EntityMask
            entityName={selectedKey}
            recordId={editId}
            mode="edit"
            title={`${t("actions.edit")} ${tableLabel}`}
            onCancel={() => setShowEdit(false)}
            fieldOverrides={selectedFieldOverrides}
            onSaved={(record) => {
              setShowEdit(false);
              queryClient.invalidateQueries({ queryKey: ["data", selectedKey] });
              settingsGridRef.current?.restoreFocus(
                (record as any)?.[`${selectedKey}Id`] ?? editId ?? null,
              );
            }}
            className="m-0 rounded-none border-none shadow-none"
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <DialogContent className="sw-root max-w-sm">
          <div className="flex flex-col gap-5 p-6">
            <div>
              <h3 className="text-[15px] font-medium text-ink">{t("form.deleteConfirmTitle")}</h3>
              <p className="mt-1 text-[13px] text-ink-mute">{t("form.deleteConfirmBody")}</p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="h-8 rounded border border-hairline px-4 text-[13px] hover:bg-canvas-soft"
                onClick={() => setDeleteConfirm(false)}
              >
                {t("actions.cancel")}
              </button>
              <button
                type="button"
                className="h-8 rounded bg-destructive px-4 text-[13px] text-white hover:opacity-90"
                onClick={async () => {
                  if (!deleteId) return;
                  try {
                    await entityDelete(selectedKey, deleteId);
                  } catch (err) {
                    toast.error(
                      (err instanceof Error && err.message) || t("form.fkViolationError"),
                    );
                    return;
                  }
                  setDeleteConfirm(false);
                  setDeleteId(null);
                  setEditId(null);
                  queryClient.invalidateQueries({ queryKey: ["data", selectedKey] });
                  toast.success(t("form.deleteSuccess"));
                }}
              >
                {t("actions.delete")}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Setup Wizard */}
      {wizardCompany && (
        <SetupGuide
          open={showSetupWizard}
          onOpenChange={setShowSetupWizard}
          companyId={wizardCompany.id}
          companyName={wizardCompany.name}
          onCompleted={() => {
            queryClient.invalidateQueries({ queryKey: ["data"] });
            queryClient.invalidateQueries({ queryKey: ["metadata"] });
          }}
        />
      )}

      {/* Year End Assistant */}
      {wizardCompany && (
        <YearEndAssistant
          open={showYearEndWizard}
          onOpenChange={setShowYearEndWizard}
          companyId={wizardCompany.id}
          companyName={wizardCompany.name}
          onCompleted={() => {
            queryClient.invalidateQueries({ queryKey: ["data"] });
          }}
        />
      )}
    </div>
  );
}

function SettingsPage() {
  return <SettingsView />;
}
