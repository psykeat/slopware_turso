import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CheckIcon, XIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_auth/app/settings/cycles")({
  component: CyclesPage,
});

interface DevCycle {
  cycleId: string;
  cycleNumber: number;
  recordedAt: string;
  sliceFitScore: number;
  sliceFitMax: number;
  storyCoverage: number;
  storyCoverageMax: number;
  testsAdded: number;
  vpTestPass: boolean | null;
  blocker: string | null;
  processAdjustment: string | null;
  createdAt: string;
}

function ProgressBar({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  const color = pct === 100 ? "bg-green-500" : pct >= 60 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-canvas-soft">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right text-[11px] text-ink-secondary tabular-nums">{pct}%</span>
    </div>
  );
}

function CyclesView() {
  const { t } = useTranslation("ui");
  const context = Route.useRouteContext();
  const user = context.user as any;
  const isAdmin = (user?.isSystemAdmin ?? false) as boolean;

  const { data: cycles = [], isLoading } = useQuery<DevCycle[]>({
    queryKey: ["admin", "cycles"],
    queryFn: async () => {
      const res = await fetch("/api/admin/cycles");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-ink-mute">
        Access denied
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-canvas">
      {/* Header */}
      <div className="shrink-0 border-b border-hairline px-4 py-3">
        <h1 className="text-[15px] font-semibold text-ink">{t("devCycles.title")}</h1>
        <p className="mt-1 font-mono text-[11px] text-ink-mute">{t("devCycles.apiHelp")}</p>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center text-[13px] text-ink-mute">
            Loading...
          </div>
        ) : cycles.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-[13px] text-ink-mute">
            {t("devCycles.noData")}
          </div>
        ) : (
          <table className="w-full text-[13px] text-ink">
            <thead>
              <tr className="border-b border-hairline bg-canvas-soft">
                <th className="px-3 py-2 text-left text-[11px] font-medium tracking-wider text-ink-mute uppercase">
                  {t("devCycles.cycleNumber")}
                </th>
                <th className="px-3 py-2 text-left text-[11px] font-medium tracking-wider text-ink-mute uppercase">
                  Recorded
                </th>
                <th className="w-40 px-3 py-2 text-left text-[11px] font-medium tracking-wider text-ink-mute uppercase">
                  {t("devCycles.sliceFit")}
                </th>
                <th className="w-40 px-3 py-2 text-left text-[11px] font-medium tracking-wider text-ink-mute uppercase">
                  {t("devCycles.storyCoverage")}
                </th>
                <th className="px-3 py-2 text-left text-[11px] font-medium tracking-wider text-ink-mute uppercase">
                  {t("devCycles.testsAdded")}
                </th>
                <th className="px-3 py-2 text-left text-[11px] font-medium tracking-wider text-ink-mute uppercase">
                  {t("devCycles.vpTestPass")}
                </th>
                <th className="px-3 py-2 text-left text-[11px] font-medium tracking-wider text-ink-mute uppercase">
                  {t("devCycles.blocker")}
                </th>
              </tr>
            </thead>
            <tbody>
              {cycles.map((cycle, idx) => (
                <tr
                  key={cycle.cycleId}
                  className={`border-b border-hairline ${idx % 2 === 0 ? "bg-canvas" : "bg-canvas-soft/40"} transition-colors hover:bg-canvas-soft`}
                >
                  <td className="px-3 py-2 font-medium tabular-nums">#{cycle.cycleNumber}</td>
                  <td className="px-3 py-2 text-[12px] text-ink-secondary tabular-nums">
                    {new Date(cycle.recordedAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                    })}
                  </td>
                  <td className="px-3 py-2">
                    <ProgressBar score={cycle.sliceFitScore} max={cycle.sliceFitMax} />
                  </td>
                  <td className="px-3 py-2">
                    <ProgressBar score={cycle.storyCoverage} max={cycle.storyCoverageMax} />
                  </td>
                  <td className="px-3 py-2 text-center tabular-nums">{cycle.testsAdded}</td>
                  <td className="px-3 py-2 text-center">
                    {cycle.vpTestPass === null ? (
                      <span className="text-ink-mute">—</span>
                    ) : cycle.vpTestPass ? (
                      <CheckIcon className="inline h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <XIcon className="inline h-3.5 w-3.5 text-red-500" />
                    )}
                  </td>
                  <td className="max-w-xs truncate px-3 py-2 text-[12px] text-ink-secondary">
                    {cycle.blocker ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function CyclesPage() {
  return <CyclesView />;
}
