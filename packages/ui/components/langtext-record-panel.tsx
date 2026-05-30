import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { cn } from "../lib/utils";
import { LangtextEditor, type LangTextEntry } from "./langtext-editor";

export interface LangTextFieldSpec {
  field: string;
  label: string;
  sourceField?: string;
}

export interface LangTextRecordPanelProps {
  entityName: string;
  recordId: string | null;
  title?: string;
  fields: LangTextFieldSpec[];
  className?: string;
  controlledValues?: Record<string, string>;
  onControlledChange?: (field: string, value: string) => void;
}

function defaultString(value: unknown) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  return "";
}

function resolveTextSourceLabel(sourceEntity?: string | null, sourceField?: string | null) {
  const parts = [sourceEntity, sourceField].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function buildDraftMap(
  record: Record<string, any> | null | undefined,
  fields: LangTextFieldSpec[],
) {
  const nextDrafts: Record<string, string> = {};
  for (const field of fields) {
    nextDrafts[field.field] = defaultString(record?.[field.field]);
  }
  return nextDrafts;
}

function LangTextRecordPanelView({
  entityName,
  recordId,
  title,
  fields,
  record,
  className,
  isControlled = false,
  onControlledChange,
}: {
  entityName: string;
  recordId: string | null;
  title?: string;
  fields: LangTextFieldSpec[];
  record: Record<string, any> | null;
  className?: string;
  isControlled?: boolean;
  onControlledChange?: (field: string, value: string) => void;
}) {
  const { t } = useTranslation("ui");
  const queryClient = useQueryClient();
  const [activeKey, setActiveKey] = useState(fields[0]?.field ?? "");
  const [drafts, setDrafts] = useState<Record<string, string>>(() => buildDraftMap(record, fields));

  const resolvedActiveKey = useMemo(
    () =>
      fields.some((field) => field.field === activeKey) ? activeKey : (fields[0]?.field ?? ""),
    [activeKey, fields],
  );

  const entries = useMemo<LangTextEntry[]>(
    () =>
      fields.map((field) => ({
        key: field.field,
        label: field.label,
        value: drafts[field.field] ?? defaultString(record?.[field.field]),
        linked:
          !isControlled &&
          (!!record?.[`${field.field}SourceEntity`] || !!record?.[`${field.field}SourceId`]),
        overridden: !isControlled && !!record?.[`${field.field}OverriddenAt`],
        sourceLabel: isControlled
          ? null
          : (resolveTextSourceLabel(
              record?.[`${field.field}SourceEntity`] ?? null,
              record?.[`${field.field}SourceField`] ?? null,
            ) ??
            field.sourceField ??
            null),
      })),
    [drafts, fields, record, isControlled],
  );

  const saveMutation = useMutation({
    mutationFn: async ({ fieldKey, html }: { fieldKey: string; html: string }) => {
      if (!recordId) return null;
      const res = await fetch(`/api/data/${entityName}/${recordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [fieldKey]: html }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["data", entityName, recordId] });
      toast.success(t("langtextEditor.saved", { defaultValue: "Langtexte gespeichert" }));
    },
    onError: (err: any) => {
      toast.error(
        err?.message ??
          t("langtextEditor.saveError", {
            defaultValue: "Langtexte konnten nicht gespeichert werden",
          }),
      );
    },
  });

  return (
    <div className={cn("flex min-h-[18rem] flex-col gap-2", className)}>
      <div className="min-h-[14rem] flex-1">
        <LangtextEditor
          key={`${entityName}:${recordId ?? "none"}`}
          title={title ?? t("langtextEditor.title", { defaultValue: "Langtexte" })}
          entries={entries}
          activeKey={resolvedActiveKey}
          onActiveKeyChange={setActiveKey}
          onChange={(key: string, html: string) => {
            setDrafts((prev) => ({ ...prev, [key]: html }));
            if (isControlled && onControlledChange) {
              onControlledChange(key, html);
            }
          }}
          onCommit={async (fieldKey: string, html: string) => {
            setDrafts((prev) => ({ ...prev, [fieldKey]: html }));
            if (isControlled) {
              if (onControlledChange) {
                onControlledChange(fieldKey, html);
              }
            } else {
              if (!recordId) return;
              await saveMutation.mutateAsync({ fieldKey, html });
            }
          }}
          readOnly={(!isControlled && !recordId) || saveMutation.isPending}
          className="min-h-[14rem]"
        />
      </div>
    </div>
  );
}

export function LangTextRecordPanel({
  entityName,
  recordId,
  title,
  fields,
  className,
  controlledValues,
  onControlledChange,
}: LangTextRecordPanelProps) {
  const isControlled = !!controlledValues;

  const { data: record } = useQuery<Record<string, any> | null>({
    queryKey: ["data", entityName, recordId],
    queryFn: async () => {
      if (!recordId) return null;
      const res = await fetch(`/api/data/${entityName}/${recordId}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!recordId && !isControlled,
  });

  // No-op signature, no longer needed since editorKey is based solely on entity and recordId
  const editorKey = useMemo(
    () => `${entityName}:${recordId ?? "none"}:${fields.map((field) => field.field).join(",")}`,
    [entityName, fields, recordId],
  );

  return (
    <LangTextRecordPanelView
      key={editorKey}
      entityName={entityName}
      recordId={recordId}
      title={title}
      fields={fields}
      record={isControlled ? controlledValues! : (record ?? null)}
      className={className}
      isControlled={isControlled}
      onControlledChange={onControlledChange}
    />
  );
}
