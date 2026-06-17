import { allCapabilities } from "./all";
import { replaceCapabilities } from "./core/registry";

// Static registration: a capability exists exactly when its module is part of
// the aggregation in all.ts, so the registry can never drift from the code.
// Dev SSR can re-evaluate this module while keeping registry.ts cached; replace
// the static set so hot reloads are idempotent without masking duplicates in
// the incoming capability list.
replaceCapabilities(...allCapabilities);

export { allCapabilities } from "./all";
export { executeCapability } from "./core/execute";
export { getCapability, listCapabilities } from "./core/registry";
export { defineCapability } from "./core/define";
export {
  capabilityDescriptor,
  capabilityInputJsonSchema,
  capabilityOutputJsonSchema,
} from "./core/json-schema";
export { CapabilityError, toCapabilityRole } from "./core/types";
export type {
  ActorMode,
  AnyCapability,
  CapabilityAiProjection,
  CapabilityDefinition,
  CapabilityErrorCode,
  CapabilityIssue,
  CapabilityKind,
  CapabilityMeta,
  CapabilityModule,
  CapabilityResult,
  CapabilityRole,
  ExecutionContext,
  LlmExposure,
} from "./core/types";
export { capabilityIndex } from "./type-map";
export type { CapabilityIndex, CapabilityKey, CapabilityInput, CapabilityOutput } from "./type-map";
