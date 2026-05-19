import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { formatDate } from "../lib/formatters";
import { Skeleton } from "./skeleton";

interface StockLedgerRow {
  inventory_movement_id: string;
  movement_type: string;
  qty_delta: string | null;
  movement_date: string;
  created_at: string;
  warehouse_id: string;
  reference_text: string | null;
  document_no: string | null;
  warehouse_name: string | null;
  running_balance: string | null;
}

interface ArticleStatsResponse {
  revenueByPeriod: unknown[];
  stockLedger: StockLedgerRow[];
}

const colHeaderClass =
  "text-[11px] uppercase tracking-wider font-medium text-ink-mute text-right select-none px-3 py-0";
const colHeaderClassLeft =
  "text-[11px] uppercase tracking-wider font-medium text-ink-mute text-left select-none px-3 py-0";
const rowClass = "h-10 border-b border-hairline last:border-b-0";
const cellClass = "px-3 tabular-nums font-mono text-[13px] text-right";
const cellClassLeft = "px-3 text-[13px] text-left";

export function StockLedgerTable({ articleId }: { articleId: string }) {
  const { data, isLoading } = useQuery<ArticleStatsResponse>({
    queryKey: ["stats", "article", articleId],
    queryFn: async () => {
      const res = await fetch(`/api/stats/article/${encodeURIComponent(articleId)}`);
      if (!res.ok) throw new Error("Failed to fetch article stats");
      return res.json();
    },
    enabled: !!articleId,
    placeholderData: keepPreviousData,
  });

  const rows = data?.stockLedger ?? [];

  if (isLoading) {
    return (
      <table className="w-full table-fixed border-collapse" role="table">
        <thead>
          <tr className="h-8 border-b border-hairline">
            <th className={colHeaderClassLeft} style={{ width: "12%" }}>
              Datum
            </th>
            <th className={colHeaderClassLeft} style={{ width: "14%" }}>
              Beleg-Nr
            </th>
            <th className={colHeaderClassLeft} style={{ width: "20%" }}>
              Lagerort
            </th>
            <th className={colHeaderClass} style={{ width: "14%" }}>
              Zugang
            </th>
            <th className={colHeaderClass} style={{ width: "14%" }}>
              Abgang
            </th>
            <th className={colHeaderClass} style={{ width: "14%" }}>
              Lagerstand
            </th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 8 }).map((_, i) => (
            <tr key={i} className={rowClass}>
              <td className={cellClassLeft}>
                <Skeleton className="h-3 w-16" />
              </td>
              <td className={cellClassLeft}>
                <Skeleton className="h-3 w-20 font-mono" />
              </td>
              <td className={cellClassLeft}>
                <Skeleton className="h-3 w-24" />
              </td>
              <td className={cellClass}>
                <Skeleton className="ml-auto h-3 w-10" />
              </td>
              <td className={cellClass}>
                <Skeleton className="ml-auto h-3 w-10" />
              </td>
              <td className={cellClass}>
                <Skeleton className="ml-auto h-3 w-12" />
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

  return (
    <table className="w-full table-fixed border-collapse" role="table">
      <thead>
        <tr className="h-8 border-b border-hairline">
          <th className={colHeaderClassLeft} style={{ width: "12%" }}>
            Datum
          </th>
          <th className={colHeaderClassLeft} style={{ width: "14%" }}>
            Beleg-Nr
          </th>
          <th className={colHeaderClassLeft} style={{ width: "22%" }}>
            Lagerort
          </th>
          <th className={colHeaderClass} style={{ width: "14%" }}>
            Zugang
          </th>
          <th className={colHeaderClass} style={{ width: "14%" }}>
            Abgang
          </th>
          <th className={colHeaderClass} style={{ width: "14%" }}>
            Lagerstand
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const qty = Number(row.qty_delta ?? 0);
          const balance = Number(row.running_balance ?? 0);
          const docNo = row.document_no ?? "";
          const truncatedDocNo = docNo.length > 8 ? `${docNo.slice(0, 8)}…` : docNo;

          return (
            <tr key={row.inventory_movement_id} className={rowClass}>
              <td className={cellClassLeft}>
                <span className="font-mono text-[12px] tabular-nums">
                  {formatDate(row.created_at)}
                </span>
              </td>
              <td className={cellClassLeft}>
                <span className="font-mono text-[12px]" title={docNo}>
                  {truncatedDocNo || <span className="text-ink-mute">—</span>}
                </span>
              </td>
              <td className={cellClassLeft}>
                <span className="text-[13px]">
                  {row.warehouse_name ?? (
                    <span className="font-mono text-[12px] text-ink-mute">{row.warehouse_id}</span>
                  )}
                </span>
              </td>
              <td className={cellClass}>
                {qty > 0 ? <span style={{ color: "var(--ok)" }}>{qty.toFixed(3)}</span> : null}
              </td>
              <td className={cellClass}>
                {qty < 0 ? (
                  <span className="text-amber-600">{Math.abs(qty).toFixed(3)}</span>
                ) : null}
              </td>
              <td className={`${cellClass} font-semibold`}>{balance.toFixed(3)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
