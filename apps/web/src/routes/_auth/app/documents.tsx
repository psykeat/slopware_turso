import { ContextTabs } from "@repo/ui/components/context-tabs";
import { DataGrid, type DataGridHandle } from "@repo/ui/components/data-grid";
import { Dialog, DialogContent } from "@repo/ui/components/dialog";
import { DocumentEditor } from "@repo/ui/components/document-editor";
import {
  DocumentTargetGroupDialog,
  type DocumentTargetGroupCandidate,
} from "@repo/ui/components/document-target-group-dialog";
import { InspectorPanel } from "@repo/ui/components/inspector-panel";
import { Skeleton } from "@repo/ui/components/skeleton";
import { TriViewWorkspace } from "@repo/ui/components/triview-workspace";
import { formatMoney, formatDate, StatusDot } from "@repo/ui/lib/formatters";
import { useActionBar } from "@repo/ui/platform/action-bar-context";
import { useCommands } from "@repo/ui/platform/command-registry";
import { useFocus } from "@repo/ui/platform/focus-manager";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  ChevronRightIcon,
  ChevronDownIcon,
  FolderIcon,
  FolderOpenIcon,
  ExternalLinkIcon,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
  EmailComposeDialog,
  type EmailComposeAction,
  type EmailComposeAttachment,
  type EmailComposeIdentity,
  type EmailComposeSubmitValue,
  type EmailComposeValue,
} from "#/components/email/EmailComposeDialog";
import { useGridUrlState } from "#/hooks/use-grid-url-state";

export const Route = createFileRoute("/_auth/app/documents")({
  component: DocumentsModule,
});

const EMPTY_ARRAY: any[] = [];

const DOC_TYPE_LABELS: Record<string, string> = {
  N: "Angebot",
  A: "Auftrag",
  L: "Lieferschein",
  R: "Rechnung",
  G: "Gutschrift",
  b: "Bestellung",
  l: "Wareneingang",
  r: "Eingangsrechnung",
  g: "Eingangsgutschrift",
  V: "Inventur",
  U: "Umbuchung",
  Z: "Zugang",
  E: "Entnahme",
  q: "Prod.-Auftrag",
  p: "Fertigmeldung",
};

function addressDisplayName(addr: any): string {
  if (!addr) return "";
  return (
    addr.companyName ||
    [addr.firstName, addr.lastName].filter(Boolean).join(" ") ||
    addr.addressNo ||
    ""
  );
}

function formatEmailAddresses(
  value: Array<{ email: string; name?: string | null }> | undefined | null,
) {
  return (value ?? [])
    .map((item) => item.email)
    .filter(Boolean)
    .join(", ");
}

function parseEmailAddresses(value: string) {
  return value
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean)
    .map((email) => ({ email }));
}

interface DocumentGroup {
  documentGroupId: string;
  name: string;
  documentType: string;
  groupNumber: number;
}

interface TypeNode {
  documentType: string;
  typeLabel: string;
  mainGroup: DocumentGroup | null;
  groups: DocumentGroup[];
}

interface TreeSection {
  direction: string;
  label: string;
  types: TypeNode[];
}

type TreeSelection =
  | { kind: "all" }
  | { kind: "type"; documentType: string; direction: string; groupId: string | null }
  | { kind: "group"; groupId: string; documentType: string; direction: string };

function DocumentNavigationTree({
  sections,
  isLoading,
  selection,
  onSelectType,
  onSelectGroup,
  expandedDirections,
  onToggleDirection,
  getTypeLabel,
  getDirectionLabel,
  onSelectCommit,
  header,
}: {
  sections: TreeSection[];
  isLoading: boolean;
  selection: TreeSelection;
  onSelectType: (
    documentType: string,
    direction: string,
    label: string,
    groupId: string | null,
  ) => void;
  onSelectGroup: (groupId: string, documentType: string, direction: string, label: string) => void;
  expandedDirections: Set<string>;
  onToggleDirection: (direction: string) => void;
  getTypeLabel: (documentType: string, fallback: string) => string;
  getDirectionLabel: (direction: string, fallback: string) => string;
  onSelectCommit?: () => void;
  header?: string;
}) {
  const isTypeSelected = (docType: string) =>
    selection.kind === "type" && selection.documentType === docType;
  const isGroupSelected = (groupId: string) =>
    selection.kind === "group" && selection.groupId === groupId;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden border-r border-hairline bg-canvas-soft">
      <div className="flex h-8 shrink-0 items-center border-b border-hairline px-3 text-[11px] font-medium tracking-wider text-ink-mute uppercase">
        {header ?? "Belegtypen"}
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div
                key={i}
                className="flex h-7 items-center gap-1.5"
                style={{ paddingLeft: i % 3 === 0 ? 8 : i % 3 === 1 ? 22 : 36 }}
              >
                <Skeleton className="size-3 shrink-0" />
                <Skeleton className="h-2.5" style={{ width: 80 + ((i * 13) % 60) }} />
              </div>
            ))}
          </>
        ) : (
          sections.map((section) => {
            const isExpanded = expandedDirections.has(section.direction);
            return (
              <React.Fragment key={section.direction}>
                {/* Layer 1: Direction header */}
                <div
                  role="treeitem"
                  aria-expanded={isExpanded}
                  tabIndex={0}
                  className="flex h-7 cursor-pointer items-center gap-1.5 text-[13px] font-medium text-ink transition-colors select-none hover:bg-canvas"
                  style={{ paddingLeft: 8 }}
                  onClick={() => onToggleDirection(section.direction)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onToggleDirection(section.direction);
                  }}
                >
                  <button
                    type="button"
                    aria-label={isExpanded ? "Collapse" : "Expand"}
                    className="flex size-3 shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleDirection(section.direction);
                    }}
                  >
                    {isExpanded ? (
                      <ChevronDownIcon size={12} strokeWidth={1.5} />
                    ) : (
                      <ChevronRightIcon size={12} strokeWidth={1.5} />
                    )}
                  </button>
                  <span className="flex size-3.5 shrink-0 items-center justify-center">
                    {isExpanded ? (
                      <FolderOpenIcon size={13} strokeWidth={1.4} />
                    ) : (
                      <FolderIcon size={13} strokeWidth={1.4} />
                    )}
                  </span>
                  <span className="flex-1 truncate">
                    {getDirectionLabel(section.direction, section.label)}
                  </span>
                </div>

                {/* Layer 2: Type nodes */}
                {isExpanded &&
                  (section.types ?? []).map((type) => {
                    const sel = isTypeSelected(type.documentType);
                    return (
                      <React.Fragment key={type.documentType}>
                        <div
                          role="treeitem"
                          aria-selected={sel}
                          tabIndex={0}
                          className={`flex h-7 cursor-pointer items-center gap-1.5 text-[13px] select-none transition-colors${!sel ? " hover:bg-canvas" : ""}`}
                          style={{
                            paddingLeft: 22,
                            ...(sel
                              ? { background: "var(--primary)", color: "var(--primary-fg)" }
                              : {}),
                          }}
                          onClick={() => {
                            onSelectType(
                              type.documentType,
                              section.direction,
                              getTypeLabel(type.documentType, type.typeLabel),
                              type.mainGroup?.documentGroupId ?? null,
                            );
                            requestAnimationFrame(() => onSelectCommit?.());
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              onSelectType(
                                type.documentType,
                                section.direction,
                                getTypeLabel(type.documentType, type.typeLabel),
                                type.mainGroup?.documentGroupId ?? null,
                              );
                              requestAnimationFrame(() => onSelectCommit?.());
                            }
                          }}
                        >
                          <span className="size-3 shrink-0" />
                          <span className="flex-1 truncate">
                            <span className="mr-1.5 font-mono text-[11px] opacity-60">
                              {type.documentType}
                            </span>
                            {type.typeLabel}
                          </span>
                        </div>

                        {/* Layer 3: Additional groups (groupNumber > 0) */}
                        {type.groups.map((group) => {
                          const groupLabel = `${group.documentType}${String(group.groupNumber).padStart(2, "0")} – ${group.name}`;
                          const gsel = isGroupSelected(group.documentGroupId);
                          return (
                            <div
                              key={group.documentGroupId}
                              role="treeitem"
                              aria-selected={gsel}
                              tabIndex={0}
                              className={`flex h-7 cursor-pointer items-center gap-1.5 text-[13px] select-none transition-colors${!gsel ? " hover:bg-canvas" : ""}`}
                              style={{
                                paddingLeft: 36,
                                ...(gsel
                                  ? { background: "var(--primary)", color: "var(--primary-fg)" }
                                  : {}),
                              }}
                              onClick={() => {
                                onSelectGroup(
                                  group.documentGroupId,
                                  group.documentType,
                                  section.direction,
                                  groupLabel,
                                );
                                requestAnimationFrame(() => onSelectCommit?.());
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  onSelectGroup(
                                    group.documentGroupId,
                                    group.documentType,
                                    section.direction,
                                    groupLabel,
                                  );
                                  requestAnimationFrame(() => onSelectCommit?.());
                                }
                              }}
                            >
                              <span className="size-3 shrink-0" />
                              <span className="flex-1 truncate">{groupLabel}</span>
                            </div>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
              </React.Fragment>
            );
          })
        )}
      </div>
    </div>
  );
}

function buildFlatNodes(
  sections: TreeSection[],
  expandedDirs: Set<string>,
  getTypeLabel: (documentType: string, fallback: string) => string,
): Array<
  | { kind: "type"; documentType: string; direction: string; label: string; groupId: string | null }
  | { kind: "group"; groupId: string; documentType: string; direction: string; label: string }
> {
  const nodes: Array<
    | {
        kind: "type";
        documentType: string;
        direction: string;
        label: string;
        groupId: string | null;
      }
    | { kind: "group"; groupId: string; documentType: string; direction: string; label: string }
  > = [];
  for (const section of sections) {
    if (!expandedDirs.has(section.direction)) continue;
    for (const type of section.types) {
      nodes.push({
        kind: "type",
        documentType: type.documentType,
        direction: section.direction,
        label: getTypeLabel(type.documentType, type.typeLabel),
        groupId: type.mainGroup?.documentGroupId ?? null,
      });
      for (const group of type.groups) {
        const label = `${group.documentType}${String(group.groupNumber).padStart(2, "0")} – ${group.name}`;
        nodes.push({
          kind: "group",
          groupId: group.documentGroupId,
          documentType: group.documentType,
          direction: section.direction,
          label,
        });
      }
    }
  }
  return nodes;
}

interface ShipmentInspectorProps {
  documentId: string | null;
}

function ShipmentInspector({ documentId }: ShipmentInspectorProps) {
  const { t } = useTranslation("ui");
  const { data, isLoading, error } = useQuery({
    queryKey: ["document-shipment", documentId],
    queryFn: async () => {
      if (!documentId) return null;
      const res = await fetch(`/api/documents/${documentId}/shipment`);
      if (!res.ok) throw new Error("Failed to fetch shipment");
      return res.json() as Promise<{ shipment: any; packages: any[] }>;
    },
    enabled: !!documentId,
  });

  if (!documentId) {
    return (
      <div className="flex h-full items-center justify-center bg-canvas p-6 text-center">
        <span className="text-[13px] text-ink-mute">
          {t("shipment.selectDocument", {
            defaultValue: "Wähle einen Beleg aus der Liste aus, um die Versanddetails anzuzeigen.",
          })}
        </span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4 bg-canvas p-6">
        <Skeleton className="h-6 w-32" />
        <div className="grid grid-cols-2 gap-6">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-full items-center justify-center bg-canvas p-6 text-[13px] text-rose-500">
        {t("shipment.loadError", {
          defaultValue: "Fehler beim Laden der Versanddaten:",
        })}{" "}
        {error instanceof Error
          ? error.message
          : t("common.unknownError", { defaultValue: "Unbekannter Fehler" })}
      </div>
    );
  }

  const key = data.shipment?.documentShipmentId || documentId;
  return <ShipmentForm key={key} documentId={documentId} initialData={data} />;
}

interface ShipmentFormProps {
  documentId: string;
  initialData: { shipment: any; packages: any[] };
}

function ShipmentForm({ documentId, initialData }: ShipmentFormProps) {
  const queryClient = useQueryClient();
  const { t } = useTranslation("ui");
  const s = initialData.shipment || {};

  const [recipientName, setRecipientName] = useState(s.recipientName || "");
  const [company, setCompany] = useState(s.company || "");
  const [street, setStreet] = useState(s.street || "");
  const [houseNumber, setHouseNumber] = useState(s.houseNumber || "");
  const [postalCode, setPostalCode] = useState(s.postalCode || "");
  const [city, setCity] = useState(s.city || "");
  const [countryCode, setCountryCode] = useState(s.countryCode || "DE");
  const [email, setEmail] = useState(s.email || "");
  const [phone, setPhone] = useState(s.phone || "");
  const [trackingId, setTrackingId] = useState(s.trackingId || "");
  const [carrierKey, setCarrierKey] = useState(s.carrierKey || "dhl");
  const [carrierServiceKey, setCarrierServiceKey] = useState(s.carrierServiceKey || "paket");
  const [shipmentStatus, setShipmentStatus] = useState(s.shipmentStatus || "open");

  const [packageLines, setPackageLines] = useState<Array<{ seq: number; weightKg: string }>>(() => {
    if (initialData.packages && initialData.packages.length > 0) {
      return initialData.packages.map((pkg: any) => ({
        seq: pkg.seq,
        weightKg: String(pkg.weightKg || "1.0"),
      }));
    }
    return [{ seq: 1, weightKg: "1.0" }];
  });
  const [isSaving, setIsSaving] = useState(false);

  const totalWeight = useMemo(() => {
    return packageLines.reduce((sum, pkg) => {
      const w = parseFloat(pkg.weightKg) || 0;
      return sum + w;
    }, 0);
  }, [packageLines]);

  const handleAddPackage = () => {
    setPackageLines((prev) => [...prev, { seq: prev.length + 1, weightKg: "1.0" }]);
  };

  const handleDeletePackage = (index: number) => {
    if (packageLines.length <= 1) return;
    setPackageLines((prev) => {
      const updated = prev.filter((_, idx) => idx !== index);
      return updated.map((pkg, idx) => ({
        ...pkg,
        seq: idx + 1,
      }));
    });
  };

  const handleWeightChange = (index: number, val: string) => {
    setPackageLines((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], weightKg: val };
      return updated;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/shipment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shipment: {
            recipientName,
            company: company || null,
            street,
            houseNumber,
            postalCode,
            city,
            countryCode,
            email: email || null,
            phone: phone || null,
            trackingId: trackingId || null,
            carrierKey,
            carrierServiceKey,
            shipmentStatus,
          },
          packages: packageLines.map((pkg) => ({
            seq: pkg.seq,
            weightKg: pkg.weightKg,
          })),
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Failed to save shipment");
      }
      toast.success("Versanddetails erfolgreich gespeichert");
      queryClient.invalidateQueries({ queryKey: ["document-shipment", documentId] });
      queryClient.invalidateQueries({ queryKey: ["data", "document"] });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Fehler beim Speichern des Versands");
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "label_created":
      case "shipped":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900";
      case "exported":
        return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-900";
      case "open":
        return "bg-zinc-100 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800";
      case "cancelled":
        return "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-200 dark:border-rose-900";
      default:
        return "bg-zinc-100 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800";
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas select-text">
      {/* Action Bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-hairline bg-canvas px-4 py-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-medium text-ink-mute uppercase">
              {t("shipment.statusLabel", { defaultValue: "Status:" })}
            </span>
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase ${getStatusBadgeClass(shipmentStatus)}`}
            >
              {shipmentStatus}
            </span>
          </div>
        </div>
        <button
          type="button"
          disabled={isSaving}
          onClick={handleSave}
          className="inline-flex h-8 items-center justify-center rounded bg-primary px-3 text-[12px] font-medium text-primary-fg transition-all hover:opacity-90 disabled:opacity-50"
        >
          {isSaving
            ? t("common.saving", { defaultValue: "Speichern..." })
            : t("shipment.save", { defaultValue: "Versand speichern" })}
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Card 1: Address Snapshot */}
          <div className="space-y-4 rounded border border-hairline bg-canvas-soft p-4 lg:col-span-2">
            <h4 className="border-b border-hairline pb-2 text-[12px] font-bold tracking-wider text-ink uppercase">
              {t("shipment.addressSnapshot", {
                defaultValue: "Empfängeradresse (Snapshot)",
              })}
            </h4>
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="shipment-recipient-name"
                  className="block text-[11px] font-medium text-ink-mute uppercase"
                >
                  {t("shipment.recipientName", { defaultValue: "Name" })}
                </label>
                <input
                  id="shipment-recipient-name"
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="mt-1 h-8 w-full rounded border border-hairline bg-canvas px-2.5 text-[13px] text-ink outline-none focus:border-primary"
                />
              </div>

              <div>
                <label
                  htmlFor="shipment-company"
                  className="block text-[11px] font-medium text-ink-mute uppercase"
                >
                  {t("shipment.company", { defaultValue: "Firma (Optional)" })}
                </label>
                <input
                  id="shipment-company"
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="mt-1 h-8 w-full rounded border border-hairline bg-canvas px-2.5 text-[13px] text-ink outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label
                    htmlFor="shipment-street"
                    className="block text-[11px] font-medium text-ink-mute uppercase"
                  >
                    {t("shipment.street", { defaultValue: "Straße" })}
                  </label>
                  <input
                    id="shipment-street"
                    type="text"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    className="mt-1 h-8 w-full rounded border border-hairline bg-canvas px-2.5 text-[13px] text-ink outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label
                    htmlFor="shipment-house-number"
                    className="block text-[11px] font-medium text-ink-mute uppercase"
                  >
                    {t("shipment.houseNumber", { defaultValue: "Hausnummer" })}
                  </label>
                  <input
                    id="shipment-house-number"
                    type="text"
                    value={houseNumber}
                    onChange={(e) => setHouseNumber(e.target.value)}
                    className="mt-1 h-8 w-full rounded border border-hairline bg-canvas px-2.5 text-[13px] text-ink outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="shipment-postal-code"
                    className="block text-[11px] font-medium text-ink-mute uppercase"
                  >
                    {t("shipment.postalCode", { defaultValue: "PLZ" })}
                  </label>
                  <input
                    id="shipment-postal-code"
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    className="mt-1 h-8 w-full rounded border border-hairline bg-canvas px-2.5 text-[13px] text-ink outline-none focus:border-primary"
                  />
                </div>
                <div className="col-span-2">
                  <label
                    htmlFor="shipment-city"
                    className="block text-[11px] font-medium text-ink-mute uppercase"
                  >
                    {t("shipment.city", { defaultValue: "Ort" })}
                  </label>
                  <input
                    id="shipment-city"
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="mt-1 h-8 w-full rounded border border-hairline bg-canvas px-2.5 text-[13px] text-ink outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="shipment-country-code"
                    className="block text-[11px] font-medium text-ink-mute uppercase"
                  >
                    {t("shipment.countryCode", { defaultValue: "Land (Code)" })}
                  </label>
                  <input
                    id="shipment-country-code"
                    type="text"
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
                    placeholder="DE"
                    className="mt-1 h-8 w-full rounded border border-hairline bg-canvas px-2.5 text-[13px] text-ink outline-none focus:border-primary"
                  />
                </div>
                <div className="col-span-2">
                  <label
                    htmlFor="shipment-email"
                    className="block text-[11px] font-medium text-ink-mute uppercase"
                  >
                    {t("shipment.email", { defaultValue: "E-Mail" })}
                  </label>
                  <input
                    id="shipment-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 h-8 w-full rounded border border-hairline bg-canvas px-2.5 text-[13px] text-ink outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="shipment-phone"
                  className="block text-[11px] font-medium text-ink-mute uppercase"
                >
                  {t("shipment.phone", { defaultValue: "Telefon" })}
                </label>
                <input
                  id="shipment-phone"
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 h-8 w-full rounded border border-hairline bg-canvas px-2.5 text-[13px] text-ink outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Carrier, Status, Tracking & Packages */}
          <div className="space-y-4">
            {/* Shipment Controls */}
            <div className="space-y-4 rounded border border-hairline bg-canvas-soft p-4">
              <h4 className="border-b border-hairline pb-2 text-[12px] font-bold tracking-wider text-ink uppercase">
                {t("shipment.options", { defaultValue: "Versandoptionen" })}
              </h4>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="shipment-carrier-key"
                    className="block text-[11px] font-medium text-ink-mute uppercase"
                  >
                    {t("shipment.carrier", { defaultValue: "Dienstleister" })}
                  </label>
                  <select
                    id="shipment-carrier-key"
                    value={carrierKey}
                    onChange={(e) => setCarrierKey(e.target.value)}
                    className="mt-1 h-8 w-full rounded border border-hairline bg-canvas px-2.5 text-[13px] text-ink outline-none focus:border-primary"
                  >
                    <option value="dhl">DHL</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="shipment-service-key"
                    className="block text-[11px] font-medium text-ink-mute uppercase"
                  >
                    {t("shipment.service", { defaultValue: "Service" })}
                  </label>
                  <select
                    id="shipment-service-key"
                    value={carrierServiceKey}
                    onChange={(e) => setCarrierServiceKey(e.target.value)}
                    className="mt-1 h-8 w-full rounded border border-hairline bg-canvas px-2.5 text-[13px] text-ink outline-none focus:border-primary"
                  >
                    <option value="paket">Paket</option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="shipment-status-select"
                  className="block text-[11px] font-medium text-ink-mute uppercase"
                >
                  {t("shipment.changeStatus", { defaultValue: "Status ändern" })}
                </label>
                <select
                  id="shipment-status-select"
                  value={shipmentStatus}
                  onChange={(e) => setShipmentStatus(e.target.value)}
                  className="mt-1 h-8 w-full rounded border border-hairline bg-canvas px-2.5 text-[13px] text-ink shadow-sm outline-none focus:border-primary"
                >
                  <option value="open">Open / Offen</option>
                  <option value="exported">Exported / Exportiert</option>
                  <option value="label_created">Label Created / Label erstellt</option>
                  <option value="shipped">Shipped / Versendet</option>
                  <option value="cancelled">Cancelled / Storniert</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="shipment-tracking-id"
                  className="block text-[11px] font-medium text-ink-mute uppercase"
                >
                  {t("shipment.trackingId", { defaultValue: "Tracking ID" })}
                </label>
                <div className="mt-1 flex gap-1.5">
                  <input
                    id="shipment-tracking-id"
                    type="text"
                    value={trackingId}
                    onChange={(e) => setTrackingId(e.target.value)}
                    placeholder="Tracking-ID eintragen..."
                    className="h-8 flex-1 rounded border border-hairline bg-canvas px-2.5 text-[13px] text-ink outline-none focus:border-primary"
                  />
                  {trackingId && (
                    <a
                      href={`https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=${encodeURIComponent(trackingId)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex size-8 items-center justify-center rounded border border-hairline bg-canvas text-ink-mute hover:bg-canvas-soft hover:text-ink"
                      title={t("shipment.openTracking", {
                        defaultValue: "DHL Sendungsverfolgung öffnen",
                      })}
                    >
                      <ExternalLinkIcon size={14} />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Packages Controls */}
            <div className="space-y-4 rounded border border-hairline bg-canvas-soft p-4">
              <div className="flex items-center justify-between border-b border-hairline pb-2">
                <h4 className="text-[12px] font-bold tracking-wider text-ink uppercase">
                  {t("shipment.packages", { defaultValue: "Pakete" })} ({packageLines.length})
                </h4>
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                  {totalWeight.toFixed(2)} kg
                </span>
              </div>

              <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1">
                {packageLines.length === 0 ? (
                  <div className="py-4 text-center text-[12px] text-ink-mute">
                    {t("shipment.noPackages", { defaultValue: "Keine Pakete hinzugefügt" })}
                  </div>
                ) : (
                  packageLines.map((pkg, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <span className="w-8 font-mono text-[12px] text-ink-mute">#{pkg.seq}</span>
                      <div className="flex flex-1 items-center gap-1.5">
                        <label htmlFor={`shipment-package-weight-${index}`} className="sr-only">
                          Gewicht
                        </label>
                        <input
                          id={`shipment-package-weight-${index}`}
                          type="text"
                          value={pkg.weightKg}
                          onChange={(e) => handleWeightChange(index, e.target.value)}
                          className="h-8 flex-1 rounded border border-hairline bg-canvas px-2.5 text-right font-mono text-[13px] text-ink outline-none focus:border-primary"
                          placeholder="1.0"
                        />
                        <span className="text-[13px] text-ink-mute">kg</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeletePackage(index)}
                        disabled={packageLines.length <= 1}
                        className="flex h-8 items-center justify-center rounded border border-rose-200 bg-rose-50 px-2 text-[12px] font-medium text-rose-600 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-rose-200 dark:bg-rose-950/20 dark:text-rose-400"
                      >
                        {t("common.delete", { defaultValue: "Löschen" })}
                      </button>
                    </div>
                  ))
                )}
              </div>

              <button
                type="button"
                onClick={handleAddPackage}
                className="flex h-8 w-full items-center justify-center rounded border border-dashed border-hairline bg-canvas text-[12px] font-medium text-ink hover:border-ink-mute hover:bg-canvas-soft"
              >
                {t("shipment.addPackage", { defaultValue: "+ Paket hinzufügen" })}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DocumentsModule() {
  const { state: focusState, setFocus } = useFocus();
  const { registerCommand } = useCommands();
  const { setSubCrumb } = useActionBar();
  const { t } = useTranslation("ui");
  const getTypeLabel = useCallback(
    (documentType: string, fallback: string) =>
      t(`documentTypes.${documentType}`, { defaultValue: fallback }),
    [t],
  );
  const getDirectionLabel = useCallback(
    (direction: string, fallback: string) =>
      t(`documentDirections.${direction}`, { defaultValue: fallback }),
    [t],
  );
  const queryClient = useQueryClient();
  const documentGridRef = React.useRef<DataGridHandle>(null);
  const [editorDocId, setEditorDocId] = useState<string | null>(null);
  const [editorGroupId, setEditorGroupId] = useState<string | undefined>(undefined);
  const [selection, setSelection] = useState<TreeSelection>({ kind: "all" });
  // Ref so command handlers always see the latest selection without re-registering
  const selectionRef = React.useRef(selection);
  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);
  const [expandedDirections, setExpandedDirections] = useState<Set<string>>(
    () => new Set(["OUTBOUND", "INBOUND"]),
  );
  const [conversionDialog, setConversionDialog] = useState<{
    open: boolean;
    recordId: string | null;
    candidates: Array<{
      documentGroupId: string;
      name: string;
      documentType: string;
      groupNumber: number;
    }>;
  }>({ open: false, recordId: null, candidates: [] });
  const [duplicateDialog, setDuplicateDialog] = useState<{
    open: boolean;
    recordId: string | null;
    candidates: DocumentTargetGroupCandidate[];
    selectedGroupId: string | null;
    isPending: boolean;
  }>({ open: false, recordId: null, candidates: [], selectedGroupId: null, isPending: false });
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(
    focusState.entity === "document" ? focusState.recordId : null,
  );
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [documentMailBusy, setDocumentMailBusy] = useState(false);
  const [documentMailOpen, setDocumentMailOpen] = useState(false);
  const [documentMailIdentities, setDocumentMailIdentities] = useState<EmailComposeIdentity[]>([]);
  const [documentMailComposer, setDocumentMailComposer] = useState<EmailComposeValue>({
    identityId: "",
    to: "",
    cc: "",
    bcc: "",
    subject: "",
    bodyText: "",
    bodyHtml: "",
  });
  const [documentMailAttachments, setDocumentMailAttachments] = useState<EmailComposeAttachment[]>(
    [],
  );
  const [documentMailNotice, setDocumentMailNotice] = useState<string | null>(null);
  const lastSyncIdRef = React.useRef<string | null>(activeDocumentId);
  const gridState = useGridUrlState({ defaultPageSize: 50 });
  const documentRestoreIdRef = React.useRef<string | null | undefined>(undefined);
  const prevEditorDocIdRef = React.useRef<string | null>(editorDocId);

  useEffect(() => () => setSubCrumb(undefined), [setSubCrumb]);

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await fetch("/api/me");
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: companies = EMPTY_ARRAY } = useQuery({
    queryKey: ["data", "company", "tenant-options"],
    queryFn: async () => {
      const res = await fetch("/api/data/company?orderBy=companyNo:asc&limit=200");
      if (!res.ok) return [];
      return res.json();
    },
  });

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (companies.length === 0) {
        setSelectedCompanyId(null);
        return;
      }
      setSelectedCompanyId((current) => {
        if (current && companies.some((row: any) => row.companyId === current)) return current;
        const preferred = me?.lastCompanyId;
        if (preferred && companies.some((row: any) => row.companyId === preferred))
          return preferred;
        return companies[0]?.companyId ?? null;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [companies, me?.lastCompanyId]);

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

  useEffect(() => {
    if (
      focusState.entity === "document" &&
      focusState.recordId &&
      focusState.recordId !== lastSyncIdRef.current
    ) {
      lastSyncIdRef.current = focusState.recordId;
      setActiveDocumentId(focusState.recordId);
    }
  }, [focusState.entity, focusState.recordId]);

  useEffect(() => {
    const prevEditorDocId = prevEditorDocIdRef.current;
    prevEditorDocIdRef.current = editorDocId;
    if (prevEditorDocId === null || editorDocId !== null) return;
    const restoreId =
      documentRestoreIdRef.current === undefined ? activeDocumentId : documentRestoreIdRef.current;
    documentRestoreIdRef.current = undefined;
    requestAnimationFrame(() => documentGridRef.current?.restoreFocus(restoreId ?? null));
  }, [editorDocId, activeDocumentId]);

  // Fetch documents — paginated, filtered by tree selection
  const { data: documentData, isLoading: isDataLoading } = useQuery({
    queryKey: [
      "data",
      "document",
      selection,
      gridState.queryParams.page,
      gridState.queryParams.limit,
      gridState.queryParams.orderBy,
      gridState.queryParams.search,
      gridState.queryParams.filters,
      selectedCompanyId,
    ],
    queryFn: async () => {
      const p = new URLSearchParams({
        paginated: "true",
        page: String(gridState.queryParams.page),
        limit: String(gridState.queryParams.limit),
      });
      if (gridState.queryParams.orderBy) p.set("orderBy", gridState.queryParams.orderBy);
      if (gridState.queryParams.search) p.set("search", gridState.queryParams.search);
      if (gridState.queryParams.filters)
        p.set("filters", JSON.stringify(gridState.queryParams.filters));
      if (selection.kind === "group") p.set("documentGroupId", selection.groupId);
      else if (selection.kind === "type") p.set("documentType", selection.documentType);
      if (selectedCompanyId) p.set("companyId", selectedCompanyId);
      const res = await fetch(`/api/data/document?${p}`);
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json() as Promise<{ data: any[]; total: number }>;
    },
    enabled: !!selectedCompanyId,
  });

  const documents = useMemo(() => documentData?.data ?? EMPTY_ARRAY, [documentData]);

  // Fetch document tree sections — always fresh, no stale cache
  const {
    data: treeSections = [],
    isLoading: isTreeLoading,
    error: treeError,
  } = useQuery({
    queryKey: ["documents", "tree", selectedCompanyId],
    staleTime: 0,
    queryFn: async () => {
      const p = new URLSearchParams();
      if (selectedCompanyId) p.set("companyId", selectedCompanyId);
      const res = await fetch(`/api/documents/tree?${p}`);
      if (!res.ok) {
        const text = await res.text();
        console.error("[Tree] fetch failed", res.status, text);
        throw new Error(`Tree fetch ${res.status}: ${text}`);
      }
      const raw = await res.json();
      // Normalise: older cached format may have `groups` instead of `types`
      return (raw as any[]).map((s: any) => ({
        ...s,
        types: (s.types ?? s.groups ?? []).map((t: any) => ({
          ...t,
          mainGroup: t.mainGroup ?? (t.groups ?? []).find((g: any) => g.groupNumber === 0) ?? null,
          groups: (t.groups ?? []).filter((g: any) => g.groupNumber > 0),
        })),
      })) as TreeSection[];
    },
    enabled: !!selectedCompanyId,
  });

  if (treeError) console.error("[Tree] query error", treeError);

  const { data: addresses = EMPTY_ARRAY } = useQuery({
    queryKey: ["data", "address", "all"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const res = await fetch("/api/data/address");
      if (!res.ok) throw new Error("Failed to fetch addresses");
      return res.json();
    },
  });

  const { data: documentGroups = EMPTY_ARRAY } = useQuery({
    queryKey: ["data", "documentGroup", "all", selectedCompanyId],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const p = new URLSearchParams();
      if (selectedCompanyId) p.set("companyId", selectedCompanyId);
      const res = await fetch(`/api/data/documentGroup?${p}`);
      if (!res.ok) throw new Error("Failed to fetch document groups");
      return res.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: warehouses = EMPTY_ARRAY } = useQuery({
    queryKey: ["data", "warehouse", "all", selectedCompanyId],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const p = new URLSearchParams();
      if (selectedCompanyId) p.set("companyId", selectedCompanyId);
      const res = await fetch(`/api/data/warehouse?${p}`);
      if (!res.ok) throw new Error("Failed to fetch warehouses");
      return res.json();
    },
    enabled: !!selectedCompanyId,
  });

  const addressMap = useMemo(
    () => new Map<string, any>((addresses || EMPTY_ARRAY).map((a: any) => [a.addressId, a])),
    [addresses],
  );
  const groupMap = useMemo(
    () =>
      new Map<string, any>((documentGroups || EMPTY_ARRAY).map((g: any) => [g.documentGroupId, g])),
    [documentGroups],
  );
  const warehouseMap = useMemo(
    () => new Map<string, any>((warehouses || EMPTY_ARRAY).map((w: any) => [w.warehouseId, w])),
    [warehouses],
  );
  const onTreeSelectionCommitted = useCallback(() => {
    documentGridRef.current?.restoreFocus(activeDocumentId ?? null);
  }, [activeDocumentId]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setSelection({ kind: "all" });
      setActiveDocumentId(null);
      setEditorDocId(null);
      setEditorGroupId(undefined);
      setSubCrumb(undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedCompanyId, setSubCrumb]);

  // Fetch document lines for selected document (server-side FK filter)
  const { data: lines = EMPTY_ARRAY } = useQuery({
    queryKey: ["data", "documentLine", activeDocumentId],
    queryFn: async () => {
      const res = await fetch(
        `/api/data/documentLine?documentId=${activeDocumentId}&orderBy=lineNo:asc`,
      );
      if (!res.ok) throw new Error("Failed to fetch document lines");
      return res.json();
    },
    enabled: !!activeDocumentId,
    placeholderData: keepPreviousData,
  });

  const handleSelectType = (
    documentType: string,
    direction: string,
    label: string,
    groupId: string | null,
  ) => {
    setSelection({ kind: "type", documentType, direction, groupId });
    setSubCrumb(label);
    gridState.setPage(1);
    setFocus({
      area: "tree",
      treeEntity: "documentType",
      treePanel: "document-tree",
      treeRecordId: documentType,
    });
  };

  const handleSelectGroup = (
    groupId: string,
    documentType: string,
    direction: string,
    label: string,
  ) => {
    setSelection({ kind: "group", groupId, documentType, direction });
    setSubCrumb(label);
    gridState.setPage(1);
    setFocus({
      area: "tree",
      treeEntity: "documentGroup",
      treePanel: "document-tree",
      treeRecordId: groupId,
    });
  };

  const handleToggleDirection = (direction: string) => {
    setExpandedDirections((prev) => {
      const next = new Set(prev);
      if (next.has(direction)) next.delete(direction);
      else next.add(direction);
      return next;
    });
  };

  const openDocumentMail = useCallback(async () => {
    if (!activeDocumentId) {
      toast.error("No document selected");
      return;
    }
    setDocumentMailBusy(true);
    try {
      const accountsRes = await fetch("/api/email/accounts");
      if (!accountsRes.ok) throw new Error(await accountsRes.text());
      const accounts = (await accountsRes.json()) as Array<{ emailAccountId: string }>;
      let identities: EmailComposeIdentity[] = [];
      let identity: EmailComposeIdentity | undefined;
      for (const account of accounts) {
        const identitiesRes = await fetch(
          `/api/email/accounts/${account.emailAccountId}/identities`,
        );
        if (!identitiesRes.ok) continue;
        const accountIdentities = (await identitiesRes.json()) as EmailComposeIdentity[];
        identities = [...identities, ...accountIdentities];
        identity = accountIdentities.find((item) => item.canSend) ?? identity;
      }
      if (!identity) throw new Error("No sending identity available");

      const res = await fetch(`/api/email/documents/${activeDocumentId}/compose-defaults`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          emailIdentityId: identity.emailIdentityId,
          templateId: null,
          language: null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const result = await res.json();
      const warnings = Array.isArray(result.warnings)
        ? result.warnings.filter((item: unknown) => typeof item === "string")
        : [];
      setDocumentMailIdentities(identities.filter((item) => item.canSend !== false));
      setDocumentMailComposer({
        identityId: result.emailIdentityId ?? identity.emailIdentityId,
        to: formatEmailAddresses(result.to),
        cc: formatEmailAddresses(result.cc),
        bcc: formatEmailAddresses(result.bcc),
        subject: result.subject ?? "",
        bodyText: result.bodyText ?? "",
        bodyHtml: result.bodyHtml ?? "",
      });
      setDocumentMailAttachments(
        (Array.isArray(result.attachments) ? result.attachments : []).map((attachment: any) => ({
          fileName: String(attachment.fileName ?? ""),
          contentType: String(attachment.contentType ?? "application/octet-stream"),
          sizeBytes: typeof attachment.sizeBytes === "number" ? attachment.sizeBytes : null,
          readOnly: true,
        })),
      );
      setDocumentMailNotice(warnings.length > 0 ? warnings.join(" ") : null);
      setDocumentMailOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setDocumentMailBusy(false);
    }
  }, [activeDocumentId]);

  const submitDocumentMail = useCallback(
    async (action: EmailComposeAction, value: EmailComposeSubmitValue) => {
      if (!activeDocumentId) return;
      setDocumentMailBusy(true);
      try {
        const res = await fetch(`/api/email/documents/${activeDocumentId}/prepare-send`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            emailIdentityId: value.identityId,
            to: parseEmailAddresses(value.to),
            cc: parseEmailAddresses(value.cc),
            bcc: parseEmailAddresses(value.bcc),
            subject: value.subject,
            bodyText: value.bodyText,
            bodyHtml: value.bodyHtml,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        const result = await res.json();
        const outboxId = result.draft?.outbox?.emailOutboxId ?? result.draft?.emailOutboxId;
        if (!outboxId) throw new Error("Email draft was not created");

        if (action !== "save-draft") {
          const actionPath =
            action === "provider-draft" ? "provider-draft" : action === "queue" ? "queue" : "send";
          const actionRes = await fetch(`/api/email/drafts/${outboxId}/${actionPath}`, {
            method: "POST",
          });
          if (!actionRes.ok) throw new Error(await actionRes.text());
        }

        toast.success(
          action === "save-draft"
            ? "Draft saved"
            : action === "provider-draft"
              ? "Provider draft saved"
              : action === "queue"
                ? "Draft queued"
                : "Draft sent",
        );
        setDocumentMailOpen(false);
        queryClient.invalidateQueries({ queryKey: ["email"] });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
      } finally {
        setDocumentMailBusy(false);
      }
    },
    [activeDocumentId, queryClient],
  );

  // Register context commands
  useEffect(() => {
    if (editorDocId) return;

    const unregF3 = registerCommand({
      id: "create-record",
      scope: "context",
      group: "recordOps",
      label: { en: t("commands.newRecord"), de: "Neuer Beleg" },
      shortcut: "F3",
      isEnabled: () => true,
      handler: () => {
        const sel = selectionRef.current;
        documentRestoreIdRef.current = undefined;
        setEditorGroupId(
          sel.kind === "group"
            ? sel.groupId
            : sel.kind === "type"
              ? (sel.groupId ?? undefined)
              : undefined,
        );
        setEditorDocId("__new__");
      },
    });
    const unregEdit = registerCommand({
      id: "edit-record",
      scope: "context",
      group: "recordOps",
      label: { en: "Edit", de: "Bearbeiten" },
      shortcut: "F2",
      isEnabled: (s) => !!s.recordId && s.entity === "document",
      handler: (s) => {
        if (s.recordId) {
          documentRestoreIdRef.current = undefined;
          setEditorGroupId(undefined);
          setEditorDocId(s.recordId);
        }
      },
    });
    const unregF9 = registerCommand({
      id: "open-document",
      scope: "context",
      group: "workflow",
      label: { en: t("commands.openDocument"), de: "Beleg öffnen" },
      shortcut: "F9",
      isEnabled: (s) => !!s.recordId && s.entity === "document",
      handler: (s) => {
        if (s.recordId) {
          documentRestoreIdRef.current = undefined;
          setEditorGroupId(undefined);
          setEditorDocId(s.recordId);
        }
      },
    });
    const unregF7 = registerCommand({
      id: "transform-record",
      scope: "context",
      group: "workflow",
      label: { en: t("commands.transform"), de: "Umwandeln" },
      shortcut: "F7",
      isEnabled: (s) => !!s.recordId && s.entity === "document",
      handler: async (s) => {
        if (!s.recordId) return;
        const res = await fetch(`/api/documents/${s.recordId}/convert`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.requiresSelection) {
          setConversionDialog({ open: true, recordId: s.recordId, candidates: data.candidates });
        } else if (data.newDocumentId) {
          queryClient.invalidateQueries({ queryKey: ["data", "document"] });
        }
      },
    });
    const unregF4 = registerCommand({
      id: "delete-record",
      scope: "context",
      group: "recordOps",
      label: { en: t("actions.delete"), de: "Löschen" },
      shortcut: "F4",
      isEnabled: (s) => !!s.recordId && s.entity === "document",
      handler: async (s) => {
        if (!s.recordId) return;
        const res = await fetch(`/api/documents/${s.recordId}/delete`, {
          method: "POST",
        });
        if (!res.ok) {
          const message = await res.text();
          toast.error(message || t("form.fkViolationError"));
          return;
        }
        const result = await res.json();
        if (result.archived) {
          toast.success(t("form.archiveSuccess"));
        } else if (result.deleted) {
          toast.success(t("form.deleteSuccess"));
        }
        queryClient.invalidateQueries({ queryKey: ["data", "document"] });
      },
    });
    const unregDup = registerCommand({
      id: "duplicate-record",
      scope: "context",
      group: "recordOps",
      label: { en: "Duplicate", de: "Duplizieren" },
      shortcut: "F8",
      isEnabled: (s) => !!s.recordId && s.entity === "document",
      handler: async (s) => {
        if (!s.recordId) return;
        const res = await fetch(`/api/documents/${s.recordId}/duplicate`, { method: "POST" });
        if (!res.ok) {
          const message = await res.text();
          toast.error(message || t("document.duplicate.noTargets"));
          return;
        }
        const data = (await res.json()) as { candidates?: DocumentTargetGroupCandidate[] };
        const candidates = data.candidates ?? [];
        if (candidates.length === 0) {
          toast.error(t("document.duplicate.noTargets"));
          return;
        }
        setDuplicateDialog({
          open: true,
          recordId: s.recordId,
          candidates,
          selectedGroupId: candidates[0]?.documentGroupId ?? null,
          isPending: false,
        });
      },
    });
    const unregPrint = registerCommand({
      id: "print-document",
      scope: "context",
      group: "workflow",
      label: { en: "Print Document", de: "Beleg drucken" },
      shortcut: "F6",
      isEnabled: (s) => !!s.recordId && s.entity === "document",
      handler: (s) => {
        if (!s.recordId) return;
        window.open(`/api/documents/${s.recordId}/print`, "_blank", "noopener,noreferrer");
      },
    });
    const unregPost = registerCommand({
      id: "post-document",
      scope: "context",
      group: "workflow",
      label: { en: "Post Document", de: "Beleg buchen" },
      isEnabled: (s) => !!s.recordId && s.entity === "document",
      handler: async (s) => {
        if (!s.recordId) return;
        const res = await fetch(`/api/documents/${s.recordId}/post`, {
          method: "POST",
        });
        if (!res.ok) {
          const message = await res.text();
          toast.error(message || "Unable to post document");
          return;
        }
        queryClient.invalidateQueries({ queryKey: ["data", "document"] });
        queryClient.invalidateQueries({ queryKey: ["data", "documentLine"] });
      },
    });
    const unregEmail = registerCommand({
      id: "document-mail",
      scope: "context",
      group: "workflow",
      label: { en: "Send by Email", de: "Per E-Mail senden" },
      shortcut: "Ctrl+Alt+M",
      isEnabled: (s) => !!s.recordId && s.entity === "document",
      handler: async () => {
        await openDocumentMail();
      },
    });
    const unregImportTracking = registerCommand({
      id: "import-tracking-csv",
      scope: "context",
      group: "workflow",
      label: { en: "Import DHL Tracking", de: "DHL-Tracking importieren" },
      isEnabled: () => true,
      handler: () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".csv";
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) return;

          const formData = new FormData();
          formData.append("file", file);

          try {
            const res = await fetch("/api/documents/import-tracking", {
              method: "POST",
              body: formData,
            });

            if (!res.ok) {
              throw new Error(await res.text());
            }

            const data = await res.json();
            const updatedCount = data.count ?? 0;
            toast.success(`${updatedCount} shipments updated / Sendungen aktualisiert`);
            queryClient.invalidateQueries({ queryKey: ["data", "document"] });
          } catch (err: any) {
            console.error("Error importing tracking CSV:", err);
            toast.error(err.message || "Failed to import tracking CSV");
          }
        };
        input.click();
      },
    });
    return () => {
      unregF3();
      unregEdit();
      unregF9();
      unregF7();
      unregF4();
      unregDup();
      unregPrint();
      unregPost();
      unregEmail();
      unregImportTracking();
    };
  }, [editorDocId, openDocumentMail, queryClient, registerCommand, t]);

  // Tree keyboard navigation
  useEffect(() => {
    const flatNodes = buildFlatNodes(treeSections, expandedDirections, getTypeLabel);

    const currentIdx = flatNodes.findIndex((n) => {
      if (selection.kind === "type")
        return n.kind === "type" && n.documentType === selection.documentType;
      if (selection.kind === "group")
        return n.kind === "group" && (n as any).groupId === selection.groupId;
      return false;
    });

    const navigate = (delta: number) => {
      if (flatNodes.length === 0) return;
      const base = currentIdx < 0 ? (delta > 0 ? -1 : flatNodes.length) : currentIdx;
      const idx = (base + delta + flatNodes.length) % flatNodes.length;
      const node = flatNodes[idx];
      if (!node) return;
      if (node.kind === "type") {
        setSelection({
          kind: "type",
          documentType: node.documentType,
          direction: node.direction,
          groupId: node.groupId,
        });
        setSubCrumb(node.label);
      } else {
        setSelection({
          kind: "group",
          groupId: (node as any).groupId,
          documentType: node.documentType,
          direction: node.direction,
        });
        setSubCrumb(node.label);
      }
    };

    const getCurrentDirection = () => (selection.kind === "all" ? null : selection.direction);

    const unregDown = registerCommand({
      id: "tree-nav-down",
      scope: "context",
      group: "navigation",
      label: { en: "Next Tree Item", de: "Nächster Eintrag" },
      shortcut: "Ctrl+ArrowDown",
      isEnabled: () => true,
      isVisible: () => !editorDocId,
      handler: () => navigate(1),
    });
    const unregUp = registerCommand({
      id: "tree-nav-up",
      scope: "context",
      group: "navigation",
      label: { en: "Previous Tree Item", de: "Vorheriger Eintrag" },
      shortcut: "Ctrl+ArrowUp",
      isEnabled: () => true,
      isVisible: () => !editorDocId,
      handler: () => navigate(-1),
    });
    const unregRight = registerCommand({
      id: "tree-nav-right",
      scope: "context",
      group: "navigation",
      label: { en: "Expand Direction", de: "Segment aufklappen" },
      shortcut: "Ctrl+ArrowRight",
      isEnabled: () => true,
      isVisible: () => !editorDocId,
      handler: () => {
        const dir = getCurrentDirection();
        if (dir && !expandedDirections.has(dir)) handleToggleDirection(dir);
      },
    });
    const unregLeft = registerCommand({
      id: "tree-nav-left",
      scope: "context",
      group: "navigation",
      label: { en: "Collapse Direction", de: "Segment zuklappen" },
      shortcut: "Ctrl+ArrowLeft",
      isEnabled: () => true,
      isVisible: () => !editorDocId,
      handler: () => {
        const dir = getCurrentDirection();
        if (dir && expandedDirections.has(dir)) handleToggleDirection(dir);
      },
    });

    return () => {
      unregDown();
      unregUp();
      unregRight();
      unregLeft();
    };
  }, [
    registerCommand,
    treeSections,
    expandedDirections,
    selection,
    setSubCrumb,
    editorDocId,
    getTypeLabel,
  ]);

  const selectedDocument = documents.find((d: any) => d.documentId === activeDocumentId);

  const dependentTabs = useMemo(
    () => [
      {
        id: "lines",
        label: t("document.linesTab", { defaultValue: "Belegzeilen" }),
        count: lines.length || undefined,
        content: (
          <DataGrid
            entityName="documentLine"
            panelId="lines-grid"
            data={lines}
            keyExtractor={(row: any) => row.documentLineId || row.lineId || row.id}
            title={t("document.linesTitle", { defaultValue: "Zeilen" })}
            toolbar={false}
            emptyTitle={t("document.noLinesTitle", { defaultValue: "Noch keine Zeilen." })}
            emptySubtitle={t("document.noLinesSubtitle", {
              defaultValue: "Öffne den Belegeditor, um Zeilen hinzuzufügen.",
            })}
            className="h-full rounded-none border-none"
            columns={[
              {
                key: "lineNo",
                header: t("document.lines.pos", { defaultValue: "Pos." }),
                isNumeric: true,
                render: (r: any) => (
                  <span className="font-mono tabular-nums">
                    {String(r.lineNo ?? 0).padStart(3, "0")}
                  </span>
                ),
              },
              {
                key: "articleNo",
                header: t("document.lines.article", { defaultValue: "Article" }),
                render: (r: any) => (
                  <span className="font-mono text-[12px]">{r.articleNo || "—"}</span>
                ),
              },
              {
                key: "articleTextSnapshot",
                header: t("document.lines.description", { defaultValue: "Description" }),
              },
              {
                key: "quantity",
                header: t("document.lines.qty", { defaultValue: "Qty" }),
                isNumeric: true,
                render: (r: any) => (
                  <span className="tabular-nums">
                    {r.quantity} {r.unit}
                  </span>
                ),
              },
              {
                key: "netPrice",
                header: t("document.lines.price", { defaultValue: "Unit Price" }),
                isNumeric: true,
                render: (r: any) => (
                  <span className="tabular-nums">{formatMoney(r.netPrice ?? 0)}</span>
                ),
              },
              {
                key: "discountPercentage",
                header: t("document.lines.discount", { defaultValue: "Disc." }),
                isNumeric: true,
                render: (r: any) => (
                  <span className="tabular-nums">{r.discountPercentage ?? 0}%</span>
                ),
              },
              {
                key: "lineTotalNet",
                header: t("document.lines.net", { defaultValue: "Total" }),
                isNumeric: true,
                render: (r: any) => (
                  <span className="tabular-nums">{formatMoney(r.lineTotalNet ?? 0)}</span>
                ),
              },
            ]}
          />
        ),
      },
      {
        id: "header",
        label: t("document.headerTab", { defaultValue: "Kopfdaten" }),
        content: (
          <InspectorPanel
            title={selectedDocument?.documentNo ?? t("document.title", { defaultValue: "Beleg" })}
            recordId={activeDocumentId ?? undefined}
            sections={[
              {
                title: t("document.section", { defaultValue: "Beleg" }),
                fields: [
                  {
                    label: t("document.fields.documentNo", { defaultValue: "No." }),
                    value: (
                      <span className="font-mono tabular-nums">{selectedDocument?.documentNo}</span>
                    ),
                  },
                  {
                    label: t("document.fields.documentType", { defaultValue: "Type" }),
                    value: selectedDocument?.documentTypeId,
                  },
                  {
                    label: t("document.fields.date", { defaultValue: "Date" }),
                    value: selectedDocument?.documentDate,
                  },
                  {
                    label: t("document.fields.status", { defaultValue: "Status" }),
                    value: selectedDocument?.status,
                  },
                ],
              },
              {
                title: t("document.parties", { defaultValue: "Beteiligte" }),
                fields: [
                  {
                    label: t("document.fields.customerId", { defaultValue: "Customer" }),
                    value: selectedDocument?.customerId,
                  },
                  {
                    label: t("document.fields.currency", { defaultValue: "Currency" }),
                    value: selectedDocument?.currencyId,
                  },
                ],
              },
              {
                title: t("document.totals", { defaultValue: "Summen" }),
                fields: [
                  {
                    label: t("document.fields.net", { defaultValue: "Net" }),
                    value:
                      selectedDocument?.totalNet != null
                        ? formatMoney(selectedDocument.totalNet)
                        : "—",
                  },
                  {
                    label: t("document.fields.tax", { defaultValue: "Tax" }),
                    value:
                      selectedDocument?.totalTax != null
                        ? formatMoney(selectedDocument.totalTax)
                        : "—",
                  },
                  {
                    label: t("document.fields.gross", { defaultValue: "Gross" }),
                    value:
                      selectedDocument?.totalGross != null
                        ? formatMoney(selectedDocument.totalGross)
                        : "—",
                  },
                ],
              },
            ]}
          />
        ),
      },
      {
        id: "shipment",
        label: t("document.shipmentTab", { defaultValue: "Versand" }),
        content: <ShipmentInspector documentId={activeDocumentId} />,
      },
    ],
    [lines, selectedDocument, activeDocumentId, t],
  );

  return (
    <>
      <EmailComposeDialog
        open={documentMailOpen}
        title="Send document by email"
        identities={documentMailIdentities}
        value={documentMailComposer}
        mode={documentMailComposer.bodyHtml ? "html" : "plain"}
        attachments={documentMailAttachments}
        notice={documentMailNotice}
        busy={documentMailBusy}
        onClose={() => setDocumentMailOpen(false)}
        onSubmit={submitDocumentMail}
      />
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-hairline bg-canvas px-4">
          <span className="text-[11px] font-medium tracking-wider text-ink-mute uppercase">
            Company
          </span>
          <select
            value={selectedCompanyId ?? ""}
            disabled={companies.length === 0}
            onChange={(event) => {
              if (event.target.value) void persistSelectedCompany(event.target.value);
            }}
            className="h-7 min-w-56 rounded border border-hairline-input bg-canvas px-2 text-[12px] text-ink outline-none focus-visible:border-primary"
          >
            {companies.map((row: any) => (
              <option key={row.companyId} value={row.companyId}>
                {[row.companyNo, row.name].filter(Boolean).join(" - ")}
              </option>
            ))}
          </select>
          <button
            onClick={() => void openDocumentMail()}
            disabled={!activeDocumentId || documentMailBusy}
            className="ml-auto flex h-7 items-center gap-1.5 rounded-full border border-hairline px-3 text-[12px] text-ink-secondary transition-colors hover:border-primary hover:text-primary disabled:opacity-40"
          >
            <ExternalLinkIcon className="size-3.5" />
            {documentMailBusy ? "Preparing…" : "Email"}
          </button>
        </div>
        <div className="min-h-0 flex-1">
          <TriViewWorkspace
            navigationTree={
              <DocumentNavigationTree
                sections={treeSections}
                isLoading={isTreeLoading}
                selection={selection}
                onSelectType={handleSelectType}
                onSelectGroup={handleSelectGroup}
                expandedDirections={expandedDirections}
                onToggleDirection={handleToggleDirection}
                getTypeLabel={getTypeLabel}
                getDirectionLabel={getDirectionLabel}
                onSelectCommit={onTreeSelectionCommitted}
                header={t("tree.types")}
              />
            }
            primaryGrid={
              editorDocId ? (
                <DocumentEditor
                  documentId={editorDocId}
                  documentGroupId={editorGroupId}
                  companyId={selectedCompanyId ?? undefined}
                  onCreateNewDocument={(groupId) => {
                    documentRestoreIdRef.current = undefined;
                    setEditorGroupId(groupId);
                    setEditorDocId("__new__");
                  }}
                  onSaved={(savedId) => {
                    documentRestoreIdRef.current = savedId;
                  }}
                  onClose={() => {
                    setEditorDocId(null);
                    setEditorGroupId(undefined);
                  }}
                />
              ) : (
                <DataGrid
                  ref={documentGridRef}
                  entityName="document"
                  panelId="document-grid"
                  data={documents}
                  isLoading={isDataLoading}
                  keyExtractor={(row: any) => row.documentId}
                  title={t("nav.documents")}
                  columns={[
                    {
                      key: "documentNo",
                      header: "Beleg-Nr.",
                      sortable: true,
                      render: (r: any) => (
                        <span className="font-mono tabular-nums">{r.documentNo}</span>
                      ),
                    },
                    {
                      key: "documentType",
                      header: "Typ",
                      render: (r: any) => (
                        <span
                          className="font-mono text-[11px]"
                          title={DOC_TYPE_LABELS[r.documentType]}
                        >
                          {r.documentType}
                        </span>
                      ),
                    },
                    {
                      key: "documentGroupId",
                      header: "Gruppe",
                      render: (r: any) => (
                        <span>{groupMap.get(r.documentGroupId)?.name ?? ""}</span>
                      ),
                    },
                    {
                      key: "documentDate",
                      header: "Datum",
                      isNumeric: true,
                      sortable: true,
                      render: (r: any) => (
                        <span className="tabular-nums">{formatDate(r.documentDate)}</span>
                      ),
                    },
                    {
                      key: "customerId",
                      header: "Adresse",
                      render: (r: any) => (
                        <span>{addressDisplayName(addressMap.get(r.customerId))}</span>
                      ),
                    },
                    {
                      key: "warehouseId",
                      header: "Lager",
                      render: (r: any) => (
                        <span>{warehouseMap.get(r.warehouseId)?.name ?? ""}</span>
                      ),
                    },
                    { key: "currencyId", header: "Währung" },
                    {
                      key: "totalNet",
                      header: "Netto",
                      isNumeric: true,
                      sortable: true,
                      render: (r: any) => (
                        <span className="tabular-nums">
                          {r.totalNet != null ? formatMoney(r.totalNet) : ""}
                        </span>
                      ),
                    },
                    {
                      key: "totalGross",
                      header: "Gesamt",
                      isNumeric: true,
                      sortable: true,
                      render: (r: any) => (
                        <span className="tabular-nums">
                          {r.totalGross != null ? formatMoney(r.totalGross) : ""}
                        </span>
                      ),
                    },
                    {
                      key: "status",
                      header: "Status",
                      sortable: true,
                      render: (r: any) => <StatusDot status={r.status ?? "draft"} />,
                    },
                  ]}
                  totalCount={documentData?.total}
                  page={gridState.page}
                  pageSize={gridState.pageSize}
                  sort={gridState.sort}
                  onPageChange={gridState.setPage}
                  onPageSizeChange={gridState.setPageSize}
                  onSortChange={gridState.setSort}
                  search={gridState.search}
                  onSearchChange={gridState.setSearch}
                  filters={gridState.filters}
                  onFiltersChange={gridState.setFilters}
                  selectable
                  bulkActions={[
                    {
                      label: "Delete",
                      variant: "destructive" as const,
                      onClick: async (keys: string[]) => {
                        try {
                          await Promise.all(
                            keys.map(async (id) => {
                              const res = await fetch(`/api/documents/${id}/delete`, {
                                method: "POST",
                              });
                              if (!res.ok) throw new Error(await res.text());
                            }),
                          );
                          queryClient.invalidateQueries({ queryKey: ["data", "document"] });
                        } catch (err) {
                          toast.error(
                            err instanceof Error && err.message
                              ? err.message
                              : t("form.fkViolationError"),
                          );
                        }
                      },
                    },
                    {
                      label: "Versand-CSV (DHL GKP)",
                      onClick: async (keys: string[]) => {
                        try {
                          const res = await fetch("/api/documents/export", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ documentIds: keys }),
                          });
                          if (!res.ok) throw new Error(await res.text());

                          const csvText = await res.text();
                          const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement("a");
                          link.href = url;
                          link.setAttribute("download", "dhl_export.csv");
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          URL.revokeObjectURL(url);

                          toast.success("DHL-Export erfolgreich abgeschlossen");
                          queryClient.invalidateQueries({ queryKey: ["data", "document"] });
                        } catch (err) {
                          toast.error(
                            err instanceof Error && err.message
                              ? err.message
                              : "Fehler beim DHL-CSV-Export",
                          );
                        }
                      },
                    },
                  ]}
                  onRowOpen={(row: any) => {
                    documentRestoreIdRef.current = undefined;
                    setEditorGroupId(undefined);
                    setEditorDocId(row.documentId);
                  }}
                  emptyTitle="No documents yet."
                  emptySubtitle="Create the first document."
                  emptyAction={{
                    label: `${t("actions.new")} Document`,
                    kbd: "F3",
                    onClick: () => {
                      const sel = selectionRef.current;
                      documentRestoreIdRef.current = undefined;
                      setEditorGroupId(
                        sel.kind === "group"
                          ? sel.groupId
                          : sel.kind === "type"
                            ? (sel.groupId ?? undefined)
                            : undefined,
                      );
                      setEditorDocId("__new__");
                    },
                  }}
                  className="h-full rounded-none border-none"
                />
              )
            }
            dependentContext={editorDocId ? null : <ContextTabs tabs={dependentTabs} />}
          />
        </div>
      </div>

      <DocumentTargetGroupDialog
        open={duplicateDialog.open}
        onOpenChange={(open) => setDuplicateDialog((p) => ({ ...p, open }))}
        title="Zielgruppe wählen"
        description="Mehrere Zielgruppen verfügbar. Bitte eine Zielgruppe auswählen."
        candidates={duplicateDialog.candidates}
        selectedGroupId={duplicateDialog.selectedGroupId}
        confirmLabel="Duplizieren"
        confirmPendingLabel="Dupliziere..."
        isPending={duplicateDialog.isPending}
        onSelectGroupId={(groupId) =>
          setDuplicateDialog((p) => ({ ...p, selectedGroupId: groupId }))
        }
        onConfirm={async () => {
          const targetGroupId =
            duplicateDialog.selectedGroupId ?? duplicateDialog.candidates[0]?.documentGroupId;
          if (!duplicateDialog.recordId || !targetGroupId) return;
          setDuplicateDialog((p) => ({ ...p, isPending: true }));
          try {
            const res = await fetch(`/api/documents/${duplicateDialog.recordId}/duplicate`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ targetGroupId }),
            });
            if (res.ok) {
              setDuplicateDialog({
                open: false,
                recordId: null,
                candidates: [],
                selectedGroupId: null,
                isPending: false,
              });
              queryClient.invalidateQueries({ queryKey: ["data", "document"] });
              toast.success("Document duplicated");
            } else {
              toast.error("Unable to duplicate document");
            }
          } finally {
            setDuplicateDialog((p) => ({ ...p, isPending: false }));
          }
        }}
      />

      <Dialog
        open={conversionDialog.open}
        onOpenChange={(open) => setConversionDialog((p) => ({ ...p, open }))}
      >
        <DialogContent className="max-w-sm overflow-hidden p-0">
          <div className="border-b border-hairline px-5 py-4">
            <h3 className="text-[15px] font-medium text-ink">Zielgruppe wählen</h3>
            <p className="mt-0.5 text-[13px] text-ink-mute">
              Mehrere Gruppen verfügbar. Bitte eine Zielgruppe auswählen.
            </p>
          </div>
          <div className="flex flex-col py-1">
            {conversionDialog.candidates.map((c) => (
              <button
                key={c.documentGroupId}
                type="button"
                className="h-9 px-5 text-left text-[13px] transition-colors hover:bg-canvas-soft"
                onClick={async () => {
                  setConversionDialog((p) => ({ ...p, open: false }));
                  const res = await fetch(`/api/documents/${conversionDialog.recordId}/convert`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ targetGroupId: c.documentGroupId }),
                  });
                  if (res.ok) {
                    queryClient.invalidateQueries({ queryKey: ["data", "document"] });
                  }
                }}
              >
                <span className="mr-2 font-mono text-[12px] text-ink-secondary">
                  {c.documentType}
                  {String(c.groupNumber).padStart(2, "0")}
                </span>
                {c.name}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
