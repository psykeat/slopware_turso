import { useQuery } from "@tanstack/react-query";
import React from "react";

import { entityList } from "../lib/entity-capabilities";
import { Skeleton } from "./skeleton";

interface InventoryBalance {
  warehouseId: string;
  onHandQty: number;
  reservedQty: number;
  availableQty: number;
  expectedPurchaseQty: number;
}

function formatQty(n: number) {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 3 }).format(n);
}

export function InventoryBalanceTable({ articleId }: { articleId: string }) {
  const { data: rows = [], isLoading } = useQuery<InventoryBalance[]>({
    queryKey: ["data", "inventoryBalance", articleId],
    queryFn: () => entityList<InventoryBalance>("inventoryBalance", { articleId }),
    enabled: !!articleId,
  });

  const colHeaderClass =
    "text-[11px] uppercase tracking-wider font-medium text-ink-mute text-right select-none px-3 py-0";
  const colHeaderClassLeft =
    "text-[11px] uppercase tracking-wider font-medium text-ink-mute text-left select-none px-3 py-0";
  const rowClass = "h-10 border-b border-hairline last:border-b-0";
  const cellClass = "px-3 tabular-nums font-mono text-[13px] text-right";
  const cellClassLeft = "px-3 text-[13px] font-mono text-left";

  if (isLoading) {
    return (
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr className="h-8 border-b border-hairline">
            <th className={colHeaderClassLeft} style={{ width: "30%" }}>
              Lager
            </th>
            <th className={colHeaderClass} style={{ width: "14%" }}>
              Bestand
            </th>
            <th className={colHeaderClass} style={{ width: "14%" }}>
              Reserviert
            </th>
            <th className={colHeaderClass} style={{ width: "14%" }}>
              Verfügbar
            </th>
            <th className={colHeaderClass} style={{ width: "14%" }}>
              Erwartet
            </th>
          </tr>
        </thead>
        <tbody>
          {[0, 1, 2].map((i) => (
            <tr key={i} className={rowClass}>
              <td className={cellClassLeft}>
                <Skeleton className="h-3 w-24" />
              </td>
              <td className={cellClass}>
                <Skeleton className="ml-auto h-3 w-12" />
              </td>
              <td className={cellClass}>
                <Skeleton className="ml-auto h-3 w-10" />
              </td>
              <td className={cellClass}>
                <Skeleton className="ml-auto h-3 w-12" />
              </td>
              <td className={cellClass}>
                <Skeleton className="ml-auto h-3 w-10" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-[13px] text-ink-mute">
        Keine Lagerbewegungen
      </div>
    );
  }

  const totalOnHand = rows.reduce((s, r) => s + (r.onHandQty ?? 0), 0);
  const totalReserved = rows.reduce((s, r) => s + (r.reservedQty ?? 0), 0);
  const totalAvailable = rows.reduce((s, r) => s + (r.availableQty ?? 0), 0);
  const totalExpected = rows.reduce((s, r) => s + (r.expectedPurchaseQty ?? 0), 0);
  const showTotal = rows.length > 1;

  return (
    <table className="w-full table-fixed border-collapse">
      <thead>
        <tr className="h-8 border-b border-hairline">
          <th className={colHeaderClassLeft} style={{ width: "30%" }}>
            Lager
          </th>
          <th className={colHeaderClass} style={{ width: "14%" }}>
            Bestand
          </th>
          <th className={colHeaderClass} style={{ width: "14%" }}>
            Reserviert
          </th>
          <th className={colHeaderClass} style={{ width: "14%" }}>
            Verfügbar
          </th>
          <th className={colHeaderClass} style={{ width: "14%" }}>
            Erwartet
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const avail = row.availableQty ?? 0;
          const reserved = row.reservedQty ?? 0;
          const availColor = avail > 0 ? "var(--ok)" : avail < 0 ? "var(--destructive)" : undefined;
          const reservedColor = reserved > 0 ? "var(--warn)" : undefined;
          return (
            <tr key={row.warehouseId} className={rowClass}>
              <td className={cellClassLeft}>{row.warehouseId}</td>
              <td className={cellClass}>{formatQty(row.onHandQty ?? 0)}</td>
              <td
                className={cellClass}
                style={reservedColor ? { color: reservedColor } : undefined}
              >
                {formatQty(reserved)}
              </td>
              <td className={cellClass} style={availColor ? { color: availColor } : undefined}>
                {formatQty(avail)}
              </td>
              <td className={cellClass}>{formatQty(row.expectedPurchaseQty ?? 0)}</td>
            </tr>
          );
        })}

        {showTotal && (
          <tr className="h-10 border-t border-hairline font-bold">
            <td className={`${cellClassLeft} font-bold`}>Gesamt</td>
            <td className={`${cellClass} font-bold`}>{formatQty(totalOnHand)}</td>
            <td
              className={`${cellClass} font-bold`}
              style={totalReserved > 0 ? { color: "var(--warn)" } : undefined}
            >
              {formatQty(totalReserved)}
            </td>
            <td
              className={`${cellClass} font-bold`}
              style={
                totalAvailable > 0
                  ? { color: "var(--ok)" }
                  : totalAvailable < 0
                    ? { color: "var(--destructive)" }
                    : undefined
              }
            >
              {formatQty(totalAvailable)}
            </td>
            <td className={`${cellClass} font-bold`}>{formatQty(totalExpected)}</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
