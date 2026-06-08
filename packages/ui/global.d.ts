declare module "nuqs" {
  export function useQueryState<T = string>(key: string): [T | null, (value: T | null) => void];
}

declare module "posthog-js" {
  const posthog: { capture: (...args: any[]) => void };
  export default posthog;
}

declare module "agents/ai-react" {
  export type useAgentChat = any;
}

declare module "ai" {
  export type Message = any;
}

declare module "@react-email/components" {
  export const Markdown: any;
}

declare module "date-fns-tz" {
  export function format(date: Date | number, format: string): string;
}

declare module "@trpc/client" {
  export class TRPCClientError extends Error {}
}

declare module "node:assert/strict" {
  const assert: any;
  export default assert;
}

declare module "node:test" {
  const test: any;
  export default test;
}

declare module "*.css";
