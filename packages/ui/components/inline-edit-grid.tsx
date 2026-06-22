import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, CheckIcon, XIcon, PencilIcon, Trash2Icon } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { entityDelete, entityList, entitySave } from "../lib/entity-capabilities";
import { cn } from "../lib/utils";

export interface InlineColumnDef {
  key: string;
  header: string;
  type?: "text" | "number" | "boolean";
  required?: boolean;
  width?: string;
}

export interface InlineEditGridProps {
  entityName: string;
  parentKey: Record<string, string>;
  keyColumn: string;
  columns: InlineColumnDef[];
  className?: string;
  onRowSelect?: (row: Record<string, any> | null) => void;
  labels?: Partial<{
    add: string;
    edit: string;
    save: string;
    cancel: string;
    delete: string;
    empty: string;
    records: (count: number) => string;
  }>;
}

const NEW_ROW_ID = "__new__";

export function InlineEditGrid({
  entityName,
  parentKey,
  keyColumn,
  columns,
  className,
  onRowSelect,
  labels,
}: InlineEditGridProps) {
  const queryClient = useQueryClient();
  const parentKeySignature = JSON.stringify(parentKey);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Record<string, any>>({});
  const firstEditInputRef = useRef<HTMLInputElement>(null);
  const selectedIdRef = useRef<string | null>(null);

  const { data: rows = [] } = useQuery({
    queryKey: ["data", entityName, parentKeySignature, parentKey],
    queryFn: () => entityList<Record<string, any>>(entityName, parentKey),
    enabled: Object.values(parentKey).every(Boolean),
  });

  const saveMutation = useMutation({
    mutationFn: (data: Record<string, any>) => {
      const isNew = editingId === NEW_ROW_ID;
      return entitySave(
        entityName,
        isNew ? null : editingId,
        isNew ? { ...parentKey, ...data } : data,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data", entityName] });
      setEditingId(null);
      setEditData({});
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => entityDelete(entityName, id),
    onSuccess: (_result, deletedId) => {
      if (selectedIdRef.current === deletedId) {
        setSelectedId(null);
        onRowSelect?.(null);
      }
      queryClient.invalidateQueries({ queryKey: ["data", entityName] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const startEdit = (row: any) => {
    const nextId = row[keyColumn];
    setSelectedId(nextId);
    onRowSelect?.(row);
    setEditingId(nextId);
    setEditData({ ...row });
  };

  const startNew = () => {
    setSelectedId(null);
    onRowSelect?.(null);
    setEditingId(NEW_ROW_ID);
    setEditData({});
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    if (!editingId) return;
    firstEditInputRef.current?.focus();
  }, [editingId]);

  const allRows = editingId === NEW_ROW_ID ? [...rows, { [keyColumn]: NEW_ROW_ID }] : rows;
  const addLabel = labels?.add ?? "Add";
  const editLabel = labels?.edit ?? "Edit";
  const saveLabel = labels?.save ?? "Save";
  const cancelLabel = labels?.cancel ?? "Cancel";
  const deleteLabel = labels?.delete ?? "Delete";
  const emptyLabel = labels?.empty ?? "No records yet.";
  const recordCountLabel =
    rows.length > 0
      ? (labels?.records?.(rows.length) ?? `${rows.length} record${rows.length !== 1 ? "s" : ""}`)
      : "";

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div className="flex shrink-0 items-center justify-between border-b border-hairline px-3 py-1.5">
        <span className="text-[11px] font-medium text-ink-mute">{recordCountLabel}</span>
        <button
          onClick={startNew}
          disabled={editingId !== null}
          className="hover:bg-surface-hover flex h-6 items-center gap-1 rounded px-2 text-[12px] text-ink-secondary transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          <PlusIcon className="size-3" />
          {addLabel}
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="h-8 border-b border-hairline">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-3 py-0 text-left text-[11px] font-medium tracking-wider whitespace-nowrap text-ink-mute uppercase"
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.header}
                </th>
              ))}
              <th className="w-16 shrink-0" />
            </tr>
          </thead>
          <tbody>
            {allRows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="py-10 text-center text-[13px] text-ink-mute"
                >
                  {emptyLabel}
                </td>
              </tr>
            )}
            {allRows.map((row: any) => {
              const id = row[keyColumn];
              const isEditing = id === editingId;
              const isSelected = id === selectedId;

              return (
                <tr
                  key={id}
                  className={cn(
                    "group border-b border-hairline last:border-0",
                    isEditing || isSelected
                      ? "bg-surface-hover cursor-pointer"
                      : "hover:bg-surface-hover/50 cursor-pointer",
                  )}
                  onClick={!isEditing ? () => startEdit(row) : undefined}
                >
                  {columns.map((col, i) => (
                    <td key={col.key} className="px-3 py-1.5 text-[13px]">
                      {isEditing ? (
                        col.type === "boolean" ? (
                          <input
                            type="checkbox"
                            checked={!!editData[col.key]}
                            onChange={(e) =>
                              setEditData((d) => ({ ...d, [col.key]: e.target.checked }))
                            }
                            className="size-4 rounded border-hairline-input accent-primary"
                          />
                        ) : (
                          <input
                            type={col.type === "number" ? "number" : "text"}
                            value={editData[col.key] ?? ""}
                            ref={i === 0 ? firstEditInputRef : undefined}
                            onChange={(e) =>
                              setEditData((d) => ({ ...d, [col.key]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Escape") {
                                e.stopPropagation();
                                cancelEdit();
                              }
                            }}
                            className="h-7 w-full min-w-[80px] rounded border border-hairline-input bg-canvas px-2 text-[13px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                          />
                        )
                      ) : col.type === "boolean" ? (
                        <span className="text-ink-mute">{row[col.key] ? "✓" : "—"}</span>
                      ) : (
                        <span className="block max-w-[200px] truncate">{row[col.key] ?? "—"}</span>
                      )}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            saveMutation.mutate(editData);
                          }}
                          disabled={saveMutation.isPending}
                          className="flex size-6 items-center justify-center rounded text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                          title={saveLabel}
                        >
                          <CheckIcon className="size-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            cancelEdit();
                          }}
                          className="hover:bg-surface-hover flex size-6 items-center justify-center rounded text-ink-mute transition-colors hover:text-ink"
                          title={cancelLabel}
                        >
                          <XIcon className="size-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEdit(row);
                          }}
                          className="hover:bg-surface-hover flex size-6 items-center justify-center rounded text-ink-mute transition-colors hover:text-ink"
                          title={editLabel}
                        >
                          <PencilIcon className="size-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteMutation.mutate(id);
                          }}
                          disabled={deleteMutation.isPending}
                          className="flex size-6 items-center justify-center rounded text-ink-mute transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                          title={deleteLabel}
                        >
                          <Trash2Icon className="size-3" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
