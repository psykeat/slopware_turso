import { useQuery } from "@tanstack/react-query";
import React from "react";

import { formatDate } from "../lib/formatters";
import { Skeleton } from "./skeleton";

interface SerialNumber {
  serialNumberId: string;
  serialNo: string;
  status: "in_stock" | "reserved" | "sold";
  createdAt: string;
}

export function SerialInventoryTable({ articleId }: { articleId: string }) {
  const { data: rows = [], isLoading } = useQuery<SerialNumber[]>({
    queryKey: ["article-serials", articleId],
    queryFn: async () => {
      const res = await fetch(`/api/articles/${articleId}/serial-numbers?status=in_stock`);
      if (!res.ok) throw new Error("Failed to fetch serial numbers");
      return res.json();
    },
    enabled: !!articleId,
  });

  const colHeaderClass =
    "text-[11px] uppercase tracking-wider font-medium text-ink-mute text-left px-3 py-0";
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
      <div className="flex h-24 items-center justify-center text-[13px] text-ink-mute italic">
        Keine Seriennummern am Lager.
      </div>
    );
  }

  return (
    <table className="w-full table-fixed border-collapse">
      <thead>
        <tr className="h-8 border-b border-hairline">
          <th className={colHeaderClass} style={{ width: "50%" }}>
            Seriennummer
          </th>
          <th className={colHeaderClass} style={{ width: "25%" }}>
            Status
          </th>
          <th className={colHeaderClass} style={{ width: "25%" }}>
            Erfasst am
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.serialNumberId} className={rowClass}>
            <td className={cellClass}>{row.serialNo}</td>
            <td className="px-3 text-[12px] font-medium text-ink-mute uppercase">{row.status}</td>
            <td className="px-3 text-[12px] text-ink-mute">{formatDate(row.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
