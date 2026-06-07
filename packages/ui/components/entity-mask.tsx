import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircleIcon, EyeIcon, EyeOffIcon, GripVerticalIcon, PlusIcon } from "lucide-react";
import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
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
  type: "text" | "number" | "date" | "boolean" | "lookup" | "textarea" | "select" | "password";
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
  jsonPath?: string;
  styleTokenBinding?: string | null;
  labelStyle?: "normal" | "bold" | "italic";
  labelTone?: "default" | "muted" | "accent" | "danger";
  /** Renders a visual section divider above this field */
  sectionLabel?: string;
  sectionLabelDe?: string;
  visible?: boolean;
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
  childSection?: (
    record: Record<string, unknown>,
    onChange: (key: string, value: any) => void,
  ) => React.ReactNode;
  /** "side" splits the mask into a left fields panel and right child-section panel */
  childLayout?: "below" | "side";
}

const inputBase =
  "h-7 w-full border bg-canvas rounded px-2 text-[12px] text-ink outline-none transition-colors border-hairline-input focus-visible:ring-[2px] focus-visible:ring-[color-mix(in_oklab,var(--primary)_20%,transparent)] focus-visible:border-primary disabled:opacity-50 disabled:cursor-not-allowed";

const inputError =
  "border-destructive focus-visible:ring-[color-mix(in_oklab,var(--destructive)_20%,transparent)] focus-visible:border-destructive";

const shellClassName =
  "w-full rounded border px-3 py-2 transition-colors border-hairline-input bg-canvas";

const LABEL_TONE_CLASSES: Record<NonNullable<FieldDesignConfig["labelTone"]>, string> = {
  default: "text-ink-secondary",
  muted: "text-ink-muted",
  accent: "text-primary",
  danger: "text-destructive",
};

function getFieldLabelClasses(field: FieldDef) {
  return cn(
    "truncate",
    LABEL_TONE_CLASSES[field.labelTone ?? "default"],
    field.labelStyle === "bold" && "font-semibold",
    field.labelStyle === "italic" && "italic",
  );
}

function normalizeStyleBinding(field: FieldDef, config: FieldDesignConfig | null) {
  const labelTone = config?.labelTone ?? "default";
  const labelStyle = config?.labelStyle ?? "normal";
  const toneToken = labelTone === "default" ? null : `label-${labelTone}`;
  const styleToken = labelStyle === "normal" ? null : `label-${labelStyle}`;
  return config?.styleTokenBinding ?? toneToken ?? styleToken ?? field.styleTokenBinding ?? null;
}

function FieldInput({
  field: originalField,
  value,
  disabled,
  onChange,
  onBlur,
}: {
  field: FieldDef;
  value: any;
  disabled: boolean;
  onChange: (val: any) => void;
  onBlur?: () => void;
}) {
  const field = useMemo(() => {
    if (
      originalField.type !== "lookup" &&
      originalField.key.endsWith("Id") &&
      originalField.key !== "id"
    ) {
      return {
        ...originalField,
        type: "lookup" as const,
        lookupTable: originalField.lookupTable || originalField.key.replace(/Id$/, ""),
      };
    }
    // Also enforce UUIDs that are passed to a text field without 'Id' to be hidden or handled?
    // The user said: "input fields with uuid fks must always resolve the uuid". Above fixes it by key.
    // If it's still a text field but value is a uuid, we can blank it, but key inference is safest.
    return originalField;
  }, [originalField]);
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
          onBlur={onBlur}
          className="h-4 w-4 cursor-pointer rounded border-hairline-input accent-[var(--primary)] disabled:opacity-50"
        />
        <span className={cn("text-[13px]", getFieldLabelClasses(field))}>
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
        onBlur={onBlur}
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
        onBlur={onBlur}
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

  const inputType =
    field.type === "number"
      ? "number"
      : field.type === "date"
        ? "date"
        : field.type === "password"
          ? "password"
          : "text";

  return (
    <input
      type={inputType}
      value={displayValue}
      readOnly={field.readonly}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
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
  const fieldRefs = useRef(new Map<string, HTMLDivElement | null>());
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const didAutoFocusRef = useRef(false);
  const {
    isDesignMode,
    activeSurfaceState,
    delta,
    initFields,
    updateField,
    updateFrameLabel,
    addFieldDraft,
    addFrameDraft,
    moveField,
    moveFieldToStart,
    moveFieldToEnd,
    moveFieldToFrame,
    removeFieldDraft,
    removeFrameDraft,
    selectDesignerNodes,
  } = useDesigner();
  const { state: focusState, setFocus } = useFocus();

  const [metaFields, setMetaFields] = useState<FieldDef[]>([]);
  const [loading, setLoading] = useState(!propFields && !!entityName);
  const [initialData, setInitialData] = useState<Record<string, any>>(
    mode === "create" ? (initialValues ?? {}) : {},
  );
  const [globalError, setGlobalError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: initialData,
    onSubmit: async ({ value, formApi }) => {
      setGlobalError(null);
      const isEdit = recordId && mode !== "create";
      const url = isEdit ? `${apiBase}/${entityName}/${recordId}` : `${apiBase}/${entityName}`;
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });
      if (!res.ok) {
        const errorText = await res.text();
        let parsed: any;
        try {
          parsed = JSON.parse(errorText);
        } catch {}

        if (parsed && typeof parsed === "object" && parsed.error) {
          throw new Error(parsed.error);
        } else if (parsed && Array.isArray(parsed.issues)) {
          let hasFieldErrors = false;
          parsed.issues.forEach((issue: any) => {
            const path = issue.path?.join(".") || "";
            if (path) {
              formApi.setFieldMeta(path as any, (meta) => ({ ...meta, errors: [issue.message] }));
              hasFieldErrors = true;
            } else {
              setGlobalError(issue.message);
            }
          });
          throw new Error("Validation failed");
        } else if (res.status === 400 || res.status === 409 || res.status === 422) {
          throw new Error(errorText || `Constraint failed: ${res.status}`);
        } else {
          throw new Error(errorText || `Save failed: ${res.status}`);
        }
      }
      const result = await res.json();
      toast.success(recordId ? t("form.updateSuccess") : t("form.createSuccess"));
      queryClient.invalidateQueries({ queryKey: ["data", entityName] });
      onSaved?.(result);
      return result;
    },
  });
  const [editorFieldKey, setEditorFieldKey] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<"compact" | "expanded">("compact");
  const [overlayStyle, setOverlayStyle] = useState<React.CSSProperties | null>(null);

  // Reset form and fetch data when record changes
  useEffect(() => {
    let active = true;
    const initial = mode === "create" ? (initialValues ?? {}) : {};
    if (mode === "create") {
      setInitialData(initial);
      form.reset();
    }
    if (recordId && (mode === "edit" || !mode)) {
      fetch(`${apiBase}/${entityName}/${recordId}`)
        .then((res) => res.json())
        .then((data) => {
          if (!active) return;
          if (Array.isArray(data)) {
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
            setInitialData(record || {});
            setTimeout(() => form.reset(), 0);
          } else if (data) {
            setInitialData(data);
            setTimeout(() => form.reset(), 0);
          }
        })
        .catch((err) => console.error("EntityMask: failed to fetch record", err));
    }
    return () => {
      active = false;
    };
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
        visible: f.visible !== false,
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

  const frameNodes = useMemo(
    () =>
      (activeSurfaceState?.nodes ?? [])
        .filter((node) => node.kind === "group-frame")
        .slice()
        .sort(
          (left, right) =>
            left.displayOrder - right.displayOrder || left.id.localeCompare(right.id),
        ),
    [activeSurfaceState?.nodes],
  );

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
          visible: config.visible,
          jsonPath: config.path ?? baseField.jsonPath,
          styleTokenBinding: normalizeStyleBinding(baseField, config),
          labelStyle: config.labelStyle ?? "normal",
          labelTone: config.labelTone ?? "default",
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
          visible: config.visible,
          jsonPath: config.path ?? field.jsonPath,
          styleTokenBinding: normalizeStyleBinding(field, config),
          labelStyle: config.labelStyle ?? "normal",
          labelTone: config.labelTone ?? "default",
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
        visible: config.visible,
        jsonPath: config.path ?? config.key,
        styleTokenBinding: normalizeStyleBinding(
          { key: config.key, label: config.labelEnOverride ?? config.key, type: "text" },
          config,
        ),
        labelStyle: config.labelStyle ?? "normal",
        labelTone: config.labelTone ?? "default",
      }));

    return [...orderedFields, ...remainingFields, ...draftOnlyFields];
  }, [designerFieldConfigs, delta.fieldConfigs, fields, isDesignMode]);

  const groupedFields = useMemo(() => {
    const groups: { frameId: string; label: string; fields: FieldDef[] }[] = [];
    const fieldsInFrames = new Set<string>();

    if (frameNodes.length > 0) {
      // Create a map from fieldKey to parentId
      const fieldToParent = new Map<string, string>();
      if (activeSurfaceState?.nodes) {
        for (const node of activeSurfaceState.nodes) {
          if ((node.kind === "field-ref" || node.kind === "jsonb-field") && node.parentId) {
            fieldToParent.set(node.id, node.parentId);
          }
        }
      }

      // Group fields by defined frames
      for (const frame of frameNodes) {
        const frameFields = effectiveFields.filter((field) => {
          const parentId = fieldToParent.get(field.key);
          return parentId === frame.id;
        });

        groups.push({
          frameId: frame.id,
          label: frame.label,
          fields: frameFields,
        });

        for (const f of frameFields) {
          fieldsInFrames.add(f.key);
        }
      }
    }

    // Capture any remaining fields that aren't in any frame
    const remaining = effectiveFields.filter((f) => !fieldsInFrames.has(f.key));
    if (remaining.length > 0) {
      groups.push({
        frameId: "default",
        label: "", // no label for general/remaining fields
        fields: remaining,
      });
    }

    return groups;
  }, [frameNodes, effectiveFields, activeSurfaceState]);

  const fieldByKey = useMemo(
    () => new Map(effectiveFields.map((field) => [field.key, field])),
    [effectiveFields],
  );

  const visibleFieldInLiveView = useCallback(
    (field: FieldDef) => {
      if (isDesignMode) return true;
      const designerConfig = designerFieldConfigs.get(field.key);
      return (designerConfig?.visible ?? field.visible) !== false;
    },
    [designerFieldConfigs, isDesignMode],
  );

  const selectedDesignerKey = focusState.field ?? null;
  const selectedFieldKey =
    selectedDesignerKey && fieldByKey.has(selectedDesignerKey) ? selectedDesignerKey : null;

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
      selectDesignerNodes("triview-detail", [fieldKey], entityName);
    },
    [entityName, isDesignMode, mode, recordId, selectDesignerNodes, setFocus],
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

  // Sync editorFieldKey state on render instead of effect to avoid setState-in-effect warning
  const lastSelectedFieldKeyRef = useRef(selectedFieldKey);
  if (lastSelectedFieldKeyRef.current !== selectedFieldKey) {
    lastSelectedFieldKeyRef.current = selectedFieldKey;
    if (!selectedFieldKey) {
      if (editorFieldKey !== null) setEditorFieldKey(null);
      if (editorMode !== "compact") setEditorMode("compact");
    } else if (editorFieldKey !== selectedFieldKey) {
      setEditorFieldKey(selectedFieldKey);
      if (editorMode !== "compact") setEditorMode("compact");
    }
  }

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

  // F10 / Escape keyboard handlers
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F10") {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCancel?.();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [form, onCancel]);

  const fieldLabel = (field: FieldDef) =>
    i18n.language === "de" && field.labelDe ? field.labelDe : field.label;

  const helpText = (field: FieldDef) =>
    i18n.language === "de" && field.helpTextDe ? field.helpTextDe : field.helpText;

  const showCancel = !inline && !!onCancel;
  const hasChildContent = !!childSection && !loading && Object.keys(initialData).length > 0; // We show it if we loaded data
  const fieldGridClass = _layout === "single" ? "grid-cols-1" : "grid-cols-2";

  const selectedDesignerFieldKey = selectedFieldKey;

  useLayoutEffect(() => {
    if (!editorFieldKey || !isDesignMode) {
      if (overlayStyle !== null) {
        requestAnimationFrame(() => {
          setOverlayStyle(null);
        });
      }
      return;
    }
    const sync = () => {
      const anchor = fieldRefs.current.get(editorFieldKey);
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const width = Math.min(window.innerWidth - 24, editorMode === "expanded" ? 420 : 360);
      const estimatedHeight = editorMode === "expanded" ? 320 : 220;
      let top = rect.bottom + 10;
      if (top + estimatedHeight > window.innerHeight - 12) {
        top = Math.max(12, rect.top - estimatedHeight - 10);
      }
      let left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));

      // Collision guard against the right-docked InlineDesigner panel (width ~420px + margins)
      const collisionBoundary = window.innerWidth - 452;
      if (left > collisionBoundary - width) {
        left = Math.max(12, Math.min(left, collisionBoundary - width));
      }

      setOverlayStyle({ position: "fixed", top, left, width, zIndex: 70 });
    };
    sync();
    window.addEventListener("scroll", sync, true);
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("scroll", sync, true);
      window.removeEventListener("resize", sync);
    };
  }, [editorFieldKey, editorMode, isDesignMode, selectedFieldKey, fields.length]); // Removed form.state.values and overlayStyle to prevent infinite loops

  useEffect(() => {
    if (!editorFieldKey) return;
    const handler = (event: MouseEvent) => {
      const target = event.target as Node;
      if (overlayRef.current?.contains(target)) return;
      const anchor = fieldRefs.current.get(editorFieldKey);
      if (anchor?.contains(target)) return;
      setEditorFieldKey(null);
      setEditorMode("compact");
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [editorFieldKey]);

  useEffect(() => {
    if (!editorFieldKey) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setEditorFieldKey(null);
      setEditorMode("compact");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editorFieldKey]);

  const setFieldRef = useCallback((key: string, node: HTMLDivElement | null) => {
    fieldRefs.current.set(key, node);
  }, []);

  const openFieldEditor = useCallback(
    (fieldKey: string, mode: "compact" | "expanded" = "compact") => {
      selectDesignerField(fieldKey);
      setEditorFieldKey(fieldKey);
      setEditorMode(mode);
    },
    [selectDesignerField],
  );

  const cycleLabelTone = (current: FieldDesignConfig["labelTone"] | undefined) => {
    const order: FieldDesignConfig["labelTone"][] = ["default", "muted", "accent", "danger"];
    const nextIndex = (order.indexOf(current ?? "default") + 1) % order.length;
    return order[nextIndex];
  };

  const cycleLabelStyle = (current: FieldDesignConfig["labelStyle"] | undefined) => {
    const order: FieldDesignConfig["labelStyle"][] = ["normal", "bold", "italic"];
    const nextIndex = (order.indexOf(current ?? "normal") + 1) % order.length;
    return order[nextIndex];
  };

  if (loading) {
    return (
      <div className={cn(shellClassName, className)}>
        <Skeleton className="mb-6 h-5 w-32" />
        <div className={cn("grid gap-x-6 gap-y-5", fieldGridClass)}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const renderFieldCard = (field: FieldDef) => {
    const isSelected = selectedDesignerFieldKey === field.key;
    const designerConfig = designerFieldConfigs.get(field.key);
    const visibilityChecked = designerConfig?.visible ?? field.visible !== false;
    const hiddenClass = isDesignMode && !visibilityChecked ? "opacity-55" : "";

    const path = field.jsonPath ?? field.key;

    // Build listeners dynamically based on field
    let onChangeAsync: any = undefined;
    let onChange: any = undefined;

    // Derived autofill: ZIP + Country -> City
    if (field.key === "postalCode" || field.key === "countryCode") {
      onChangeAsync = async ({ value, fieldApi }: any) => {
        const otherKey = field.key === "postalCode" ? "countryCode" : "postalCode";
        const otherVal = fieldApi.form.getFieldValue(otherKey);
        const postalCode = field.key === "postalCode" ? value : otherVal;
        const countryCode = field.key === "countryCode" ? value : otherVal;

        if (postalCode && countryCode) {
          try {
            const res = await fetch(
              `/api/data/postalCode?countryCode=${countryCode}&plz=${postalCode}`,
            );
            if (res.ok) {
              const data = await res.json();
              if (Array.isArray(data) && data.length === 1) {
                fieldApi.form.setFieldValue("city", data[0].city);
              }
            }
          } catch (err) {
            console.warn("City lookup failed", err);
          }
        }
        return undefined;
      };
    }

    // Auto slug generation
    if (field.key === "name" && fieldByKey.has("slug")) {
      onChange = ({ value, fieldApi }: any) => {
        const generatedSlug = value
          .toString()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)+/g, "");

        const currentSlug = fieldApi.form.getFieldValue("slug");
        if (!currentSlug) {
          fieldApi.form.setFieldValue("slug", generatedSlug);
        }
        return undefined;
      };
    }

    return (
      <form.Field
        key={field.key}
        name={path as any}
        asyncDebounceMs={onChangeAsync ? 500 : undefined}
        validators={{
          onChangeAsync: onChangeAsync,
          onChange: onChange,
        }}
      >
        {(fieldApi) => {
          const currentValue = fieldApi.state.value;
          const hasError = fieldApi.state.meta.errors.length > 0;
          const errorMessage = fieldApi.state.meta.errors.join(", ");
          const combinedError = hasError ? errorMessage : field.error;

          return (
            <div
              ref={(node) => setFieldRef(field.key, node)}
              onClick={isDesignMode ? () => openFieldEditor(field.key, "compact") : undefined}
              onDoubleClick={
                isDesignMode ? () => openFieldEditor(field.key, "expanded") : undefined
              }
              onFocusCapture={
                isDesignMode ? () => openFieldEditor(field.key, "compact") : undefined
              }
              onKeyDown={
                isDesignMode
                  ? (e) => {
                      if (e.key !== "Enter" && e.key !== " ") return;
                      e.preventDefault();
                      openFieldEditor(field.key, "expanded");
                    }
                  : undefined
              }
              role="group"
              tabIndex={isDesignMode ? 0 : undefined}
              className={cn(
                "relative flex min-w-0 flex-col gap-1.5 rounded-md transition-all",
                field.fullWidth && fieldGridClass === "grid-cols-2" && "col-span-2",
                hiddenClass,
                isDesignMode &&
                  (isSelected
                    ? "bg-primary/[0.04] shadow-[0_0_0_1px_rgba(83,58,253,0.08)] ring-1 ring-primary/60 ring-inset"
                    : "ring-1 ring-primary/20 ring-inset hover:bg-primary/[0.02] hover:ring-primary/45"),
              )}
            >
              {isDesignMode && (
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
                  {field.jsonPath ? (
                    <span className="text-ink-muted rounded-full border border-hairline bg-canvas px-1.5 py-0.5 font-mono text-[9px] tracking-[0.14em] uppercase">
                      jsonb
                    </span>
                  ) : null}
                </div>
              )}

              {field.type !== "boolean" && (
                <div className="flex items-center gap-1 text-[12px] font-medium select-none">
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={
                      isDesignMode ? () => openFieldEditor(field.key, "expanded") : undefined
                    }
                    className={cn("truncate text-left", getFieldLabelClasses(field))}
                  >
                    {fieldLabel(field)}
                  </button>
                  {field.required && (
                    <span className="shrink-0 leading-none text-destructive">*</span>
                  )}
                </div>
              )}

              <div className="w-full min-w-0">
                <form.Subscribe selector={(state) => state.isSubmitting}>
                  {(isSubmitting) => (
                    <FieldInput
                      field={{ ...field, error: combinedError }}
                      value={currentValue ?? field.value ?? ""}
                      disabled={isSubmitting}
                      onChange={(val) => {
                        fieldApi.handleChange(val);
                        // Backwards compatibility for onFieldChange
                        onFieldChange?.(field.key, val, form.state.values, (() => {}) as any);
                      }}
                      onBlur={() => fieldApi.handleBlur()}
                    />
                  )}
                </form.Subscribe>
              </div>

              {combinedError && (
                <span className="text-[11px] text-[var(--destructive)]">{combinedError}</span>
              )}
              {!combinedError && helpText(field) && (
                <span className="text-[11px] text-ink-mute">{helpText(field)}</span>
              )}
            </div>
          );
        }}
      </form.Field>
    );
  };
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

      {groupedFields.map((group) => {
        const visibleFields = group.fields.filter(visibleFieldInLiveView);
        if (visibleFields.length === 0 && !isDesignMode) return null;

        const content = (
          <div className={cn("grid gap-x-6 gap-y-5", fieldGridClass)}>
            {visibleFields.length > 0
              ? visibleFields.map((field) => (
                  <React.Fragment key={field.key}>
                    {field.sectionLabel && (
                      <div
                        className={cn(
                          "-mb-2 border-t border-hairline pt-2",
                          fieldGridClass === "grid-cols-2" ? "col-span-2" : "",
                        )}
                      >
                        <span className="text-[11px] font-medium tracking-wider text-ink-mute uppercase">
                          {i18n.language === "de" && field.sectionLabelDe
                            ? field.sectionLabelDe
                            : field.sectionLabel}
                        </span>
                      </div>
                    )}
                    {renderFieldCard(field)}
                  </React.Fragment>
                ))
              : isDesignMode && (
                  <div className="text-ink-muted col-span-full rounded-lg border border-dashed border-hairline px-3 py-4 text-[12px]">
                    {i18n.language === "de"
                      ? "Keine Felder in diesem Rahmen."
                      : "No fields in this frame."}
                  </div>
                )}
          </div>
        );

        if (group.label) {
          return (
            <fieldset
              key={group.frameId}
              className="space-y-4 rounded-lg border border-hairline bg-canvas-soft p-4 shadow-sm"
            >
              <legend className="text-ink-muted px-2 text-[12px] font-semibold tracking-wide uppercase">
                {group.label}
              </legend>
              {content}
            </fieldset>
          );
        }

        return <div key={group.frameId}>{content}</div>;
      })}

      {isDesignMode && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => addFieldDraft("New field")}
            className="text-ink-muted inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-dashed border-hairline px-3 text-[12px] transition-colors hover:border-primary/35 hover:text-primary"
          >
            <PlusIcon className="size-3.5" />
            Add field
          </button>
        </div>
      )}
    </div>
  );

  const editorField = editorFieldKey ? (fieldByKey.get(editorFieldKey) ?? null) : null;
  const editorConfig = editorFieldKey ? (designerFieldConfigs.get(editorFieldKey) ?? null) : null;
  const editorValuePath = editorField?.jsonPath ?? editorField?.key ?? editorFieldKey;
  const editorIsJsonb = !!editorField?.jsonPath && editorField.jsonPath !== editorField.key;
  const editorFrameId = editorFieldKey
    ? (delta.fieldConfigs.find((config) => config.key === editorFieldKey)?.frameKey ??
      frameNodes[0]?.id ??
      "frame:main")
    : (frameNodes[0]?.id ?? "frame:main");
  const editorFrameLabel =
    frameNodes.find((frame) => frame.id === editorFrameId)?.label ?? "Main frame";
  const editorSiblings = effectiveFields.filter(visibleFieldInLiveView);
  const editorIndex = editorFieldKey
    ? editorSiblings.findIndex((field) => field.key === editorFieldKey)
    : -1;

  const editorOverlay =
    isDesignMode && editorField && overlayStyle && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={overlayRef}
            className="pointer-events-auto rounded-2xl border border-hairline bg-canvas shadow-[0_24px_48px_rgba(13,37,61,0.18)]"
            style={overlayStyle}
          >
            <div className="flex items-start justify-between gap-3 border-b border-hairline bg-canvas-soft px-3 py-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="truncate text-[13px] font-semibold text-ink">
                    {fieldLabel(editorField)}
                  </div>
                  <span className="text-ink-muted rounded-full border border-hairline bg-canvas px-1.5 py-0.5 font-mono text-[9px]">
                    {editorField.key}
                  </span>
                </div>
                <div className="text-ink-muted mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                  <span className="rounded-full border border-hairline bg-canvas px-1.5 py-0.5">
                    {editorFrameLabel}
                  </span>
                  <span className="rounded-full border border-hairline bg-canvas px-1.5 py-0.5">
                    {editorMode}
                  </span>
                  {editorIsJsonb ? (
                    <span className="rounded-full border border-hairline bg-canvas px-1.5 py-0.5">
                      jsonb
                    </span>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditorFieldKey(null);
                  setEditorMode("compact");
                }}
                className="grid size-7 shrink-0 place-items-center rounded-full border border-hairline transition-colors hover:border-hairline-input hover:text-ink"
                title="Close field editor"
              >
                <PlusIcon className="size-3.5 rotate-45" />
              </button>
            </div>

            <div className="space-y-3 p-3">
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    updateField(editorField.key, {
                      visible: !((editorConfig?.visible ?? editorField.visible) !== false),
                    })
                  }
                  className={cn(
                    "inline-flex h-7 items-center justify-center gap-1 rounded-full border px-2 text-[11px] transition-colors",
                    (editorConfig?.visible ?? editorField.visible) !== false
                      ? "border-primary/30 bg-primary/8 text-primary"
                      : "text-ink-muted border-hairline bg-canvas",
                  )}
                >
                  {(editorConfig?.visible ?? editorField.visible) !== false ? (
                    <EyeIcon className="size-3.5" />
                  ) : (
                    <EyeOffIcon className="size-3.5" />
                  )}
                  {(editorConfig?.visible ?? editorField.visible) !== false ? "visible" : "hidden"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateField(editorField.key, { readonlyOverride: !editorField.readonly })
                  }
                  className={cn(
                    "inline-flex h-7 items-center justify-center rounded-full border px-2 text-[11px] transition-colors",
                    editorField.readonly
                      ? "border-primary/30 bg-primary/8 text-primary"
                      : "text-ink-muted border-hairline bg-canvas",
                  )}
                >
                  {editorField.readonly ? "readonly" : "editable"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateField(editorField.key, { requiredOverride: !editorField.required })
                  }
                  className={cn(
                    "inline-flex h-7 items-center justify-center rounded-full border px-2 text-[11px] transition-colors",
                    editorField.required
                      ? "border-primary/30 bg-primary/8 text-primary"
                      : "text-ink-muted border-hairline bg-canvas",
                  )}
                >
                  {editorField.required ? "required" : "optional"}
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {(["normal", "bold", "italic"] as const).map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => updateField(editorField.key, { labelStyle: style })}
                    className={cn(
                      "inline-flex h-7 items-center justify-center rounded-full border px-2 text-[11px] transition-colors",
                      (editorConfig?.labelStyle ?? "normal") === style
                        ? "border-primary/30 bg-primary/8 text-primary"
                        : "text-ink-muted border-hairline bg-canvas",
                      style === "bold" && "font-semibold",
                      style === "italic" && "italic",
                    )}
                  >
                    {style}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-4 gap-2">
                {(["default", "muted", "accent", "danger"] as const).map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    onClick={() => updateField(editorField.key, { labelTone: tone })}
                    className={cn(
                      "inline-flex h-7 items-center justify-center rounded-full border px-2 text-[11px] transition-colors",
                      (editorConfig?.labelTone ?? "default") === tone
                        ? "border-primary/30 bg-primary/8 text-primary"
                        : "text-ink-muted border-hairline bg-canvas",
                      tone === "muted" && "text-ink-muted",
                      tone === "accent" && "text-primary",
                      tone === "danger" && "text-destructive",
                    )}
                  >
                    {tone}
                  </button>
                ))}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-ink-muted text-[10px] font-semibold tracking-wide uppercase">
                    Label
                  </span>
                  <input
                    type="text"
                    value={fieldLabel(editorField)}
                    onChange={(e) =>
                      updateField(editorField.key, {
                        labelEnOverride: e.target.value,
                        labelDeOverride: e.target.value,
                      })
                    }
                    className="h-7 rounded-md border border-hairline bg-canvas px-2 text-[12px] text-ink outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-ink-muted text-[10px] font-semibold tracking-wide uppercase">
                    Backing path
                  </span>
                  <input
                    type="text"
                    value={editorValuePath ?? ""}
                    onChange={(e) =>
                      updateField(editorField.key, {
                        path: e.target.value || null,
                      })
                    }
                    className="h-7 rounded-md border border-hairline bg-canvas px-2 text-[12px] text-ink outline-none"
                    placeholder="customAttributes.delivery.postalGroup"
                  />
                </label>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-ink-muted text-[10px] font-semibold tracking-wide uppercase">
                    Frame
                  </span>
                  <select
                    value={editorFrameId}
                    onChange={(e) => moveFieldToFrame(editorField.key, e.target.value)}
                    className="h-7 rounded-md border border-hairline bg-canvas px-2 text-[12px] text-ink outline-none"
                  >
                    {frameNodes.map((frame) => (
                      <option key={frame.id} value={frame.id}>
                        {frame.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-ink-muted text-[10px] font-semibold tracking-wide uppercase">
                    Source
                  </span>
                  <select
                    value={editorIsJsonb ? "jsonb" : "schema"}
                    onChange={(e) => {
                      if (e.target.value === "jsonb") {
                        updateField(editorField.key, {
                          path: editorField.jsonPath ?? `customAttributes.${editorField.key}`,
                        });
                        return;
                      }
                      updateField(editorField.key, { path: null });
                    }}
                    className="h-7 rounded-md border border-hairline bg-canvas px-2 text-[12px] text-ink outline-none"
                  >
                    <option value="schema">Schema field</option>
                    <option value="jsonb">JSONB field</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-ink-muted text-[10px] font-semibold tracking-wide uppercase">
                    Frame Name
                  </span>
                  <input
                    type="text"
                    value={editorFrameLabel}
                    onChange={(e) => updateFrameLabel(editorFrameId, e.target.value)}
                    className="h-7 rounded-md border border-hairline bg-canvas px-2 text-[12px] text-ink outline-none"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => moveFieldToStart(editorField.key, editorFrameId)}
                  className="text-ink-muted inline-flex h-7 items-center justify-center rounded-full border border-hairline px-2 text-[11px] transition-colors disabled:opacity-40"
                >
                  Move first
                </button>
                <button
                  type="button"
                  onClick={() => moveFieldToEnd(editorField.key, editorFrameId)}
                  className="text-ink-muted inline-flex h-7 items-center justify-center rounded-full border border-hairline px-2 text-[11px] transition-colors disabled:opacity-40"
                >
                  Move end
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (editorIndex > 0) {
                      const previous = editorSiblings[editorIndex - 1];
                      if (previous) moveField(editorField.key, previous.key);
                    }
                  }}
                  disabled={editorIndex <= 0}
                  className="text-ink-muted inline-flex h-7 items-center justify-center rounded-full border border-dashed border-hairline px-2 text-[11px] transition-colors hover:border-primary/35 hover:text-primary"
                >
                  Move up
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = editorSiblings[editorIndex + 1];
                    if (next) moveField(editorField.key, next.key);
                  }}
                  disabled={editorIndex < 0 || editorIndex >= editorSiblings.length - 1}
                  className="text-ink-muted inline-flex h-7 items-center justify-center rounded-full border border-dashed border-hairline px-2 text-[11px] transition-colors hover:border-primary/35 hover:text-primary"
                >
                  Move down
                </button>
                <button
                  type="button"
                  onClick={() => addFieldDraft("New field", editorFrameId)}
                  className="text-ink-muted inline-flex h-7 items-center justify-center rounded-full border border-dashed border-hairline px-2 text-[11px] transition-colors hover:border-primary/35 hover:text-primary"
                >
                  + Field
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => addFrameDraft()}
                  className="text-ink-muted inline-flex h-7 items-center justify-center rounded-full border border-dashed border-hairline px-2 text-[11px] transition-colors hover:border-primary/35 hover:text-primary"
                >
                  + Frame
                </button>
                <button
                  type="button"
                  onClick={() => removeFieldDraft(editorField.key)}
                  className="inline-flex h-7 items-center justify-center rounded-full border border-hairline px-2 text-[11px] text-destructive transition-colors hover:border-destructive/35 hover:bg-destructive/5"
                >
                  Remove field
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => removeFrameDraft(editorFrameId)}
                  className="inline-flex h-7 items-center justify-center rounded-full border border-hairline px-2 text-[11px] text-destructive transition-colors hover:border-destructive/35 hover:bg-destructive/5"
                >
                  Remove frame
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateField(editorField.key, {
                      labelStyle: cycleLabelStyle(editorConfig?.labelStyle),
                      labelTone: cycleLabelTone(editorConfig?.labelTone),
                    });
                  }}
                  className="text-ink-muted inline-flex h-7 items-center justify-center rounded-full border border-hairline px-2 text-[11px] transition-colors hover:border-primary/35 hover:text-primary"
                >
                  Cycle style
                </button>
              </div>
              <div className="text-ink-muted text-[10px]">
                {editorField.jsonPath ? "JSONB editing enabled" : "Schema-bound field"}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  const globalErrorNode = globalError ? (
    <div className="mb-4 rounded-md bg-destructive/10 p-3 text-[13px] text-destructive">
      {globalError}
    </div>
  ) : null;

  const childSectionNode = hasChildContent ? (
    <form.Subscribe selector={(state) => state.values}>
      {(values) => (
        <div className="mt-4 border-t border-hairline pt-4">
          {childSection!(values as Record<string, unknown>, (key, val) =>
            form.setFieldValue(key as any, val),
          )}
        </div>
      )}
    </form.Subscribe>
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
        onClick={() => form.handleSubmit()}
        disabled={form.state.isSubmitting}
        className="h-7 rounded-full px-4 text-[13px] disabled:opacity-50"
        style={{ background: "var(--primary)", color: "var(--primary-fg)" }}
      >
        {form.state.isSubmitting
          ? t("form.saving")
          : recordId
            ? t("form.update")
            : t("form.create")}{" "}
        (F10)
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
        {editorOverlay}
        {childSectionNode}
        {footer}
      </div>
    );
  }

  if (embedded && childLayout === "side" && hasChildContent) {
    return (
      <div ref={formRef} className={cn("flex h-full flex-col overflow-hidden", className)}>
        <div className="flex min-h-0 flex-1 divide-x divide-hairline overflow-hidden">
          <div className="w-[40%] shrink-0 overflow-y-auto bg-canvas-soft/30 p-6">
            {title && <h2 className="mb-1 text-[18px] font-light text-ink">{title}</h2>}
            <p className="mb-4 text-[13px] text-ink-mute">{t("form.requiredHint")}</p>
            {globalError && (
              <div className="mb-4 flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-3">
                <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
                <span className="text-[12px] text-destructive/80">{globalError}</span>
              </div>
            )}
            {fieldsGrid}
            {editorOverlay}
          </div>
          <div className="flex-1 overflow-x-auto overflow-y-auto p-6">
            <form.Subscribe selector={(state) => state.values}>
              {(values) =>
                childSection!(values as Record<string, unknown>, (key, val) =>
                  form.setFieldValue(key as any, val),
                )
              }
            </form.Subscribe>
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
        {editorOverlay}
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
      {editorOverlay}
      {childSectionNode}
      {footer}
    </div>
  );
}
