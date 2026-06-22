import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus, CornerDownRight } from "lucide-react";
import { useState, useRef, useEffect } from "react";

import { executeCapability } from "../lib/capability-client";

interface BomComponent {
  bomId: string;
  componentArticleId: string;
  articleNo: string;
  name: string;
  quantity: string;
  scrapPercentage: string;
  sortOrder: number;
  unit: string | null;
}

interface ArticleSearchResult {
  articleId: string;
  articleNo: string;
  name: string;
  baseUnitCode: string | null;
}

interface BomEditorProps {
  articleId: string;
}

export function BomEditor({ articleId }: BomEditorProps) {
  const queryClient = useQueryClient();
  const [addSearch, setAddSearch] = useState("");
  const [addQty, setAddQty] = useState("1");
  const [addScrap, setAddScrap] = useState("0");
  const [addSortOrder, setAddSortOrder] = useState("");
  const [selectedComponent, setSelectedComponent] = useState<ArticleSearchResult | null>(null);
  const [searchResults, setSearchResults] = useState<ArticleSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{
    quantity: string;
    scrapPercentage: string;
    sortOrder: string;
  }>({
    quantity: "",
    scrapPercentage: "",
    sortOrder: "",
  });
  const searchRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery<{ components: BomComponent[] }>({
    queryKey: ["bom", articleId],
    queryFn: async () => {
      const res = await fetch(`/api/articles/${articleId}/bom`);
      if (!res.ok) throw new Error("Failed to fetch BOM");
      return res.json();
    },
  });

  const components = data?.components ?? [];

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (addSearch.length < 2 || selectedComponent) {
        setSearchResults([]);
        setShowDropdown(false);
        return;
      }
      const { data } = await executeCapability<{ items: unknown[] }>("masterdata.article.search", {
        q: addSearch,
        limit: 8,
      });
      setSearchResults(data.items as never[]);
      setShowDropdown(data.items.length > 0);
    }, 200);
    return () => clearTimeout(timer);
  }, [addSearch, selectedComponent]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleAdd() {
    if (!selectedComponent || !addQty) return;
    const maxSort = components.length > 0 ? Math.max(...components.map((c) => c.sortOrder)) : 0;
    const sortOrder = addSortOrder ? parseInt(addSortOrder) : maxSort + 10;

    await fetch(`/api/articles/${articleId}/bom`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        componentArticleId: selectedComponent.articleId,
        quantity: parseFloat(addQty),
        scrapPercentage: parseFloat(addScrap) || 0,
        sortOrder,
      }),
    });

    setSelectedComponent(null);
    setAddSearch("");
    setAddQty("1");
    setAddScrap("0");
    setAddSortOrder("");
    queryClient.invalidateQueries({ queryKey: ["bom", articleId] });
  }

  async function handleDelete(bomId: string) {
    await fetch(`/api/articles/${articleId}/bom/${bomId}`, { method: "DELETE" });
    queryClient.invalidateQueries({ queryKey: ["bom", articleId] });
  }

  function startEdit(c: BomComponent) {
    setEditingId(c.bomId);
    setEditValues({
      quantity: c.quantity,
      scrapPercentage: c.scrapPercentage,
      sortOrder: String(c.sortOrder),
    });
  }

  useEffect(() => {
    if (!editingId) return;
    quantityInputRef.current?.focus();
  }, [editingId]);

  async function commitEdit(bomId: string) {
    await fetch(`/api/articles/${articleId}/bom/${bomId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        quantity: parseFloat(editValues.quantity),
        scrapPercentage: parseFloat(editValues.scrapPercentage),
        sortOrder: parseInt(editValues.sortOrder),
      }),
    });
    setEditingId(null);
    queryClient.invalidateQueries({ queryKey: ["bom", articleId] });
  }

  if (isLoading) {
    return (
      <div className="flex h-24 items-center justify-center text-[13px] text-ink-mute">
        Lade Stückliste…
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-auto">
      {/* Component table */}
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr className="h-8 border-b border-hairline">
            <th className="w-[100px] px-3 py-0 text-left text-[11px] font-medium tracking-wider text-ink-mute uppercase">
              Nr.
            </th>
            <th className="px-3 py-0 text-left text-[11px] font-medium tracking-wider text-ink-mute uppercase">
              Bezeichnung
            </th>
            <th className="w-[90px] px-3 py-0 text-right text-[11px] font-medium tracking-wider text-ink-mute uppercase">
              Menge
            </th>
            <th className="w-[80px] px-3 py-0 text-right text-[11px] font-medium tracking-wider text-ink-mute uppercase">
              Ausschuss%
            </th>
            <th className="w-[70px] px-3 py-0 text-right text-[11px] font-medium tracking-wider text-ink-mute uppercase">
              Sort.
            </th>
            <th className="w-[40px]" />
          </tr>
        </thead>
        <tbody>
          {components.length === 0 && (
            <tr>
              <td colSpan={6} className="px-3 py-4 text-center text-[13px] text-ink-mute">
                Keine Komponenten erfasst.
              </td>
            </tr>
          )}
          {components.map((c) => (
            <tr
              key={c.bomId}
              className="hover:bg-surface-hover group h-9 border-b border-hairline last:border-0"
              onDoubleClick={() => startEdit(c)}
            >
              <td className="px-3 font-mono text-[13px] text-ink-mute">
                <div className="flex items-center gap-1">
                  <CornerDownRight className="h-3 w-3 flex-shrink-0 opacity-40" />
                  {c.articleNo}
                </div>
              </td>
              <td className="px-3 text-[13px]">{c.name}</td>
              {editingId === c.bomId ? (
                <>
                  <td className="px-1">
                    <Input
                      ref={quantityInputRef}
                      value={editValues.quantity}
                      onChange={(e) => setEditValues((v) => ({ ...v, quantity: e.target.value }))}
                      onBlur={() => commitEdit(c.bomId)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitEdit(c.bomId);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="h-6 text-right text-[13px]"
                    />
                  </td>
                  <td className="px-1">
                    <Input
                      value={editValues.scrapPercentage}
                      onChange={(e) =>
                        setEditValues((v) => ({ ...v, scrapPercentage: e.target.value }))
                      }
                      onBlur={() => commitEdit(c.bomId)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitEdit(c.bomId);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="h-6 text-right text-[13px]"
                    />
                  </td>
                  <td className="px-1">
                    <Input
                      value={editValues.sortOrder}
                      onChange={(e) => setEditValues((v) => ({ ...v, sortOrder: e.target.value }))}
                      onBlur={() => commitEdit(c.bomId)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitEdit(c.bomId);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="h-6 text-right text-[13px]"
                    />
                  </td>
                </>
              ) : (
                <>
                  <td className="px-3 text-right text-[13px] tabular-nums">
                    {Number(c.quantity).toLocaleString("de-DE", { maximumFractionDigits: 4 })}{" "}
                    {c.unit ?? ""}
                  </td>
                  <td className="px-3 text-right text-[13px] tabular-nums">
                    {Number(c.scrapPercentage).toLocaleString("de-DE", {
                      maximumFractionDigits: 2,
                    })}
                    %
                  </td>
                  <td className="px-3 text-right text-[13px] tabular-nums">{c.sortOrder}</td>
                </>
              )}
              <td className="px-1">
                <button
                  onClick={() => handleDelete(c.bomId)}
                  className="rounded p-1 text-destructive opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Add new component row */}
      <div className="bg-surface-subtle flex flex-shrink-0 items-end gap-2 border-t border-hairline p-3">
        <div className="relative flex-1" ref={dropdownRef}>
          <div className="mb-1 text-[11px] font-medium tracking-wider text-ink-mute uppercase">
            Komponente
          </div>
          <Input
            ref={searchRef}
            value={
              selectedComponent
                ? `${selectedComponent.articleNo} – ${selectedComponent.name}`
                : addSearch
            }
            onChange={(e) => {
              if (selectedComponent) setSelectedComponent(null);
              setAddSearch(e.target.value);
            }}
            placeholder="Artikel suchen…"
            className="h-7 text-[13px]"
          />
          {showDropdown && (
            <div className="absolute top-full right-0 left-0 z-50 mt-1 max-h-48 overflow-auto rounded border border-hairline bg-popover shadow-lg">
              {searchResults.map((r) => (
                <button
                  key={r.articleId}
                  className="hover:bg-surface-hover flex w-full gap-2 px-3 py-2 text-left text-[13px]"
                  onMouseDown={() => {
                    setSelectedComponent(r);
                    setAddSearch("");
                    setShowDropdown(false);
                  }}
                >
                  <span className="font-mono text-ink-mute">{r.articleNo}</span>
                  <span>{r.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="w-24">
          <div className="mb-1 text-[11px] font-medium tracking-wider text-ink-mute uppercase">
            Menge
          </div>
          <Input
            value={addQty}
            onChange={(e) => setAddQty(e.target.value)}
            className="h-7 text-right text-[13px]"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
          />
        </div>
        <div className="w-20">
          <div className="mb-1 text-[11px] font-medium tracking-wider text-ink-mute uppercase">
            Ausschuss%
          </div>
          <Input
            value={addScrap}
            onChange={(e) => setAddScrap(e.target.value)}
            className="h-7 text-right text-[13px]"
          />
        </div>
        <div className="w-16">
          <div className="mb-1 text-[11px] font-medium tracking-wider text-ink-mute uppercase">
            Sort.
          </div>
          <Input
            value={addSortOrder}
            onChange={(e) => setAddSortOrder(e.target.value)}
            placeholder="auto"
            className="h-7 text-right text-[13px]"
          />
        </div>
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={!selectedComponent || !addQty}
          className="h-7 flex-shrink-0 px-3"
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Hinzufügen
        </Button>
      </div>
    </div>
  );
}
