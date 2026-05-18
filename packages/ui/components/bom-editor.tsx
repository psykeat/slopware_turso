import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus, CornerDownRight } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";

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
  baseUnit: string | null;
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
  const [editValues, setEditValues] = useState<{ quantity: string; scrapPercentage: string; sortOrder: string }>({
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
      const res = await fetch(`/api/articles/search?q=${encodeURIComponent(addSearch)}&limit=8`);
      if (!res.ok) return;
      const results = await res.json();
      setSearchResults(results);
      setShowDropdown(results.length > 0);
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
      <div className="flex items-center justify-center h-24 text-[13px] text-ink-mute">
        Lade Stückliste…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Component table */}
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr className="h-8 border-b border-hairline">
            <th className="text-[11px] uppercase tracking-wider font-medium text-ink-mute text-left px-3 py-0 w-[100px]">Nr.</th>
            <th className="text-[11px] uppercase tracking-wider font-medium text-ink-mute text-left px-3 py-0">Bezeichnung</th>
            <th className="text-[11px] uppercase tracking-wider font-medium text-ink-mute text-right px-3 py-0 w-[90px]">Menge</th>
            <th className="text-[11px] uppercase tracking-wider font-medium text-ink-mute text-right px-3 py-0 w-[80px]">Ausschuss%</th>
            <th className="text-[11px] uppercase tracking-wider font-medium text-ink-mute text-right px-3 py-0 w-[70px]">Sort.</th>
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
              className="h-9 border-b border-hairline last:border-0 hover:bg-surface-hover group"
              onDoubleClick={() => startEdit(c)}
            >
              <td className="px-3 text-[13px] font-mono text-ink-mute">
                <div className="flex items-center gap-1">
                  <CornerDownRight className="w-3 h-3 opacity-40 flex-shrink-0" />
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
                      onKeyDown={(e) => { if (e.key === "Enter") commitEdit(c.bomId); if (e.key === "Escape") setEditingId(null); }}
                      className="h-6 text-[13px] text-right"
                    />
                  </td>
                  <td className="px-1">
                    <Input
                      value={editValues.scrapPercentage}
                      onChange={(e) => setEditValues((v) => ({ ...v, scrapPercentage: e.target.value }))}
                      onBlur={() => commitEdit(c.bomId)}
                      onKeyDown={(e) => { if (e.key === "Enter") commitEdit(c.bomId); if (e.key === "Escape") setEditingId(null); }}
                      className="h-6 text-[13px] text-right"
                    />
                  </td>
                  <td className="px-1">
                    <Input
                      value={editValues.sortOrder}
                      onChange={(e) => setEditValues((v) => ({ ...v, sortOrder: e.target.value }))}
                      onBlur={() => commitEdit(c.bomId)}
                      onKeyDown={(e) => { if (e.key === "Enter") commitEdit(c.bomId); if (e.key === "Escape") setEditingId(null); }}
                      className="h-6 text-[13px] text-right"
                    />
                  </td>
                </>
              ) : (
                <>
                  <td className="px-3 text-[13px] tabular-nums text-right">{Number(c.quantity).toLocaleString("de-DE", { maximumFractionDigits: 4 })} {c.unit ?? ""}</td>
                  <td className="px-3 text-[13px] tabular-nums text-right">{Number(c.scrapPercentage).toLocaleString("de-DE", { maximumFractionDigits: 2 })}%</td>
                  <td className="px-3 text-[13px] tabular-nums text-right">{c.sortOrder}</td>
                </>
              )}
              <td className="px-1">
                <button
                  onClick={() => handleDelete(c.bomId)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded text-destructive hover:bg-destructive/10 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Add new component row */}
      <div className="border-t border-hairline p-3 flex items-end gap-2 bg-surface-subtle flex-shrink-0">
        <div className="flex-1 relative" ref={dropdownRef}>
          <div className="text-[11px] uppercase tracking-wider font-medium text-ink-mute mb-1">Komponente</div>
          <Input
            ref={searchRef}
            value={selectedComponent ? `${selectedComponent.articleNo} – ${selectedComponent.name}` : addSearch}
            onChange={(e) => {
              if (selectedComponent) setSelectedComponent(null);
              setAddSearch(e.target.value);
            }}
            placeholder="Artikel suchen…"
            className="h-7 text-[13px]"
          />
          {showDropdown && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-popover border border-hairline rounded shadow-lg z-50 max-h-48 overflow-auto">
              {searchResults.map((r) => (
                <button
                  key={r.articleId}
                  className="w-full text-left px-3 py-2 text-[13px] hover:bg-surface-hover flex gap-2"
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
          <div className="text-[11px] uppercase tracking-wider font-medium text-ink-mute mb-1">Menge</div>
          <Input
            value={addQty}
            onChange={(e) => setAddQty(e.target.value)}
            className="h-7 text-[13px] text-right"
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          />
        </div>
        <div className="w-20">
          <div className="text-[11px] uppercase tracking-wider font-medium text-ink-mute mb-1">Ausschuss%</div>
          <Input
            value={addScrap}
            onChange={(e) => setAddScrap(e.target.value)}
            className="h-7 text-[13px] text-right"
          />
        </div>
        <div className="w-16">
          <div className="text-[11px] uppercase tracking-wider font-medium text-ink-mute mb-1">Sort.</div>
          <Input
            value={addSortOrder}
            onChange={(e) => setAddSortOrder(e.target.value)}
            placeholder="auto"
            className="h-7 text-[13px] text-right"
          />
        </div>
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={!selectedComponent || !addQty}
          className="h-7 px-3 flex-shrink-0"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Hinzufügen
        </Button>
      </div>
    </div>
  );
}
