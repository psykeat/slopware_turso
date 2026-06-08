import { useQuery } from "@tanstack/react-query";

export function useAddresses() {
  return useQuery({
    queryKey: ["ai-all-addresses"],
    queryFn: async () => {
      const res = await fetch("/api/data/address");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useDocuments() {
  return useQuery({
    queryKey: ["ai-all-documents"],
    queryFn: async () => {
      const res = await fetch("/api/data/document?limit=100&orderBy=documentNo:asc");
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : (data?.data ?? []);
    },
    staleTime: 5 * 60 * 1000,
  });
}
