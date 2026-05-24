import type { GridSort, GridState, FilterRule } from "@repo/ui/types/grid";
import { useState, useEffect, useMemo, useCallback } from "react";

function pk(prefix: string, key: string) {
  return prefix ? `${prefix}_${key}` : key;
}

export function useGridUrlState(options?: {
  defaultPageSize?: number;
  prefix?: string;
}): GridState {
  const prefix = options?.prefix ?? "";
  const defaultSize = options?.defaultPageSize ?? 50;

  const readFromUrl = (): {
    page: number;
    pageSize: number;
    sort: GridSort | null;
    search: string;
    filters: FilterRule[];
  } => {
    if (typeof window === "undefined")
      return { page: 1, pageSize: defaultSize, sort: null, search: "", filters: [] };
    const p = new URLSearchParams(window.location.search);
    const page = Math.max(1, Number(p.get(pk(prefix, "page")) ?? "1") || 1);
    const pageSize = Number(p.get(pk(prefix, "size")) ?? String(defaultSize)) || defaultSize;
    const sortStr = p.get(pk(prefix, "sort"));
    const sort: GridSort | null = sortStr
      ? (() => {
          const [key, dir] = sortStr.split(":");
          return key ? { key, dir: (dir === "desc" ? "desc" : "asc") as "asc" | "desc" } : null;
        })()
      : null;
    const search = p.get(pk(prefix, "q")) ?? "";
    const filtersStr = p.get(pk(prefix, "f"));
    const filters: FilterRule[] = filtersStr
      ? (() => {
          try {
            return JSON.parse(filtersStr);
          } catch {
            return [];
          }
        })()
      : [];
    return { page, pageSize, sort, search, filters };
  };

  const init = readFromUrl();
  const [page, setPage_] = useState(init.page);
  const [pageSize, setPageSize_] = useState(init.pageSize);
  const [sort, setSort_] = useState<GridSort | null>(init.sort);
  const [search, setSearch_] = useState(init.search);
  const [filters, setFilters_] = useState<FilterRule[]>(init.filters);

  // Write state to URL (replaceState — no history entry, shareable link)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const set = (k: string, v: string | undefined) =>
      v ? p.set(pk(prefix, k), v) : p.delete(pk(prefix, k));
    set("page", page > 1 ? String(page) : undefined);
    set("size", pageSize !== defaultSize ? String(pageSize) : undefined);
    set("sort", sort ? `${sort.key}:${sort.dir}` : undefined);
    set("q", search || undefined);
    set("f", filters.length > 0 ? JSON.stringify(filters) : undefined);
    const qs = p.toString();
    history.replaceState(
      null,
      "",
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
    );
  }, [page, pageSize, sort, search, filters, prefix, defaultSize]);

  const setPage = useCallback((p: number) => setPage_(p), []);
  const setPageSize = useCallback((s: number) => {
    setPageSize_(s);
    setPage_(1);
  }, []);
  const setSort = useCallback((s: GridSort | null) => {
    setSort_(s);
    setPage_(1);
  }, []);
  const setSearch = useCallback((s: string) => {
    setSearch_(s);
    setPage_(1);
  }, []);
  const setFilters = useCallback((f: FilterRule[]) => {
    setFilters_(f);
    setPage_(1);
  }, []);

  const queryParams = useMemo(
    () => ({
      page,
      limit: pageSize,
      orderBy: sort ? `${sort.key}:${sort.dir}` : undefined,
      search: search || undefined,
      filters: filters.length > 0 ? filters : undefined,
    }),
    [page, pageSize, sort, search, filters],
  );

  return useMemo(
    () => ({
      page,
      pageSize,
      sort,
      search,
      filters,
      setPage,
      setPageSize,
      setSort,
      setSearch,
      setFilters,
      queryParams,
    }),
    [
      page,
      pageSize,
      sort,
      search,
      filters,
      setPage,
      setPageSize,
      setSort,
      setSearch,
      setFilters,
      queryParams,
    ],
  );
}
