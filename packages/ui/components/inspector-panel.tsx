import React from "react";

import { cn } from "../lib/utils";

export interface InspectorField {
  label: string;
  value: React.ReactNode;
}

export interface InspectorSection {
  title: string;
  fields: InspectorField[];
}

export interface InspectorPanelProps {
  title: string;
  recordId?: string;
  fields?: InspectorField[];
  sections?: InspectorSection[];
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

export function InspectorPanel({
  title,
  recordId,
  fields,
  sections,
  actions,
  className,
  children,
}: InspectorPanelProps) {
  const allSections: InspectorSection[] = sections ?? (fields ? [{ title: "", fields }] : []);

  return (
    <div className={cn("flex h-full w-full flex-col bg-canvas", className)}>
      {/* Header — 40px */}
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-hairline bg-canvas-soft px-4">
        <span className="text-[13px] font-medium text-ink">{title}</span>
        {recordId && <span className="font-mono text-[10px] text-ink-mute">{recordId}</span>}
        {actions && <div className="ml-auto flex items-center gap-1">{actions}</div>}
      </div>
      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        {allSections.map((section, si) => (
          <div key={si}>
            {section.title && (
              <div className="mt-4 mb-2 text-[10px] tracking-wider text-ink-mute uppercase first:mt-0">
                {section.title}
              </div>
            )}
            <div className="mb-2 grid grid-cols-2 gap-x-4 gap-y-3">
              {section.fields.map((field, fi) => (
                <div key={fi} className="flex flex-col gap-0.5">
                  <span className="text-[11px] tracking-wider text-ink-mute uppercase">
                    {field.label}
                  </span>
                  <span className="text-[13px] text-ink">{field.value}</span>
                </div>
              ))}
            </div>
            {si < allSections.length - 1 && <div className="my-3 h-px bg-hairline" />}
          </div>
        ))}
        {children}
      </div>
    </div>
  );
}
