import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircleIcon, EyeIcon, EyeOffIcon, GripVerticalIcon, PlusIcon } from "lucide-react";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { cn } from "../lib/utils";
import { useDesigner, type FieldDesignConfig } from "../platform/designer-context";
import { useFocus } from "../platform/focus-manager";
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
  initialValues?: Record<string, any>;
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
  const lookupSource = useMemo(() => {
    if (field.type !== "lookup") return null;
    const sourceConfig = buildLookupConfigFromField(field, field.label, undefined, "No results");
    return sourceConfig ? createRemoteLookupSource(sourceConfig) : null;
  }, [field]);

  if (field.type === "lookup") {
    if (!lookupSource) {
      return null;
    }
    return (
      <LookupField
        value={value ?? null}
        source={lookupSource}
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
  initialValues,
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
  const { isDesignMode, delta, initFields, updateField, addFieldDraft, addFrameDraft } =
    useDesigner();
  const { state: focusState, setFocus } = useFocus();

  const [metaFields, setMetaFields] = useState<FieldDef[]>([]);
  const [loading, setLoading] = useState(!propFields && !!entityName);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Reset form and fetch data when record changes
  useEffect(() => {
    const resetTimer = setTimeout(
      () => setFormData(mode === "create" ? (initialValues ?? {}) : {}),
      0,
    );
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
  }, [recordId, entityName, mode, apiBase, initialValues]);

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
  }, [entityName, propFields]);

  const fields = useMemo(() => {
    const base = (propFields ?? metaFields).map((f) => {
      const ov = fieldOverrides?.find((o) => o.key === f.key);
      return ov ? { ...f, ...ov } : f;
    });

    return base;
  }, [propFields, metaFields, fieldOverrides]);

  useEffect(() => {
    if (!entityName || fields.length === 0) return;
    // Seed designer delta with resolved fields from the current loading path.
    initFields(
      fields.map((f) => ({
        key: f.key,
        visible: true,
        labelEn: f.label,
        labelDe: f.labelDe,
      })),
    );
  }, [entityName, fields, initFields]);

  const designerFieldConfigs = useMemo(() => {
    return new Map<string, FieldDesignConfig>(
      delta.fieldConfigs.map((fieldConfig: FieldDesignConfig) => [fieldConfig.key, fieldConfig]),
    );
  }, [delta.fieldConfigs]);

  const effectiveFields = useMemo(() => {
    if (!isDesignMode || delta.fieldConfigs.length === 0) return fields;

    const orderedConfigs: FieldDesignConfig[] = delta.fieldConfigs
      .slice()
      .sort((a: FieldDesignConfig, b: FieldDesignConfig) => a.order - b.order)
      .filter((f: FieldDesignConfig) => f.visible);
    const fieldByKey = new Map<string, FieldDef>(fields.map((field) => [field.key, field]));
    const orderedKeys = new Set<string>();
    const orderedFields: FieldDef[] = orderedConfigs
      .map((config) => {
        const baseField = fieldByKey.get(config.key);
        if (!baseField) return null;
        orderedKeys.add(config.key);
        return {
          ...baseField,
          label: config.labelEnOverride ?? baseField.label,
          labelDe: config.labelDeOverride ?? baseField.labelDe,
          readonly: config.readonlyOverride ?? baseField.readonly,
          required: config.requiredOverride ?? baseField.required,
        };
      })
      .filter(Boolean) as FieldDef[];

    const remainingFields = fields
      .filter((field) => !orderedKeys.has(field.key))
      .map((field) => {
        const config = designerFieldConfigs.get(field.key);
        if (!config) return field;
        return {
          ...field,
          label: config.labelEnOverride ?? field.label,
          labelDe: config.labelDeOverride ?? field.labelDe,
          readonly: config.readonlyOverride ?? field.readonly,
          required: config.requiredOverride ?? field.required,
        };
      });

    const draftOnlyFields: FieldDef[] = delta.fieldConfigs
      .filter((config) => !fieldByKey.has(config.key) && config.visible)
      .map((config) => ({
        key: config.key,
        label: config.labelEnOverride ?? config.key,
        labelDe: config.labelDeOverride,
        type: "text",
        required: config.requiredOverride ?? false,
        readonly: config.readonlyOverride ?? false,
      }));

    return [...orderedFields, ...remainingFields, ...draftOnlyFields];
  }, [fields, designerFieldConfigs, delta.fieldConfigs, isDesignMode]);

  const selectDesignerField = useCallback(
    (fieldKey: string) => {
      if (!isDesignMode) return;
      setFocus({
        area: "designer",
        entity: entityName,
        recordId: recordId ?? null,
        mode: mode ?? (recordId ? "edit" : null),
        field: fieldKey,
      });
    },
    [entityName, isDesignMode, mode, recordId, setFocus],
  );

  useEffect(() => {
    if (!isDesignMode || !entityName) return;
    setFocus({
      area: "designer",
      entity: entityName,
      recordId: recordId ?? null,
      mode: mode ?? (recordId ? "edit" : null),
      field: null,
    });
  }, [entityName, isDesignMode, mode, recordId, setFocus]);

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
      if (key === "name" && effectiveFields.some((f) => f.key === "slug")) {
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

  const showCancel = !inline && !!onCancel;
  const hasChildContent = !!childSection && !loading && Object.keys(formData).length > 0;
  const isSingleColumn = _layout === "single" || (childLayout === "side" && hasChildContent);
  const loadingGridClass = isSingleColumn ? "grid-cols-1" : "grid-cols-2";

  if (loading) {
    return (
      <div className={cn(shellClassName, className)}>
        <Skeleton className="mb-6 h-5 w-32" />
        <div className={cn("grid gap-x-6 gap-y-5", loadingGridClass)}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const selectedDesignerFieldKey =
    isDesignMode && focusState.area === "designer" && focusState.entity === entityName
      ? focusState.field
      : null;

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
        {effectiveFields.map((field) => {
          const isSelected = selectedDesignerFieldKey === field.key;
          const designerConfig = designerFieldConfigs.get(field.key);
          const visibilityChecked = designerConfig?.visible ?? field.visible !== false;

          return (
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
                onClick={isDesignMode ? () => selectDesignerField(field.key) : undefined}
                onFocusCapture={isDesignMode ? () => selectDesignerField(field.key) : undefined}
                onKeyDown={
                  isDesignMode
                    ? (e) => {
                        if (e.key !== "Enter" && e.key !== " ") return;
                        e.preventDefault();
                        selectDesignerField(field.key);
                      }
                    : undefined
                }
                role="group"
                tabIndex={isDesignMode ? 0 : undefined}
                className={cn(
                  "relative flex min-w-0 flex-col gap-1.5",
                  field.fullWidth && !isSingleColumn && "col-span-2",
                  isDesignMode && "rounded-md p-1 pt-7 ring-1 transition-all ring-inset",
                  isDesignMode &&
                    (isSelected
                      ? "bg-primary/[0.04] shadow-[0_0_0_1px_rgba(83,58,253,0.08)] ring-primary/60"
                      : "ring-primary/20 hover:bg-primary/[0.02] hover:ring-primary/45"),
                )}
              >
                {isDesignMode && (
                  <>
                    <div className="pointer-events-none absolute top-1 left-2 z-10 flex items-center gap-1">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border bg-canvas px-1.5 py-0.5 font-mono text-[9px] font-medium tracking-[0.14em] shadow-sm",
                          isSelected
                            ? "border-primary/40 text-primary"
                            : "border-hairline text-ink-mute",
                        )}
                      >
                        <GripVerticalIcon className="size-2.5 shrink-0 opacity-70" />
                        {field.key}
                      </span>
                    </div>
                    {isSelected && (
                      <div className="pointer-events-none absolute top-1 right-2 z-10 flex items-center gap-1">
                        <span className="rounded-full border border-primary/35 bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium tracking-wide text-primary">
                          selected
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateField(field.key, { visible: !visibilityChecked });
                          }}
                          className={cn(
                            "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[10px] font-medium tracking-wide uppercase transition-colors",
                            visibilityChecked
                              ? "border-primary/30 bg-primary/8 text-primary"
                              : "text-ink-muted border-hairline bg-canvas",
                          )}
                          title={visibilityChecked ? "Hide field" : "Show field"}
                        >
                          {visibilityChecked ? (
                            <EyeIcon className="size-3" />
                          ) : (
                            <EyeOffIcon className="size-3" />
                          )}
                          {visibilityChecked ? "visible" : "hidden"}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateField(field.key, { readonlyOverride: !field.readonly });
                          }}
                          className={cn(
                            "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[10px] font-medium tracking-wide uppercase transition-colors",
                            field.readonly
                              ? "border-primary/30 bg-primary/8 text-primary"
                              : "text-ink-muted border-hairline bg-canvas",
                          )}
                          title={field.readonly ? "Make editable" : "Make readonly"}
                        >
                          {field.readonly ? "readonly" : "editable"}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateField(field.key, { requiredOverride: !field.required });
                          }}
                          className={cn(
                            "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[10px] font-medium tracking-wide uppercase transition-colors",
                            field.required
                              ? "border-primary/30 bg-primary/8 text-primary"
                              : "text-ink-muted border-hairline bg-canvas",
                          )}
                          title={field.required ? "Make optional" : "Make required"}
                        >
                          {field.required ? "required" : "optional"}
                        </button>
                      </div>
                    )}
                  </>
                )}
                {field.type !== "boolean" && (
                  <label className="flex items-center gap-1 text-[12px] font-medium text-ink-secondary select-none">
                    {isDesignMode && isSelected ? (
                      <input
                        type="text"
                        value={fieldLabel(field)}
                        onChange={(e) =>
                          updateField(field.key, {
                            labelEnOverride: e.target.value,
                            labelDeOverride: e.target.value,
                          })
                        }
                        onClick={(e) => e.stopPropagation()}
                        onFocus={(e) => e.stopPropagation()}
                        className="h-6 min-w-0 flex-1 rounded-md border border-hairline bg-canvas px-2 text-[12px] text-ink outline-none"
                      />
                    ) : (
                      <span className="truncate">{fieldLabel(field)}</span>
                    )}
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
          );
        })}
        {isDesignMode && (
          <div className="col-span-2 flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => addFieldDraft()}
              className="text-ink-muted inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-dashed border-hairline px-3 text-[12px] transition-colors hover:border-primary/35 hover:text-primary"
            >
              <PlusIcon className="size-3.5" />
              Add field
            </button>
            <button
              type="button"
              onClick={() => addFrameDraft()}
              className="text-ink-muted inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-dashed border-hairline px-3 text-[12px] transition-colors hover:border-primary/35 hover:text-primary"
            >
              <PlusIcon className="size-3.5" />
              Add frame
            </button>
          </div>
        )}
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
