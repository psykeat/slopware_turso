import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "./skeleton";
import { formatMoney, formatDate, StatusDot } from "../lib/formatters";

interface Document {
  documentId: string;
  documentDate: string;
  documentNo: string;
  documentType: string;
  status: string;
  totalGross: number;
}

interface AnnualRevenue {
  year: number;
  total: number;
}

export function CustomerStatsSection({ addressId }: { addressId: string }) {
  const { data: documents = [], isLoading } = useQuery<Document[]>({
    queryKey: ["data", "document", "customer", addressId],
    queryFn: async () => {
      const res = await fetch(
        `/api/data/document?customerId=${encodeURIComponent(addressId)}&limit=10&orderBy=document_date:desc`
      );
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json();
    },
    enabled: !!addressId,
  });

  const colHeaderClass = "text-[11px] uppercase tracking-wider font-medium text-ink-mute text-left select-none px-3 py-0";
  const colHeaderClassRight = "text-[11px] uppercase tracking-wider font-medium text-ink-mute text-right select-none px-3 py-0";
  const rowClass = "h-10 border-b border-hairline last:border-b-0 hover:bg-canvas transition-colors";
  const cellClass = "px-3 text-[13px]";
  const cellClassRight = "px-3 text-[13px] text-right tabular-nums";

  if (isLoading) {
    return (
      <div>
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr className="h-8 border-b border-hairline">
              <th className={colHeaderClass} style={{ width: "14%" }}>Datum</th>
              <th className={colHeaderClass} style={{ width: "22%" }}>Belegnummer</th>
              <th className={colHeaderClass} style={{ width: "8%" }}>Typ</th>
              <th className={colHeaderClass} style={{ width: "16%" }}>Status</th>
              <th className={colHeaderClassRight} style={{ width: "20%" }}>Brutto</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 10 }, (_, i) => (
              <tr key={i} className={rowClass}>
                <td className={cellClass}><Skeleton className="h-3 w-16" /></td>
                <td className={cellClass}><Skeleton className="h-3 w-20" /></td>
                <td className={cellClass}><Skeleton className="h-3 w-4" /></td>
                <td className={cellClass}><Skeleton className="h-3 w-14" /></td>
                <td className={cellClassRight}><Skeleton className="h-3 w-16 ml-auto" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-[13px] text-ink-mute">
        Keine Belege vorhanden
      </div>
    );
  }

  // Derive annual revenue from posted documents
  const annualMap = new Map<number, number>();
  for (const doc of documents) {
    if (doc.status === "posted" && doc.documentDate) {
      const year = new Date(doc.documentDate).getFullYear();
      annualMap.set(year, (annualMap.get(year) ?? 0) + (doc.totalGross ?? 0));
    }
  }
  const annualRevenue: AnnualRevenue[] = Array.from(annualMap.entries())
    .map(([year, total]) => ({ year, total }))
    .sort((a, b) => b.year - a.year);

  return (
    <div className="flex flex-col gap-4">
      {/* Recent documents table */}
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr className="h-8 border-b border-hairline">
            <th className={colHeaderClass} style={{ width: "14%" }}>Datum</th>
            <th className={colHeaderClass} style={{ width: "22%" }}>Belegnummer</th>
            <th className={colHeaderClass} style={{ width: "8%" }}>Typ</th>
            <th className={colHeaderClass} style={{ width: "16%" }}>Status</th>
            <th className={colHeaderClassRight} style={{ width: "20%" }}>Brutto</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr key={doc.documentId} className={rowClass}>
              <td className={`${cellClass} tabular-nums`}>
                {formatDate(doc.documentDate)}
              </td>
              <td className={`${cellClass} font-mono`}>
                {doc.documentNo}
              </td>
              <td className={`${cellClass} font-mono`}>
                {doc.documentType}
              </td>
              <td className={cellClass}>
                <StatusDot status={doc.status ?? "draft"} />
              </td>
              <td className={cellClassRight}>
                {formatMoney(doc.totalGross ?? 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Annual revenue section */}
      {annualRevenue.length > 0 && (
        <div>
          <div className="h-8 flex items-center px-3 border-b border-hairline text-[11px] uppercase tracking-wider font-medium text-ink-mute">
            Jahresumsatz
          </div>
          <table className="w-full table-fixed border-collapse">
            <thead>
              <tr className="h-8 border-b border-hairline">
                <th className={colHeaderClass} style={{ width: "30%" }}>Jahr</th>
                <th className={colHeaderClassRight} style={{ width: "40%" }}>Umsatz</th>
              </tr>
            </thead>
            <tbody>
              {annualRevenue.map(({ year, total }) => (
                <tr key={year} className={rowClass}>
                  <td className={`${cellClass} tabular-nums font-mono`}>{year}</td>
                  <td className={cellClassRight}>{formatMoney(total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
