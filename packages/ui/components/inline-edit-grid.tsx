import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, CheckIcon, XIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { cn } from "../lib/utils";
import { toast } from "sonner";

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
}

const NEW_ROW_ID = "__new__";

export function InlineEditGrid({
  entityName,
  parentKey,
  keyColumn,
  columns,
  className,
}: InlineEditGridProps) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Record<string, any>>({});

  const { data: rows = [] } = useQuery({
    queryKey: ["data", entityName, JSON.stringify(parentKey)],
    queryFn: async () => {
      const params = Object.entries(parentKey)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join("&");
      const res = await fetch(`/api/data/${entityName}?${params}`);
      return res.ok ? res.json() : [];
    },
    enabled: Object.values(parentKey).every(Boolean),
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const isNew = editingId === NEW_ROW_ID;
      const url = isNew
        ? `/api/data/${entityName}`
        : `/api/data/${entityName}/${editingId}`;
      const body = isNew ? { ...parentKey, ...data } : data;
      const res = await fetch(url, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data", entityName] });
      setEditingId(null);
      setEditData({});
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/data/${entityName}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true }),
      });
      if (!res.ok) throw new Error(`Archive failed: ${res.status}`);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["data", entityName] }),
    onError: (err: Error) => toast.error(err.message),
  });

  const startEdit = (row: any) => {
    setEditingId(row[keyColumn]);
    setEditData({ ...row });
  };

  const startNew = () => {
    setEditingId(NEW_ROW_ID);
    setEditData({});
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  const allRows =
    editingId === NEW_ROW_ID ? [...rows, { [keyColumn]: NEW_ROW_ID }] : rows;

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-hairline shrink-0">
        <span className="text-[11px] font-medium text-ink-mute">
          {rows.length > 0 ? `${rows.length} record${rows.length !== 1 ? "s" : ""}` : ""}
        </span>
        <button
          onClick={startNew}
          disabled={editingId !== null}
          className="flex items-center gap-1 h-6 px-2 rounded text-[12px] text-ink-secondary hover:text-ink hover:bg-surface-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <PlusIcon className="size-3" />
          Add
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="h-8 border-b border-hairline">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="text-left text-[11px] font-medium text-ink-mute uppercase tracking-wider px-3 py-0 whitespace-nowrap"
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
                  className="text-center text-[13px] text-ink-mute py-10"
                >
                  No records yet.
                </td>
              </tr>
            )}
            {allRows.map((row: any) => {
              const id = row[keyColumn];
              const isEditing = id === editingId;

              return (
                <tr
                  key={id}
                  className={cn(
                    "border-b border-hairline last:border-0 group",
                    isEditing
                      ? "bg-surface-hover"
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
                            autoFocus={i === 0}
                            onChange={(e) =>
                              setEditData((d) => ({ ...d, [col.key]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Escape") { e.stopPropagation(); cancelEdit(); }
                            }}
                            className="h-7 w-full min-w-[80px] border border-hairline-input bg-canvas rounded px-2 text-[13px] outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          />
                        )
                      ) : col.type === "boolean" ? (
                        <span className="text-ink-mute">{row[col.key] ? "✓" : "—"}</span>
                      ) : (
                        <span className="truncate max-w-[200px] block">
                          {row[col.key] ?? "—"}
                        </span>
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
                          className="size-6 flex items-center justify-center rounded hover:bg-primary/10 text-primary transition-colors disabled:opacity-50"
                          title="Save"
                        >
                          <CheckIcon className="size-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            cancelEdit();
                          }}
                          className="size-6 flex items-center justify-center rounded hover:bg-surface-hover text-ink-mute hover:text-ink transition-colors"
                          title="Cancel"
                        >
                          <XIcon className="size-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEdit(row);
                          }}
                          className="size-6 flex items-center justify-center rounded hover:bg-surface-hover text-ink-mute hover:text-ink transition-colors"
                          title="Edit"
                        >
                          <PencilIcon className="size-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            archiveMutation.mutate(id);
                          }}
                          disabled={archiveMutation.isPending}
                          className="size-6 flex items-center justify-center rounded hover:bg-destructive/10 text-ink-mute hover:text-destructive transition-colors disabled:opacity-50"
                          title="Delete"
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
