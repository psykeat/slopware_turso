import React, { createContext, useContext, useState, useCallback, useMemo } from "react";

export interface ColumnDesignConfig {
  key: string;
  visible: boolean;
  width?: string;
  pin?: "left" | "right" | null;
  order: number;
}

export interface FieldDesignConfig {
  key: string;
  visible: boolean;
  order: number;
  labelEnOverride?: string;
  labelDeOverride?: string;
  readonlyOverride?: boolean;
  requiredOverride?: boolean;
}

export interface DesignerDelta {
  /** Ordered list of column configs for the current grid entity */
  columns: ColumnDesignConfig[];
  /** Ordered list of field configs for the current form entity */
  fieldConfigs: FieldDesignConfig[];
  /** Currently dragged item id (column key or field key) */
  activeDragId: string | null;
  /** Target position id during drag */
  hoverTargetId: string | null;
}

interface DesignerContextValue {
  isDesignMode: boolean;
  toggleDesignMode: () => void;
  delta: DesignerDelta;
  updateDelta: (update: Partial<DesignerDelta>) => void;
  resetDelta: () => void;
  /** Replace a single column config */
  updateColumn: (key: string, patch: Partial<ColumnDesignConfig>) => void;
  /** Reorder columns by moving key to targetKey's position */
  moveColumn: (key: string, targetKey: string) => void;
  /** Replace a single field config */
  updateField: (key: string, patch: Partial<FieldDesignConfig>) => void;
  /** Reorder fields by moving key to targetKey's position */
  moveField: (key: string, targetKey: string) => void;
  /** Initialize columns from resolved metadata */
  initColumns: (
    cols: {
      key: string;
      header: string;
      visible?: boolean;
      width?: string;
      pin?: "left" | "right" | null;
    }[],
  ) => void;
  /** Initialize fields from resolved metadata */
  initFields: (
    fields: { key: string; visible?: boolean; labelEn?: string; labelDe?: string }[],
  ) => void;
}

const defaultDelta: DesignerDelta = {
  columns: [],
  fieldConfigs: [],
  activeDragId: null,
  hoverTargetId: null,
};

const DesignerContext = createContext<DesignerContextValue | undefined>(undefined);

export function DesignerProvider({ children }: { children: React.ReactNode }) {
  const [isDesignMode, setIsDesignMode] = useState(false);
  const [delta, setDelta] = useState<DesignerDelta>(defaultDelta);

  const toggleDesignMode = useCallback(() => {
    setIsDesignMode((prev) => !prev);
  }, []);

  const updateDelta = useCallback((update: Partial<DesignerDelta>) => {
    setDelta((prev) => ({ ...prev, ...update }));
  }, []);

  const resetDelta = useCallback(() => {
    setDelta(defaultDelta);
  }, []);

  const updateColumn = useCallback((key: string, patch: Partial<ColumnDesignConfig>) => {
    setDelta((prev) => ({
      ...prev,
      columns: prev.columns.map((c) => (c.key === key ? { ...c, ...patch } : c)),
    }));
  }, []);

  const moveColumn = useCallback((key: string, targetKey: string) => {
    setDelta((prev) => {
      const cols = [...prev.columns];
      const fromIdx = cols.findIndex((c) => c.key === key);
      const toIdx = cols.findIndex((c) => c.key === targetKey);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev;
      const [removed] = cols.splice(fromIdx, 1);
      cols.splice(toIdx, 0, removed);
      return { ...prev, columns: cols.map((c, i) => ({ ...c, order: i })) };
    });
  }, []);

  const updateField = useCallback((key: string, patch: Partial<FieldDesignConfig>) => {
    setDelta((prev) => ({
      ...prev,
      fieldConfigs: prev.fieldConfigs.map((f) => (f.key === key ? { ...f, ...patch } : f)),
    }));
  }, []);

  const moveField = useCallback((key: string, targetKey: string) => {
    setDelta((prev) => {
      const fields = [...prev.fieldConfigs];
      const fromIdx = fields.findIndex((f) => f.key === key);
      const toIdx = fields.findIndex((f) => f.key === targetKey);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev;
      const [removed] = fields.splice(fromIdx, 1);
      fields.splice(toIdx, 0, removed);
      return { ...prev, fieldConfigs: fields.map((f, i) => ({ ...f, order: i })) };
    });
  }, []);

  const initColumns = useCallback(
    (
      cols: {
        key: string;
        header: string;
        visible?: boolean;
        width?: string;
        pin?: "left" | "right" | null;
      }[],
    ) => {
      setDelta((prev) => {
        // Preserve existing draft if it was already initialized for the same set
        const existing = prev.columns;
        const existingKeys = new Set(existing.map((c) => c.key));
        const incomingKeys = new Set(cols.map((c) => c.key));
        const sameSet =
          existingKeys.size === incomingKeys.size &&
          [...incomingKeys].every((k) => existingKeys.has(k));
        if (sameSet && existing.length > 0) return prev;

        return {
          ...prev,
          columns: cols.map((c, i) => ({
            key: c.key,
            visible: c.visible !== false,
            width: c.width,
            pin: c.pin ?? null,
            order: i,
          })),
        };
      });
    },
    [],
  );

  const initFields = useCallback(
    (fields: { key: string; visible?: boolean; labelEn?: string; labelDe?: string }[]) => {
      setDelta((prev) => {
        const existing = prev.fieldConfigs;
        const existingKeys = new Set(existing.map((f) => f.key));
        const incomingKeys = new Set(fields.map((f) => f.key));
        const sameSet =
          existingKeys.size === incomingKeys.size &&
          [...incomingKeys].every((k) => existingKeys.has(k));
        if (sameSet && existing.length > 0) return prev;

        return {
          ...prev,
          fieldConfigs: fields.map((f, i) => ({
            key: f.key,
            visible: f.visible !== false,
            order: i,
            labelEnOverride: f.labelEn,
            labelDeOverride: f.labelDe,
          })),
        };
      });
    },
    [],
  );

  const value = useMemo(
    () => ({
      isDesignMode,
      toggleDesignMode,
      delta,
      updateDelta,
      resetDelta,
      updateColumn,
      moveColumn,
      updateField,
      moveField,
      initColumns,
      initFields,
    }),
    [
      isDesignMode,
      toggleDesignMode,
      delta,
      updateDelta,
      resetDelta,
      updateColumn,
      moveColumn,
      updateField,
      moveField,
      initColumns,
      initFields,
    ],
  );

  return <DesignerContext.Provider value={value}>{children}</DesignerContext.Provider>;
}

export function useDesigner() {
  const context = useContext(DesignerContext);
  if (!context) {
    throw new Error("useDesigner must be used within a DesignerProvider");
  }
  return context;
}
