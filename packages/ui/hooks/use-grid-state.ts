import { useState, useMemo } from "react";

export type FilterOp =
  | "contains" | "not_contains" | "eq" | "neq"
  | "starts_with" | "ends_with"
  | "gt" | "gte" | "lt" | "lte"
  | "is_empty" | "is_not_empty" | "in";

export interface FilterRule {
  id: string;
  col: string;
  op: FilterOp;
  val: string;
}

export interface GridSort {
  key: string;
  dir: "asc" | "desc";
}

export interface GridState {
  page: number;
  pageSize: number;
  sort: GridSort | null;
  search: string;
  filters: FilterRule[];
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setSort: (sort: GridSort | null) => void;
  setSearch: (search: string) => void;
  setFilters: (filters: FilterRule[]) => void;
  queryParams: {
    page: number;
    limit: number;
    orderBy: string | undefined;
    search: string | undefined;
    filters: FilterRule[] | undefined;
  };
}

export function useGridState(options?: { defaultPageSize?: number }): GridState {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(options?.defaultPageSize ?? 50);
  const [sort, setSort] = useState<GridSort | null>(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterRule[]>([]);

  const setPageSize_ = (s: number) => { setPageSize(s); setPage(1); };
  const setSort_ = (s: GridSort | null) => { setSort(s); setPage(1); };
  const setSearch_ = (s: string) => { setSearch(s); setPage(1); };
  const setFilters_ = (f: FilterRule[]) => { setFilters(f); setPage(1); };

  const queryParams = useMemo(() => ({
    page,
    limit: pageSize,
    orderBy: sort ? `${sort.key}:${sort.dir}` : undefined,
    search: search || undefined,
    filters: filters.length > 0 ? filters : undefined,
  }), [page, pageSize, sort, search, filters]);

  return {
    page, pageSize, sort, search, filters,
    setPage, setPageSize: setPageSize_, setSort: setSort_,
    setSearch: setSearch_, setFilters: setFilters_,
    queryParams,
  };
}
