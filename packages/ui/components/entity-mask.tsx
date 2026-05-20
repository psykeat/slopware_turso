import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircleIcon, GripVerticalIcon } from "lucide-react";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { cn } from "../lib/utils";
import { useDesigner } from "../platform/designer-context";
import { LookupField, buildLookupConfigFromField, createRemoteLookupSource } from "./lookup-field";
import { Skeleton } from "./skeleton";

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
  lookupTable?: string;
  lookupFilter?: any;
  lookupDisplayColumn?: string;
  lookupCodeColumn?: string;
  lookupValueColumn?: string;
  lookupSortColumn?: string;
  lookupIsI18n?: boolean;
  lookupPkColumn?: string;
  /** Renders a visual section divider above this field */
  sectionLabel?: string;
  sectionLabelDe?: string;
}

export interface EntityMaskProps {
  entityName: string;
  recordId?: string | null;
  mode?: "create" | "edit";
  fields?: FieldDef[];
  fieldOverrides?: Partial<FieldDef>[];
  title?: string;
  className?: string;
  layout?: "single" | "two-column";
  onCancel?: () => void;
  onSaved?: (record: unknown) => void;
  onFieldChange?: (
    key: string,
    value: any,
    formData: Record<string, any>,
    setFormData: React.Dispatch<React.SetStateAction<Record<string, any>>>,
  ) => void;
  apiBase?: string;
  embedded?: boolean;
  /** Renders directly in document flow with no modal wrapper and no Cancel button */
  inline?: boolean;
  /** Renders after the form fields when a record is loaded and not in loading state */
  childSection?: (record: Record<string, unknown>) => React.ReactNode;
  /** "side" splits the mask into a left fields panel and right child-section panel */
  childLayout?: "below" | "side";
}

const inputBase =
  "h-7 w-full border bg-canvas rounded px-2 text-[12px] text-ink outline-none transition-colors border-hairline-input focus-visible:ring-[2px] focus-visible:ring-[color-mix(in_oklab,var(--primary)_20%,transparent)] focus-visible:border-primary disabled:opacity-50 disabled:cursor-not-allowed";

const inputError =
  "border-destructive focus-visible:ring-[color-mix(in_oklab,var(--destructive)_20%,transparent)] focus-visible:border-destructive";

const shellClassName =
  "w-full rounded border px-3 py-2 transition-colors border-hairline-input bg-canvas";

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
  const { i18n } = useTranslation();
  const hasError = !!field.error;
  const displayValue =
    typeof value === "object" && value !== null && ("en" in value || "de" in value)
      ? value[i18n.language] || value.en || value.de || ""
      : (value ?? "");

  if (field.type === "lookup") {
    const sourceConfig = buildLookupConfigFromField(field, field.label, undefined, "No results");
    if (!sourceConfig) {
      return null;
    }
    const source = createRemoteLookupSource(sourceConfig);
    return (
      <LookupField
        value={value ?? null}
        source={source}
        disabled={disabled}
        onChange={(next) => onChange(next)}
      />
    );
  }

  if (field.type === "boolean") {
    return (
      <label className="flex cursor-pointer items-center gap-2 select-none">
        <input
          type="checkbox"
          checked={!!value}
          disabled={disabled || field.readonly}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 cursor-pointer rounded border-hairline-input accent-[var(--primary)] disabled:opacity-50"
        />
        <span className="text-[13px] text-ink-secondary">
          {i18n.language === "de" && field.labelDe ? field.labelDe : field.label}
        </span>
      </label>
    );
  }

  if (field.type === "textarea") {
    return (
      <textarea
        value={displayValue}
        readOnly={field.readonly}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cn(inputBase, "h-auto min-h-[80px] resize-y py-2", hasError && inputError)}
      />
    );
  }

  if (field.type === "select" && field.options) {
    return (
      <select
        value={displayValue}
        disabled={disabled || field.readonly}
        onChange={(e) => onChange(e.target.value)}
        className={cn(inputBase, "cursor-pointer", hasError && inputError)}
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

  const inputType = field.type === "number" ? "number" : field.type === "date" ? "date" : "text";

  return (
    <input
      type={inputType}
      value={displayValue}
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
  fieldOverrides,
  title,
  className,
  layout: _layout = "two-column",
  onCancel,
  onSaved,
  onFieldChange,
  apiBase = "/api/data",
  embedded = false,
  inline = false,
  childSection,
  childLayout = "below",
}: EntityMaskProps) {
  const { t, i18n } = useTranslation("ui");
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLDivElement>(null);
  const didAutoFocusRef = useRef(false);
  const { isDesignMode, delta, initFields } = useDesigner();

  const [metaFields, setMetaFields] = useState<FieldDef[]>([]);
  const [loading, setLoading] = useState(!propFields && !!entityName);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Reset form and fetch data when record changes
  useEffect(() => {
    const resetTimer = setTimeout(() => setFormData({}), 0);
    if (recordId && (mode === "edit" || !mode)) {
      fetch(`${apiBase}/${entityName}/${recordId}`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            // Find by primary key if list returned (some APIs return full table)
            const pk = recordId;
            const record =
              data.find(
                (r) =>
                  r[`${entityName}Id`] === pk ||
                  r.id === pk ||
                  r.code === pk ||
                  r.accountNo === pk ||
                  r.iso2Code === pk,
              ) || data[0];
            setFormData(record || {});
          } else if (data) {
            setFormData(data);
          }
        })
        .catch((err) => console.error("EntityMask: failed to fetch record", err));
    }
    return () => clearTimeout(resetTimer);
  }, [recordId, entityName, mode, apiBase]);

  // Load metadata when no fields prop provided
  useEffect(() => {
    if (propFields) return;
    if (!entityName) return;

    let isMounted = true;

    fetch(`/api/metadata/fields/${entityName}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Metadata fetch failed: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        const mappedFields: FieldDef[] = data
          .filter((f: any) => f.isVisible !== false)
          .map((f: any) => ({
            key: f.fieldName,
            label: f.labelEn || f.fieldName,
            labelDe: f.labelDe,
            type: f.lookupTable
              ? "lookup"
              : f.componentHint === "textarea"
                ? "textarea"
                : f.fieldType === "boolean"
                  ? "boolean"
                  : f.fieldType === "timestamp"
                    ? "date"
                    : "text",
            required: f.isRequired || f.requiredStage === "always",
            readonly: f.readonly,
            helpText: f.helpTextEn,
            helpTextDe: f.helpTextDe,
            lookupTable: f.lookupTable,
            lookupFilter: f.lookupFilter,
            lookupPkColumn: f.lookupPkColumn,
            lookupDisplayColumn: f.lookupDisplayColumn,
            lookupCodeColumn: f.lookupCodeColumn,
            lookupValueColumn: f.lookupValueColumn,
            lookupSortColumn: f.lookupSortColumn,
            lookupIsI18n: f.lookupIsI18n,
          }));
        setMetaFields(mappedFields);
        // Seed designer delta with resolved fields (no-op if already initialized)
        initFields(
          mappedFields.map((f) => ({
            key: f.key,
            visible: true,
            labelEn: f.label,
            labelDe: f.labelDe,
          })),
        );
        setLoading(false);
      })
      .catch((err) => {
        console.error(
          "EntityMask: failed to load metadata",
          err instanceof Error ? err.message : err,
        );
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [entityName, propFields, i18n.language]);

  const fields = useMemo(() => {
    const base = (propFields ?? metaFields).map((f) => {
      const ov = fieldOverrides?.find((o) => o.key === f.key);
      return ov ? { ...f, ...ov } : f;
    });

    if (!isDesignMode || delta.fieldConfigs.length === 0) return base;

    // Apply designer order and visibility
    const orderedKeys = delta.fieldConfigs
      .slice()
      .sort((a, b) => a.order - b.order)
      .filter((f) => f.visible)
      .map((f) => f.key);
    return orderedKeys.map((k) => base.find((f) => f.key === k)).filter(Boolean) as typeof base;
  }, [propFields, metaFields, fieldOverrides, isDesignMode, delta.fieldConfigs]);

  useEffect(() => {
    didAutoFocusRef.current = false;
  }, [entityName, recordId, mode]);

  useEffect(() => {
    if (loading || didAutoFocusRef.current) return;
    const root = formRef.current;
    if (!root) return;

    const selector = [
      'input:not([type="hidden"]):not([disabled])',
      "select:not([disabled])",
      "textarea:not([disabled])",
    ].join(", ");
    const first = root.querySelector<HTMLElement>(selector);
    if (!first) return;

    didAutoFocusRef.current = true;
    requestAnimationFrame(() => {
      first.focus();
      if (first instanceof HTMLInputElement && typeof first.select === "function") {
        first.select();
      }
    });
  }, [fields.length, loading]);

  const { mutate: saveRecord, isPending: isSaving } = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      setGlobalError(null);
      const isEdit = recordId && mode !== "create";
      const url = isEdit ? `${apiBase}/${entityName}/${recordId}` : `${apiBase}/${entityName}`;
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || `Save failed: ${res.status}`);
      }
      return res.json();
    },
    onSuccess: (result: unknown) => {
      toast.success(recordId ? t("form.updateSuccess") : t("form.createSuccess"));
      queryClient.invalidateQueries({ queryKey: ["data", entityName] });
      onSaved?.(result);
    },
    onError: (error: Error) => {
      setGlobalError(error.message);
    },
  });

  // F10 / Escape keyboard handlers
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F10") {
        e.preventDefault();
        e.stopPropagation();
        saveRecord(formData);
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCancel?.();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [formData, onCancel, saveRecord]);

  const handleChange = (key: string, val: any) => {
    let nextFormData: Record<string, any> | null = null;

    setFormData((prev) => {
      const next = { ...prev, [key]: val };

      // Auto-generate slug from name if slug exists in fields
      if (key === "name" && fields.some((f) => f.key === "slug")) {
        const generatedSlug = val
          .toString()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)+/g, "");

        // Only auto-generate if slug is empty or matches the old auto-generated version of name
        const oldGeneratedSlug = prev.name
          ? prev.name
              .toString()
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/(^-|-$)+/g, "")
          : "";

        if (!next.slug || next.slug === oldGeneratedSlug) {
          next.slug = generatedSlug;
        }
      }

      nextFormData = next;
      return next;
    });

    if (!nextFormData) return;

    const currentFormData = nextFormData as Record<string, any>;

    onFieldChange?.(key, val, currentFormData, setFormData);

    // Auto-lookup city if countryCode and postalCode are present
    if (
      (key === "countryCode" || key === "postalCode") &&
      currentFormData.countryCode &&
      currentFormData.postalCode
    ) {
      fetch(
        `/api/data/postalCode?countryCode=${currentFormData.countryCode}&plz=${currentFormData.postalCode}`,
      )
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          if (Array.isArray(data) && data.length === 1) {
            setFormData((curr) => ({ ...curr, city: data[0].city }));
          }
        })
        .catch((err) => console.warn("City lookup failed", err));
    }
  };

  const fieldLabel = (field: FieldDef) =>
    i18n.language === "de" && field.labelDe ? field.labelDe : field.label;

  const helpText = (field: FieldDef) =>
    i18n.language === "de" && field.helpTextDe ? field.helpTextDe : field.helpText;

  if (loading) {
    return (
      <div className={cn(shellClassName, className)}>
        <Skeleton className="mb-6 h-5 w-32" />
        <div className="grid grid-cols-2 gap-x-6 gap-y-5">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const showCancel = !inline && !!onCancel;
  const hasChildContent = !!childSection && !loading && Object.keys(formData).length > 0;
  const isSingleColumn = _layout === "single" || (childLayout === "side" && hasChildContent);

  const fieldsGrid = (
    <div className="flex flex-col gap-6">
      {globalError && (
        <div className="flex animate-in items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-3 duration-200 fade-in slide-in-from-top-1">
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="flex flex-col gap-1">
            <span className="text-[13px] font-medium text-destructive">Save Failed</span>
            <span className="text-[12px] leading-relaxed text-destructive/80">{globalError}</span>
          </div>
        </div>
      )}
      <div className={cn("grid gap-x-6 gap-y-5", isSingleColumn ? "grid-cols-1" : "grid-cols-2")}>
        {fields.map((field) => (
          <React.Fragment key={field.key}>
            {field.sectionLabel && (
              <div
                className={cn(
                  "-mb-2 border-t border-hairline pt-2",
                  !isSingleColumn ? "col-span-2" : "",
                )}
              >
                <span className="text-[11px] font-medium tracking-wider text-ink-mute uppercase">
                  {i18n.language === "de" && field.sectionLabelDe
                    ? field.sectionLabelDe
                    : field.sectionLabel}
                </span>
              </div>
            )}
            <div
              className={cn(
                "flex min-w-0 flex-col gap-1.5",
                field.fullWidth && !isSingleColumn && "col-span-2",
                isDesignMode &&
                  "rounded-md p-1 ring-1 ring-primary/20 transition-all ring-inset hover:ring-primary/50",
              )}
            >
              {isDesignMode && (
                <div className="mb-0.5 flex items-center gap-1">
                  <GripVerticalIcon className="size-3 text-primary/40" />
                  <span className="font-mono text-[10px] text-primary/60">{field.key}</span>
                </div>
              )}
              {field.type !== "boolean" && (
                <label className="flex items-center gap-1 text-[12px] font-medium text-ink-secondary select-none">
                  <span className="truncate">{fieldLabel(field)}</span>
                  {field.required && (
                    <span className="shrink-0 leading-none text-destructive">*</span>
                  )}
                </label>
              )}
              <div className="w-full min-w-0">
                <FieldInput
                  field={field}
                  value={formData[field.key] ?? field.value ?? ""}
                  disabled={isSaving}
                  onChange={(val) => handleChange(field.key, val)}
                />
              </div>
              {field.error && (
                <span className="text-[11px] text-[var(--destructive)]">{field.error}</span>
              )}
              {!field.error && helpText(field) && (
                <span className="text-[11px] text-ink-mute">{helpText(field)}</span>
              )}
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );

  const childSectionNode = hasChildContent ? (
    <div className="mt-4 border-t border-hairline pt-4">
      {childSection!(formData as Record<string, unknown>)}
    </div>
  ) : null;

  const footerButtons = (
    <div className="flex justify-end gap-3">
      {showCancel && (
        <button
          onClick={onCancel}
          className="h-7 rounded-full border border-hairline px-4 text-[13px] text-ink-secondary transition-colors hover:border-hairline-input hover:text-ink"
        >
          {t("actions.cancel")}
        </button>
      )}
      <button
        onClick={() => saveRecord(formData)}
        disabled={isSaving}
        className="h-7 rounded-full px-4 text-[13px] disabled:opacity-50"
        style={{ background: "var(--primary)", color: "var(--primary-fg)" }}
      >
        {isSaving ? t("form.saving") : recordId ? t("form.update") : t("form.create")} (F10)
      </button>
    </div>
  );

  const footer = <div className="mt-6 border-t border-hairline pt-5">{footerButtons}</div>;

  if (inline) {
    return (
      <div ref={formRef} className={cn("p-4", className)}>
        {title && <h2 className="mb-1 text-[18px] font-light text-ink">{title}</h2>}
        <p className="mb-6 text-[13px] text-ink-mute">{t("form.requiredHint")}</p>
        {fieldsGrid}
        {childSectionNode}
        {footer}
      </div>
    );
  }

  if (embedded && childLayout === "side" && hasChildContent) {
    return (
      <div ref={formRef} className={cn("flex h-full flex-col overflow-hidden", className)}>
        <div className="flex min-h-0 flex-1 divide-x divide-hairline overflow-hidden">
          <div className="w-[35%] shrink-0 overflow-y-auto bg-canvas-soft/30 p-6">
            {title && <h2 className="mb-1 text-[18px] font-light text-ink">{title}</h2>}
            <p className="mb-4 text-[13px] text-ink-mute">{t("form.requiredHint")}</p>
            {globalError && (
              <div className="mb-4 flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-3">
                <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
                <span className="text-[12px] text-destructive/80">{globalError}</span>
              </div>
            )}
            {fieldsGrid}
          </div>
          <div className="flex-1 overflow-x-auto overflow-y-auto p-6">
            {childSection!(formData as Record<string, unknown>)}
          </div>
        </div>
        <div className="shrink-0 border-t border-hairline bg-canvas px-6 py-4">{footerButtons}</div>
      </div>
    );
  }

  if (embedded) {
    return (
      <div ref={formRef} className={cn("overflow-auto p-4", className)}>
        {title && <h2 className="mb-1 text-[18px] font-light text-ink">{title}</h2>}
        <p className="mb-6 text-[13px] text-ink-mute">{t("form.requiredHint")}</p>
        {fieldsGrid}
        {childSectionNode}
        {footer}
      </div>
    );
  }

  return (
    <div ref={formRef} className={cn("mx-auto my-8 max-w-2xl", shellClassName, className)}>
      {title && <h2 className="mb-1 text-[18px] font-light text-ink">{title}</h2>}
      <p className="mb-6 text-[13px] text-ink-mute">{t("form.requiredHint")}</p>
      {fieldsGrid}
      {childSectionNode}
      {footer}
    </div>
  );
}
