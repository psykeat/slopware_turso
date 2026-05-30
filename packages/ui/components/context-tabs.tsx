import { MoreHorizontalIcon } from "lucide-react";
import React, { useState } from "react";

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
    <div className={cn("flex h-full w-full flex-col", className)}>
      {/* Tab bar — 36px */}
      <div
        className="flex h-9 shrink-0 items-center overflow-x-auto border-b border-hairline bg-canvas-soft"
        style={{ scrollbarWidth: "none" }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={cn(
              "flex h-9 shrink-0 items-center gap-1 border-b-2 px-3 text-[13px] whitespace-nowrap transition-colors select-none",
              active === tab.id
                ? "border-primary text-ink"
                : "border-transparent text-ink-mute hover:text-ink",
            )}
          >
            {tab.label}
            {tab.count != null && <span className="text-[11px] text-ink-mute">({tab.count})</span>}
          </button>
        ))}
        {/* More actions button */}
        <div className="ml-auto flex shrink-0 items-center pr-1">
          <button className="grid size-8 place-items-center rounded-sm text-ink-mute transition-colors hover:bg-canvas hover:text-ink">
            <MoreHorizontalIcon className="size-3.5" />
          </button>
        </div>
      </div>
      {/* Content */}
      <div className="min-h-0 flex-1 overflow-hidden">{activeTab?.content}</div>
    </div>
  );
}
