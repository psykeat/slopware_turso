import React from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "./resizable";
import { cn } from "../lib/utils";

export interface TriViewWorkspaceProps {
  navigationTree: React.ReactNode;
  primaryGrid: React.ReactNode;
  dependentContext: React.ReactNode;
  className?: string;
  defaultLayout?: [number, number]; // [left, right] e.g. [20, 80]
  defaultRightLayout?: [number, number]; // [top, bottom] e.g. [60, 40]
}

export function TriViewWorkspace({
  navigationTree,
  primaryGrid,
  dependentContext,
  className,
  defaultLayout = [20, 80],
  defaultRightLayout = [60, 40],
}: TriViewWorkspaceProps) {
  return (
    <div className={cn("h-full w-full flex bg-canvas", className)}>
      {/* @ts-ignore - direction prop type mismatch between Shadcn and react-resizable-panels */}
      <ResizablePanelGroup direction={"horizontal" as any} className="h-full w-full">
        <ResizablePanel defaultSize={defaultLayout[0]} minSize={15} maxSize={40} className="bg-canvas-soft">
          <div className="h-full w-full overflow-auto">
            {navigationTree}
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={defaultLayout[1]}>
          {/* @ts-ignore - direction prop type mismatch between Shadcn and react-resizable-panels */}
          <ResizablePanelGroup direction={"vertical" as any}>
            <ResizablePanel defaultSize={defaultRightLayout[0]} minSize={30}>
              <div className="h-full w-full overflow-hidden">
                {primaryGrid}
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={defaultRightLayout[1]} minSize={20}>
              <div className="h-full w-full overflow-hidden">
                {dependentContext}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
