import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { cn } from "../lib/utils";
import { Skeleton } from "./skeleton";
import i18next from "i18next";

export interface FieldDef {
  key: string;
  label: string;
  labelDe?: string;
  type: "text" | "number" | "date" | "boolean" | "lookup" | "textarea" | "select";
  required?: boolean;
  readonly?: boolean;
  value?: any;
  error?: string;
  helpText?: string;
  helpTextDe?: string;
  options?: { value: string; label: string }[];
  fullWidth?: boolean;
}

export interface EntityMaskProps {
  entityName: string;
  recordId?: string | null;
  mode?: "create" | "edit";
  fields?: FieldDef[];
  title?: string;
  className?: string;
  layout?: "single" | "two-column";
  onCancel?: () => void;
  onSaved?: (record: unknown) => void;
  apiBase?: string;
  embedded?: boolean;
}

const inputBase =
  "h-9 w-full border bg-canvas rounded-md px-3 text-[13px] text-ink outline-none transition-colors border-hairline-input focus-visible:ring-[3px] focus-visible:ring-[color-mix(in_oklab,var(--primary)_20%,transparent)] focus-visible:border-primary disabled:opacity-50 disabled:cursor-not-allowed";

const inputError =
  "border-destructive focus-visible:ring-[color-mix(in_oklab,var(--destructive)_20%,transparent)] focus-visible:border-destructive";

function FieldInput({
  field,
  value,
  disabled,
  onChange,
}: {
  field: FieldDef;
  value: any;
  disabled: boolean;
  onChange: (val: any) => void;
}) {
  const hasError = !!field.error;

  if (field.type === "boolean") {
    return (
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={!!value}
          disabled={disabled || field.readonly}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-hairline-input accent-[var(--primary)] disabled:opacity-50 cursor-pointer"
        />
        <span className="text-[13px] text-ink-secondary">
          {i18next.language === "de" && field.labelDe ? field.labelDe : field.label}
        </span>
      </label>
    );
  }

  if (field.type === "textarea") {
    return (
      <textarea
        value={value ?? ""}
        readOnly={field.readonly}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          inputBase,
          "h-auto min-h-[80px] resize-y py-2",
          hasError && inputError,
        )}
      />
    );
  }

  if (field.type === "select" && field.options) {
    return (
      <select
        value={value ?? ""}
        disabled={disabled || field.readonly}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          inputBase,
          "cursor-pointer",
          hasError && inputError,
        )}
      >
        <option value="" />
        {field.options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  const inputType =
    field.type === "number" ? "number" : field.type === "date" ? "date" : "text";

  return (
    <input
      type={inputType}
      value={value ?? ""}
      readOnly={field.readonly}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={cn(inputBase, hasError && inputError)}
    />
  );
}

export function EntityMask({
  entityName,
  recordId,
  mode,
  fields: propFields,
  title,
  className,
  layout: _layout = "two-column",
  onCancel,
  onSaved,
  apiBase = "/api/data",
  embedded = false,
}: EntityMaskProps) {
  const { t } = useTranslation("ui");
  const queryClient = useQueryClient();

  const [metaFields, setMetaFields] = useState<FieldDef[]>([]);
  const [loading, setLoading] = useState(!propFields && !!entityName);
  const [formData, setFormData] = useState<Record<string, any>>({});

  // Reset form when record changes
  useEffect(() => {
    setFormData({});
  }, [recordId]);

  // Load metadata when no fields prop provided
  useEffect(() => {
    if (propFields) return;
    if (!entityName) return;

    let isMounted = true;
    setLoading(true);

    fetch(`/api/metadata/fields/${entityName}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Metadata fetch failed: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        const mappedFields: FieldDef[] = data
          .filter((f: any) => !f.readonly && !f.hidden)
          .map((f: any) => ({
            key: f.fieldName,
            label: f.labelEn || f.fieldName,
            labelDe: f.labelDe,
            type:
              f.componentHint === "textarea"
                ? "textarea"
                : f.fieldType === "boolean"
                  ? "boolean"
                  : f.fieldType === "timestamp"
                    ? "date"
                    : "text",
            required: f.requiredStage === "always",
            readonly: f.readonly,
            helpText: f.helpTextEn,
            helpTextDe: f.helpTextDe,
          }));
        setMetaFields(mappedFields);
        setLoading(false);
      })
      .catch((err) => {
        console.error("EntityMask: failed to load metadata", err instanceof Error ? err.message : err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [entityName, propFields]);

  const fields = propFields ?? metaFields;

  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const isEdit = recordId && mode !== "create";
      const url = isEdit
        ? `${apiBase}/${entityName}/${recordId}`
        : `${apiBase}/${entityName}`;
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      return res.json();
    },
    onSuccess: (result: unknown) => {
      queryClient.invalidateQueries({ queryKey: ["data", entityName] });
      onSaved?.(result);
    },
  });

  // F10 / Escape keyboard handlers
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F10") {
        e.preventDefault();
        saveMutation.mutate(formData);
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel?.();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [formData, recordId, onCancel, saveMutation]);

  const handleChange = (key: string, val: any) => {
    setFormData((prev) => ({ ...prev, [key]: val }));
  };

  const fieldLabel = (field: FieldDef) =>
    i18next.language === "de" && field.labelDe ? field.labelDe : field.label;

  const helpText = (field: FieldDef) =>
    i18next.language === "de" && field.helpTextDe ? field.helpTextDe : field.helpText;

  if (loading) {
    return (
      <div className={cn("bg-canvas p-6 rounded-xl border border-hairline", className)}>
        <Skeleton className="h-5 w-32 mb-6" />
        <div className="grid grid-cols-2 gap-x-6 gap-y-5">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const fieldsGrid = (
    <div className="grid grid-cols-2 gap-x-6 gap-y-5">
      {fields.map((field) => (
        <div
          key={field.key}
          className={cn("flex flex-col gap-1", field.fullWidth && "col-span-2")}
        >
          {field.type !== "boolean" && (
            <label className="text-[12px] font-medium text-ink-secondary flex items-center gap-1">
              {fieldLabel(field)}
              {field.required && (
                <span className="text-[var(--destructive)] leading-none">*</span>
              )}
            </label>
          )}
          <FieldInput
            field={field}
            value={formData[field.key] ?? field.value ?? ""}
            disabled={saveMutation.isPending}
            onChange={(val) => handleChange(field.key, val)}
          />
          {field.error && (
            <span className="text-[11px] text-[var(--destructive)]">{field.error}</span>
          )}
          {!field.error && helpText(field) && (
            <span className="text-[11px] text-ink-mute">{helpText(field)}</span>
          )}
        </div>
      ))}
    </div>
  );

  const footer = (
    <div className="mt-6 pt-5 border-t border-hairline flex justify-end gap-3">
      {onCancel && (
        <button
          onClick={onCancel}
          className="h-7 px-4 rounded-full text-[13px] border border-hairline text-ink-secondary hover:text-ink hover:border-hairline-input transition-colors"
        >
          {t("actions.cancel")}
        </button>
      )}
      <button
        onClick={() => saveMutation.mutate(formData)}
        disabled={saveMutation.isPending}
        className="h-7 px-4 rounded-full text-[13px] disabled:opacity-50"
        style={{ background: "var(--primary)", color: "var(--primary-fg)" }}
      >
        {saveMutation.isPending
          ? t("form.saving")
          : recordId
            ? t("form.update")
            : t("form.create")}{" "}
        (F10)
      </button>
    </div>
  );

  if (embedded) {
    return (
      <div className={cn("overflow-auto p-4", className)}>
        {title && (
          <h2 className="text-[18px] font-light text-ink mb-1">{title}</h2>
        )}
        <p className="text-[13px] text-ink-mute mb-6">{t("form.requiredHint")}</p>
        {fieldsGrid}
        {footer}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "bg-canvas rounded-xl border border-hairline shadow-lg p-6 max-w-2xl mx-auto my-8",
        className,
      )}
    >
      {title && (
        <h2 className="text-[18px] font-light text-ink mb-1">{title}</h2>
      )}
      <p className="text-[13px] text-ink-mute mb-6">{t("form.requiredHint")}</p>
      {fieldsGrid}
      {footer}
    </div>
  );
}
