export type FilterOp =
  | "contains"
  | "not_contains"
  | "eq"
  | "neq"
  | "starts_with"
  | "ends_with"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "is_empty"
  | "is_not_empty"
  | "in";

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
