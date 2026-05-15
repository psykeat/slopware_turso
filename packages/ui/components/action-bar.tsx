import React from "react";
import { ChevronRightIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFocus } from "../platform/focus-manager";
import { useCommands } from "../platform/command-registry";
import { cn } from "../lib/utils";

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
        "h-9 flex items-center gap-2 px-3 bg-canvas-soft border-b border-hairline shrink-0 overflow-x-auto",
        className,
      )}
      style={{ scrollbarWidth: "none" }}
    >
      {/* Breadcrumbs */}
      {allCrumbs.length > 0 && (
        <div className="flex items-center gap-1.5 text-[13px] shrink-0">
          {allCrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && (
                <ChevronRightIcon className="size-3 text-hairline-input shrink-0" />
              )}
              <span
                className={
                  i === allCrumbs.length - 1 ? "text-ink" : "text-ink-mute"
                }
              >
                {crumb}
              </span>
            </span>
          ))}
        </div>
      )}

      <div className="flex-1 min-w-0" />

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
          className="h-6 px-3 rounded-full text-[13px] border border-hairline bg-canvas text-ink-secondary hover:border-primary hover:text-primary transition-colors flex-shrink-0 flex items-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none"
        >
          {i18n.language === "de" ? cmd.label.de : cmd.label.en}
          {cmd.shortcut && (
            <span className="font-mono text-[10px] text-ink-mute border border-hairline rounded-[3px] px-1 bg-canvas-soft">
              {cmd.shortcut}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
