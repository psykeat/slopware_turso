import React from "react";

import { cn } from "../lib/utils";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./resizable";

export interface TriViewWorkspaceProps {
  navigationTree: React.ReactNode;
  primaryGrid: React.ReactNode;
  dependentContext: React.ReactNode;
  className?: string;
  defaultLayout?: [string, string]; // [left, right] e.g. ["20%", "80%"]
  defaultRightLayout?: [string, string]; // [top, bottom] e.g. ["60%", "40%"]
}

export function TriViewWorkspace({
  navigationTree,
  primaryGrid,
  dependentContext,
  className,
  defaultLayout = ["20%", "80%"],
  defaultRightLayout = ["60%", "40%"],
}: TriViewWorkspaceProps) {
  const hasDependentContext = dependentContext != null;

  return (
    <div className={cn("flex h-full w-full bg-canvas", className)}>
      <ResizablePanelGroup orientation="horizontal" className="h-full w-full">
        <ResizablePanel
          defaultSize={defaultLayout[0]}
          minSize="200px"
          maxSize="50%"
          className="bg-canvas-soft"
        >
          <div className="h-full w-full overflow-auto">{navigationTree}</div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={defaultLayout[1]}>
          {hasDependentContext ? (
            <ResizablePanelGroup orientation="vertical">
              <ResizablePanel defaultSize={defaultRightLayout[0]} minSize="25%">
                <div className="h-full w-full overflow-hidden">{primaryGrid}</div>
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={defaultRightLayout[1]} minSize="20%">
                <div className="h-full w-full overflow-hidden">{dependentContext}</div>
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : (
            <div className="h-full w-full overflow-hidden">{primaryGrid}</div>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
