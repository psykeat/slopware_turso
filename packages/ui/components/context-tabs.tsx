import React, { useState } from "react";
import { MoreHorizontalIcon } from "lucide-react";
import { cn } from "../lib/utils";

export interface TabDef {
  id: string;
  label: string;
  content: React.ReactNode;
  count?: number;
}

export interface ContextTabsProps {
  tabs: TabDef[];
  defaultValue?: string;
  className?: string;
}

export function ContextTabs({ tabs, defaultValue, className }: ContextTabsProps) {
  const [active, setActive] = useState(defaultValue || tabs[0]?.id);

  if (!tabs?.length) return null;

  const activeTab = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div className={cn("flex flex-col h-full w-full", className)}>
      {/* Tab bar — 32px */}
      <div
        className="h-8 flex items-center bg-canvas-soft border-b border-hairline shrink-0 overflow-x-auto"
        style={{ scrollbarWidth: "none" }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={cn(
              "h-8 px-3 text-[13px] select-none border-b-2 whitespace-nowrap flex items-center gap-1 transition-colors shrink-0",
              active === tab.id
                ? "text-ink border-primary"
                : "text-ink-mute border-transparent hover:text-ink",
            )}
          >
            {tab.label}
            {tab.count != null && (
              <span className="text-[11px] text-ink-mute">({tab.count})</span>
            )}
          </button>
        ))}
        {/* More actions button */}
        <div className="ml-auto flex items-center pr-1 shrink-0">
          <button className="size-7 grid place-items-center rounded-sm text-ink-mute hover:bg-canvas hover:text-ink transition-colors">
            <MoreHorizontalIcon className="size-3.5" />
          </button>
        </div>
      </div>
      {/* Content */}
      <div className="flex-1 overflow-hidden min-h-0">
        {activeTab?.content}
      </div>
    </div>
  );
}
