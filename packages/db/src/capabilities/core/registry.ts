import type { AnyCapability, CapabilityModule, LlmExposure } from "./types";

const capabilities = new Map<string, AnyCapability>();

function assertUniqueCapabilities(definitions: AnyCapability[]) {
  const incoming = new Set<string>();
  for (const definition of definitions) {
    if (incoming.has(definition.key)) {
      throw new Error(`Duplicate capability key "${definition.key}"`);
    }
    incoming.add(definition.key);
  }
}

export function registerCapabilities(...definitions: AnyCapability[]) {
  assertUniqueCapabilities(definitions);
  for (const definition of definitions) {
    if (capabilities.has(definition.key)) {
      throw new Error(`Duplicate capability key "${definition.key}"`);
    }
    capabilities.set(definition.key, definition);
  }
}

export function replaceCapabilities(...definitions: AnyCapability[]) {
  assertUniqueCapabilities(definitions);
  capabilities.clear();
  for (const definition of definitions) {
    capabilities.set(definition.key, definition);
  }
}

export function getCapability(key: string): AnyCapability | undefined {
  return capabilities.get(key);
}

export function listCapabilities(filter?: {
  module?: CapabilityModule;
  entityName?: string;
  llm?: LlmExposure[];
  httpOnly?: boolean;
}): AnyCapability[] {
  let result = [...capabilities.values()];
  if (filter?.module) result = result.filter((c) => c.module === filter.module);
  if (filter?.entityName) result = result.filter((c) => c.entityName === filter.entityName);
  if (filter?.llm) result = result.filter((c) => filter.llm!.includes(c.exposure.llm));
  if (filter?.httpOnly) result = result.filter((c) => c.exposure.http);
  return result.sort((a, b) => a.key.localeCompare(b.key));
}
