import { useQuery } from "@tanstack/react-query";
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { formatMoney } from "../lib/formatters";
import { useFocus } from "../platform/focus-manager";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "./drawer";
import { Skeleton } from "./skeleton";

interface DashboardKpi {
  revenue: { current: number; prior: number };
  profit: { current: number };
  cogs: { current: number };
  openOrders: { count: number; value: number };
  inventoryValue: number;
  draftCount: number;
}

function KpiCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: string | number;
  delta?: { text: string; positive: boolean } | string;
}) {
  return (
    <div className="border-b border-hairline p-4 last:border-0">
      <div className="mb-1 text-[11px] tracking-wider text-ink-mute uppercase">{label}</div>
      <div className="text-[26px] font-light text-ink tabular-nums">{value}</div>
      {delta && typeof delta === "string" && (
        <div className="mt-0.5 text-[11px] text-ink-mute">{delta}</div>
      )}
      {delta && typeof delta === "object" && (
        <div
          className="mt-0.5 text-[11px] font-medium"
          style={{ color: delta.positive ? "var(--ok)" : "var(--destructive)" }}
        >
          {delta.positive ? "▲" : "▼"} {delta.text}
        </div>
      )}
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="border-b border-hairline p-4 last:border-0">
      <Skeleton className="mb-2 h-3 w-24" />
      <Skeleton className="h-8 w-32" />
    </div>
  );
}

export function StatisticsModule() {
  const [open, setOpen] = useState(false);
  const { state: focusState } = useFocus();
  const { t } = useTranslation("ui");

  useEffect(() => {
    const handler = () => setOpen((prev) => !prev);
    window.addEventListener("slopware:open-statistics", handler);
    return () => window.removeEventListener("slopware:open-statistics", handler);
  }, []);

  const { data: kpiData, isLoading } = useQuery<DashboardKpi>({
    queryKey: ["stats", "dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/stats/dashboard");
      if (!res.ok) throw new Error("Stats fetch failed");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    enabled: open,
  });

  const currentYear = new Date().getFullYear();

  let kpiContent: React.ReactNode;

  if (isLoading) {
    kpiContent = (
      <>
        <KpiSkeleton />
        <KpiSkeleton />
        <KpiSkeleton />
        <KpiSkeleton />
        <KpiSkeleton />
      </>
    );
  } else {
    const revenue = kpiData?.revenue.current ?? 0;
    const prior = kpiData?.revenue.prior ?? 0;
    const yoyDiff = prior > 0 ? ((revenue - prior) / prior) * 100 : null;

    const revenueDelta =
      yoyDiff !== null
        ? {
            text: `${Math.abs(yoyDiff).toFixed(1)}% vs. ${currentYear - 1}`,
            positive: yoyDiff >= 0,
          }
        : undefined;

    kpiContent = (
      <>
        <KpiCard label={t("stats.revenue")} value={formatMoney(revenue)} delta={revenueDelta} />
        <KpiCard label={t("stats.profit")} value={formatMoney(kpiData?.profit.current ?? 0)} />
        <KpiCard
          label={t("stats.openOrders")}
          value={`${kpiData?.openOrders.count ?? 0} (${formatMoney(kpiData?.openOrders.value ?? 0)})`}
        />
        <KpiCard label={t("stats.draftCount")} value={kpiData?.draftCount ?? 0} />
        <KpiCard
          label={t("stats.inventoryValue")}
          value={formatMoney(kpiData?.inventoryValue ?? 0)}
        />
      </>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen} direction="right">
      <DrawerContent className="border-l border-hairline bg-canvas shadow-2xl">
        <DrawerHeader>
          <DrawerTitle className="text-xl font-semibold text-ink">
            Statistics: {focusState.entity || "Context"}
          </DrawerTitle>
          <DrawerDescription className="text-ink-mute">
            Record ID: {focusState.recordId || "None selected"}
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex-1 overflow-auto">{kpiContent}</div>
      </DrawerContent>
    </Drawer>
  );
}
