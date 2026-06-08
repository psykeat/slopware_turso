import { createContext, useContext, type PropsWithChildren } from "react";

const TRPCContext = createContext<any>(null);

const trpcStub = {
  mail: {
    send: {
      mutationOptions: () => ({ mutationFn: async (value: unknown) => value }),
    },
  },
  templates: {
    create: {
      mutationOptions: () => ({ mutationFn: async (value: unknown) => value }),
    },
    delete: {
      mutationOptions: () => ({ mutationFn: async (value: unknown) => value }),
    },
    list: {
      queryKey: () => ["templates", "list"],
    },
  },
};

export function useTRPC() {
  return useContext(TRPCContext) ?? trpcStub;
}

export function TRPCProvider({ children }: PropsWithChildren) {
  return <TRPCContext.Provider value={trpcStub}>{children}</TRPCContext.Provider>;
}
