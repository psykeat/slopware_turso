import React from "react";
import { useLocation } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useFocus } from "../platform/focus-manager";
import { cn } from "../lib/utils";

export interface StatusBarProps {
  tenantName: string;
  className?: string;
  isOnline?: boolean;
}

export function StatusBar({ tenantName, className, isOnline = true }: StatusBarProps) {
  const location = useLocation();
  const { state: focusState } = useFocus();
  const { t } = useTranslation("ui");

  const moduleSlug = location.pathname.split("/app/")[1]?.split("/")[0] ?? "";
  const displayModule = moduleSlug
    ? t(`modules.${moduleSlug}`, {
        defaultValue:
          moduleSlug.charAt(0).toUpperCase() + moduleSlug.slice(1),
      })
    : "";

  return (
    <footer
      className={cn(
        "h-8 border-t border-hairline bg-canvas-soft flex items-center justify-between px-4 text-[11px] text-ink-mute shrink-0",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <span>{tenantName}</span>
        {displayModule && (
          <>
            <span>·</span>
            <span>{displayModule}</span>
          </>
        )}
        {focusState.recordId && (
          <>
            <span>·</span>
            <span className="font-mono">{focusState.recordId}</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span>v0.1.0</span>
        <span>·</span>
        <span
          className="size-1.5 rounded-full inline-block"
          style={{ background: isOnline ? "var(--ok)" : "var(--destructive)" }}
        />
        <span>{t(isOnline ? "status.online" : "status.offline")}</span>
      </div>
    </footer>
  );
}
