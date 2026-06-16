import { useCapabilityQuery } from "#/queries/capability";

export function useAddresses() {
  return useCapabilityQuery(
    "masterdata.address.list",
    {},
    {
      select: (data) => data.items,
      staleTime: 5 * 60 * 1000,
    },
  );
}

export function useDocuments() {
  return useCapabilityQuery(
    "sales.document.list",
    { limit: 100, orderBy: "documentNo:asc" },
    {
      select: (data) => data.items,
      staleTime: 5 * 60 * 1000,
    },
  );
}
