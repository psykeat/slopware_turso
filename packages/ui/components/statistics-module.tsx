import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useFocus } from "../platform/focus-manager";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "./drawer";
import { Skeleton } from "./skeleton";
import { formatMoney } from "../lib/formatters";

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
    <div className="p-4 border-b border-hairline last:border-0">
      <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">{label}</div>
      <div className="text-[26px] font-light tabular-nums text-ink">{value}</div>
      {delta && typeof delta === "string" && (
        <div className="text-[11px] text-ink-mute mt-0.5">{delta}</div>
      )}
      {delta && typeof delta === "object" && (
        <div
          className="text-[11px] mt-0.5 font-medium"
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
    <div className="p-4 border-b border-hairline last:border-0">
      <Skeleton className="h-3 w-24 mb-2" />
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
        <KpiCard
          label={t("stats.revenue")}
          value={formatMoney(revenue)}
          delta={revenueDelta}
        />
        <KpiCard
          label={t("stats.profit")}
          value={formatMoney(kpiData?.profit.current ?? 0)}
        />
        <KpiCard
          label={t("stats.openOrders")}
          value={`${kpiData?.openOrders.count ?? 0} (${formatMoney(kpiData?.openOrders.value ?? 0)})`}
        />
        <KpiCard
          label={t("stats.draftCount")}
          value={kpiData?.draftCount ?? 0}
        />
        <KpiCard
          label={t("stats.inventoryValue")}
          value={formatMoney(kpiData?.inventoryValue ?? 0)}
        />
      </>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen} direction="right">
      <DrawerContent className="bg-canvas shadow-2xl border-l border-hairline">
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
