import { ChevronRightIcon } from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/utils";
import { useCommands } from "../platform/command-registry";
import { useFocus } from "../platform/focus-manager";

export interface ActionBarProps {
  className?: string;
  scope?: "global" | "context" | "local";
  crumbs?: string[];
  subCrumb?: string;
}

export function ActionBar({ className, scope, crumbs, subCrumb }: ActionBarProps) {
  const { state: focusState } = useFocus();
  const { commands, executeCommand } = useCommands();
  const { t, i18n } = useTranslation("ui");

  // Compute full breadcrumb array
  const allCrumbs = [...(crumbs ?? []), ...(subCrumb ? [subCrumb] : [])];

  // Show context/local commands only (not global nav commands)
  const visibleCommands = commands.filter((c) => {
    if (c.scope === "global") return false;
    if (scope && c.scope !== scope) return false;
    return !c.isVisible || c.isVisible(focusState);
  });

  return (
    <div
      className={cn(
        "flex h-9 shrink-0 items-center gap-2 overflow-x-auto border-b border-hairline bg-canvas-soft px-3",
        className,
      )}
      style={{ scrollbarWidth: "none" }}
    >
      {/* Breadcrumbs */}
      {allCrumbs.length > 0 && (
        <div className="flex shrink-0 items-center gap-1.5 text-[13px]">
          {allCrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRightIcon className="size-3 shrink-0 text-hairline-input" />}
              <span className={i === allCrumbs.length - 1 ? "text-ink" : "text-ink-mute"}>
                {crumb}
              </span>
            </span>
          ))}
        </div>
      )}

      <div className="min-w-0 flex-1" />

      {/* Command pills */}
      {visibleCommands.map((cmd) => (
        <button
          key={cmd.id}
          disabled={!!(cmd.isEnabled && !cmd.isEnabled(focusState))}
          onClick={() => executeCommand(cmd.id)}
          aria-label={t("commands.execute", {
            defaultValue: cmd.label.en,
            command: cmd.label.en,
          })}
          className="flex h-6 flex-shrink-0 items-center gap-1.5 rounded-full border border-hairline bg-canvas px-3 text-[13px] text-ink-secondary transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-40"
        >
          {i18n.language === "de" ? cmd.label.de : cmd.label.en}
          {cmd.shortcut && (
            <span className="rounded-[3px] border border-hairline bg-canvas-soft px-1 font-mono text-[10px] text-ink-mute">
              {cmd.shortcut}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
