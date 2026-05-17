import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "./skeleton";

interface BatchBalance {
  batchNo: string;
  warehouseId: string;
  balance: string;
}

export function BatchInventoryTable({ articleId }: { articleId: string }) {
  const { data: rows = [], isLoading } = useQuery<BatchBalance[]>({
    queryKey: ["article-batches", articleId],
    queryFn: async () => {
      const res = await fetch(`/api/articles/${articleId}/batches`);
      if (!res.ok) throw new Error("Failed to fetch batches");
      return res.json();
    },
    enabled: !!articleId,
  });

  const colHeaderClass = "text-[11px] uppercase tracking-wider font-medium text-ink-mute text-left px-3 py-0";
  const rowClass = "h-9 border-b border-hairline last:border-b-0";
  const cellClass = "px-3 text-[13px] font-mono";

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-3">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-[13px] text-ink-mute italic">
        Keine Chargenbestände erfasst.
      </div>
    );
  }

  return (
    <table className="w-full table-fixed border-collapse">
      <thead>
        <tr className="h-8 border-b border-hairline">
          <th className={colHeaderClass} style={{ width: "50%" }}>Charge</th>
          <th className={colHeaderClass} style={{ width: "25%" }}>Lager</th>
          <th className={colHeaderClass + " text-right"} style={{ width: "25%" }}>Bestand</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className={rowClass}>
            <td className={cellClass}>{row.batchNo}</td>
            <td className="px-3 text-[13px]">{row.warehouseId}</td>
            <td className="px-3 text-[13px] tabular-nums font-mono text-right">{Number(row.balance).toLocaleString("de-DE", { maximumFractionDigits: 3 })}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
