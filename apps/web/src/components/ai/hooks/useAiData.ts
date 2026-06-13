import { useQuery } from "@tanstack/react-query";

import { entityList } from "#/lib/entity-capabilities";

export function useAddresses() {
  return useQuery({
    queryKey: ["ai-all-addresses"],
    queryFn: () => entityList("address").catch(() => []),
    staleTime: 5 * 60 * 1000,
  });
}

export function useDocuments() {
  return useQuery({
    queryKey: ["ai-all-documents"],
    queryFn: () =>
      entityList("document", {}, { limit: 100, orderBy: "documentNo:asc" }).catch(() => []),
    staleTime: 5 * 60 * 1000,
  });
}
