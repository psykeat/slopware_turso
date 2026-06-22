import {
  capabilityDescriptor,
  capabilityInputJsonSchema,
  capabilityOutputJsonSchema,
  executeCapability,
  getCapability,
  listCapabilities,
  toCapabilityRole,
  type AnyCapability,
  type CapabilityResult,
  type ExecutionContext,
} from "../capabilities";
import type {
  CapabilityInput,
  CapabilityKey,
  CapabilityMeta,
  CapabilityOutput,
} from "../capabilities";

export type ActionResult<T = any> = CapabilityResult<T>;
export type ActionExecutionContext = ExecutionContext;
export type AnyRegistryBackedAction = AnyCapability;
export type ActionInput<K extends CapabilityKey> = CapabilityInput<K>;
export type ActionKey = CapabilityKey;
export type ActionMeta = CapabilityMeta;
export type ActionOutput<K extends CapabilityKey> = CapabilityOutput<K>;
export { toCapabilityRole };

export function getAction(key: string): AnyRegistryBackedAction | undefined {
  return getCapability(key);
}

export function listActions(
  filter?: Parameters<typeof listCapabilities>[0],
): AnyRegistryBackedAction[] {
  return listCapabilities(filter);
}

export function actionDescriptor(
  action: AnyRegistryBackedAction,
  options?: Parameters<typeof capabilityDescriptor>[1],
) {
  return capabilityDescriptor(action, options);
}

export function actionInputJsonSchema(action: AnyRegistryBackedAction): Record<string, unknown> {
  return capabilityInputJsonSchema(action) as Record<string, unknown>;
}

export function actionOutputJsonSchema(action: AnyRegistryBackedAction): Record<string, unknown> {
  return capabilityOutputJsonSchema(action) as Record<string, unknown>;
}

export async function executeAction<T = any>(
  key: string,
  ctx: ActionExecutionContext,
  input: unknown,
): Promise<ActionResult<T>> {
  return executeCapability<T>(key, ctx, input);
}
