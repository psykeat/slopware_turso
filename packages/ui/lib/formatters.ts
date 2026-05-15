import React from "react";

export const formatMoney = (value: number | string, currency = "EUR") =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(Number(value));

export const formatDate = (value: string) =>
  value ? new Intl.DateTimeFormat("de-DE").format(new Date(value)) : "—";

const STATUS_COLORS: Record<string, string> = {
  posted: "var(--ok)",
  draft: "var(--warn)",
  open: "var(--primary)",
  default: "var(--ink-mute)",
};

export function StatusDot({ status }: { status: string }) {
  return React.createElement(
    "span",
    { className: "flex items-center gap-1.5 text-ink-mute text-[12px]" },
    React.createElement("span", {
      className: "size-1.5 rounded-full inline-block flex-none",
      style: { background: STATUS_COLORS[status] ?? STATUS_COLORS.default },
    }),
    status,
  );
}
