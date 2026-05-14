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
  const allSections: InspectorSection[] =
    sections ?? (fields ? [{ title: "", fields }] : []);

  return (
    <div className={cn("flex flex-col h-full w-full bg-canvas", className)}>
      {/* Header — 40px */}
      <div className="h-10 flex items-center gap-2 px-4 border-b border-hairline bg-canvas-soft shrink-0">
        <span className="text-[13px] font-medium text-ink">{title}</span>
        {recordId && (
          <span className="font-mono text-[10px] text-ink-mute">{recordId}</span>
        )}
        {actions && (
          <div className="ml-auto flex items-center gap-1">{actions}</div>
        )}
      </div>
      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        {allSections.map((section, si) => (
          <div key={si}>
            {section.title && (
              <div className="text-[10px] uppercase tracking-wider text-ink-mute mb-2 mt-4 first:mt-0">
                {section.title}
              </div>
            )}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-2">
              {section.fields.map((field, fi) => (
                <div key={fi} className="flex flex-col gap-0.5">
                  <span className="text-[11px] uppercase tracking-wider text-ink-mute">
                    {field.label}
                  </span>
                  <span className="text-[13px] text-ink">{field.value}</span>
                </div>
              ))}
            </div>
            {si < allSections.length - 1 && (
              <div className="h-px bg-hairline my-3" />
            )}
          </div>
        ))}
        {children}
      </div>
    </div>
  );
}
