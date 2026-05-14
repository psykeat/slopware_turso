import React, { useState, useEffect } from "react";
import { useFocus } from "../platform/focus-manager";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "./drawer";

export function StatisticsModule() {
  const [open, setOpen] = useState(false);
  const { state: focusState } = useFocus();

  useEffect(() => {
    const handler = () => setOpen((prev) => !prev);
    window.addEventListener("slopware:open-statistics", handler);
    return () => window.removeEventListener("slopware:open-statistics", handler);
  }, []);

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
        <div className="flex-1 p-6 space-y-8 overflow-auto">
          <div className="grid grid-cols-1 gap-6">
            <div className="p-4 rounded-lg bg-canvas-soft border border-hairline flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wider font-medium text-ink-mute">
                Total Volume (YTD)
              </span>
              <span className="text-2xl font-light text-ink tabular-nums">
                $42,850.00
              </span>
            </div>
            <div className="p-4 rounded-lg bg-canvas-soft border border-hairline flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wider font-medium text-ink-mute">
                Last Transaction
              </span>
              <span className="text-sm text-ink font-light">
                {new Date().toLocaleDateString()}
              </span>
            </div>
            <div className="p-4 rounded-lg bg-canvas-soft border border-hairline flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wider font-medium text-ink-mute">
                Health Score
              </span>
              <div className="h-2 w-full bg-hairline rounded-full overflow-hidden mt-2">
                <div className="h-full bg-primary w-[85%]" />
              </div>
              <span className="text-[11px] text-right text-ink-mute mt-1">85/100</span>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
