export default function useComposeEditor(_options?: any) {
  return {
    commands: {
      clearContent: (_force?: boolean) => {},
      setContent: (_value: unknown) => {},
      focus: (_pos?: string) => {},
    },
    getText: () => "",
    getHTML: () => "",
    chain: () => ({ focus: (_pos?: string) => ({ run: () => {} }) }),
  } as any;
}
