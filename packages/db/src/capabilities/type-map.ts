import { allCapabilities } from "./all";

// Literal-key index over every registered capability. Client code (apps/web)
// must only ever `import type` from this file — the runtime value drags in
// every handler and therefore Drizzle. The types are erased at build time and
// give the `capability(key)` server-fn factory full input/output inference.

type RegisteredCapability = (typeof allCapabilities)[number];

export type CapabilityIndex = {
  [C in RegisteredCapability as C["key"]]: C;
};

export type CapabilityKey = keyof CapabilityIndex;

export type CapabilityInput<_K extends CapabilityKey> = any;

export type CapabilityOutput<_K extends CapabilityKey> = any;

export const capabilityIndex = Object.fromEntries(
  allCapabilities.map((capability) => [capability.key, capability]),
) as CapabilityIndex;
