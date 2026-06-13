import { chat, maxIterations, type StreamChunk } from "@tanstack/ai";
import type { AnthropicChatModel } from "@tanstack/ai-anthropic";
import { createAnthropicChat } from "@tanstack/ai-anthropic";
import { GeminiTextAdapter, createGeminiChat } from "@tanstack/ai-gemini";
import type { GeminiTextModel } from "@tanstack/ai-gemini";
import type { OpenAIChatModel } from "@tanstack/ai-openai";
import { createOpenaiChat } from "@tanstack/ai-openai";
import { createOpenRouterText } from "@tanstack/ai-openrouter";

type AgentChatOptions = Omit<Parameters<typeof chat>[0], "adapter" | "stream">;

export type SupportedLlmProvider =
  | "openai"
  | "anthropic"
  | "openrouter"
  | "google_ai_studio"
  | "vertex_ai";

export interface AgentProvider {
  chat(options: AgentChatOptions): Promise<unknown>;
  stream(options: AgentChatOptions): AsyncIterable<StreamChunk>;
}

export interface GeminiProviderConfig {
  apiKey?: string;
  model?: string;
  endpointUrl?: string;
  vertexProject?: string;
  vertexLocation?: string;
  vertexCredentials?: string;
}

export interface OpenAIProviderConfig {
  apiKey?: string;
  model?: string;
  endpointUrl?: string;
}

export interface AnthropicProviderConfig {
  apiKey?: string;
  model?: string;
  endpointUrl?: string;
}

export interface OpenRouterProviderConfig {
  apiKey?: string;
  model?: string;
  endpointUrl?: string;
}

export interface LlmProviderConfig
  extends
    OpenAIProviderConfig,
    AnthropicProviderConfig,
    OpenRouterProviderConfig,
    GeminiProviderConfig {
  provider?: string;
}

const DEFAULT_MODELS: Record<SupportedLlmProvider, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-5",
  openrouter: "openai/gpt-5",
  google_ai_studio: "gemini-2.5-flash",
  vertex_ai: "gemini-2.5-flash",
};

function createTextAgentProvider(adapter: Parameters<typeof chat>[0]["adapter"]): AgentProvider {
  return {
    chat(options) {
      return chat({
        ...options,
        adapter,
        stream: false,
      }) as Promise<unknown>;
    },
    stream(options) {
      return chat({
        ...options,
        adapter,
        stream: true,
      }) as AsyncIterable<StreamChunk>;
    },
  };
}

function normalizeProvider(provider?: string): SupportedLlmProvider {
  switch (provider) {
    case "openai":
    case "anthropic":
    case "openrouter":
    case "google_ai_studio":
    case "vertex_ai":
      return provider;
    case "gemini":
      return "google_ai_studio";
    default:
      return "google_ai_studio";
  }
}

function normalizeModelForProvider(provider: SupportedLlmProvider, model?: string): string {
  const trimmed = model?.trim();
  if (!trimmed) return DEFAULT_MODELS[provider];

  if (provider === "openrouter") {
    if (trimmed.startsWith("gemini/")) return `google/${trimmed.slice("gemini/".length)}`;
    if (trimmed.startsWith("vertex_ai/")) return `google/${trimmed.slice("vertex_ai/".length)}`;
    if (
      trimmed.startsWith("openai/") ||
      trimmed.startsWith("anthropic/") ||
      trimmed.startsWith("google/")
    ) {
      return trimmed;
    }
    return `openai/${trimmed}`;
  }

  if (provider === "google_ai_studio" || provider === "vertex_ai") {
    if (trimmed.startsWith("openai/") || trimmed.startsWith("anthropic/")) {
      return DEFAULT_MODELS[provider];
    }
    if (trimmed.startsWith("gemini/")) return trimmed.slice("gemini/".length);
    if (trimmed.startsWith("vertex_ai/")) return trimmed.slice("vertex_ai/".length);
    return trimmed;
  }

  if (provider === "openai") {
    if (trimmed.startsWith("openai/")) {
      return trimmed.slice("openai/".length);
    }
    if (
      trimmed.startsWith("gemini/") ||
      trimmed.startsWith("vertex_ai/") ||
      trimmed.startsWith("google/")
    ) {
      return DEFAULT_MODELS.openai;
    }
  }

  if (provider === "anthropic") {
    if (trimmed.startsWith("anthropic/")) {
      return trimmed.slice("anthropic/".length);
    }
    if (
      trimmed.startsWith("gemini/") ||
      trimmed.startsWith("vertex_ai/") ||
      trimmed.startsWith("google/")
    ) {
      return DEFAULT_MODELS.anthropic;
    }
  }

  return trimmed;
}

function buildVertexAuthOptions(vertexCredentials?: string) {
  const value = vertexCredentials?.trim();
  if (!value) return undefined;

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (parsed && typeof parsed === "object") {
      return { credentials: parsed };
    }
  } catch {
    // Fall through to keyFile handling.
  }

  return { keyFile: value };
}

function normalizeEndpointUrl(endpointUrl?: string): string | undefined {
  const value = endpointUrl?.trim();
  if (!value) return undefined;
  if (value.startsWith("http://localhost:11435") || value.startsWith("https://localhost:11435")) {
    return undefined;
  }
  return value;
}

function createOpenAIProvider(config: OpenAIProviderConfig): AgentProvider {
  const model = normalizeModelForProvider("openai", config.model);
  const endpointUrl = normalizeEndpointUrl(config.endpointUrl);
  const adapter = createOpenaiChat(model as OpenAIChatModel, config.apiKey ?? "", {
    ...(endpointUrl ? { baseURL: endpointUrl } : {}),
  });
  return createTextAgentProvider(adapter);
}

function createAnthropicProviderImpl(config: AnthropicProviderConfig): AgentProvider {
  const model = normalizeModelForProvider("anthropic", config.model);
  const endpointUrl = normalizeEndpointUrl(config.endpointUrl);
  const adapter = createAnthropicChat(model as AnthropicChatModel, config.apiKey ?? "", {
    ...(endpointUrl ? { baseURL: endpointUrl } : {}),
  });
  return createTextAgentProvider(adapter);
}

function createOpenRouterProviderImpl(config: OpenRouterProviderConfig): AgentProvider {
  const model = normalizeModelForProvider("openrouter", config.model);
  const endpointUrl = normalizeEndpointUrl(config.endpointUrl);
  const adapter = createOpenRouterText(
    model as Parameters<typeof createOpenRouterText>[0],
    config.apiKey ?? "",
    {
      ...(endpointUrl ? { serverURL: endpointUrl } : {}),
    },
  );
  return createTextAgentProvider(adapter);
}

function createGeminiProviderImpl(
  config: GeminiProviderConfig,
  forceVertex = false,
): AgentProvider {
  const model = normalizeModelForProvider("google_ai_studio", config.model);
  const endpointUrl = normalizeEndpointUrl(config.endpointUrl);
  const useVertex = Boolean(
    forceVertex || config.vertexProject || config.vertexLocation || config.vertexCredentials,
  );
  const adapter = useVertex
    ? new GeminiTextAdapter(
        {
          ...(config.vertexProject ? { project: config.vertexProject } : {}),
          ...(config.vertexLocation ? { location: config.vertexLocation } : {}),
          ...(config.vertexCredentials
            ? { googleAuthOptions: buildVertexAuthOptions(config.vertexCredentials) as any }
            : {}),
          vertexai: true,
        } as any,
        model as GeminiTextModel,
      )
    : createGeminiChat(model as GeminiTextModel, config.apiKey ?? "", {
        ...(endpointUrl ? { baseURL: endpointUrl } : {}),
      });
  return createTextAgentProvider(adapter);
}

export function createConfiguredProvider(config: LlmProviderConfig = {}): AgentProvider {
  const provider = normalizeProvider(config.provider);
  switch (provider) {
    case "openai":
      return createOpenAIProvider(config);
    case "anthropic":
      return createAnthropicProviderImpl(config);
    case "openrouter":
      return createOpenRouterProviderImpl(config);
    case "vertex_ai":
      return createGeminiProviderImpl(
        {
          ...config,
          apiKey: config.apiKey ?? "",
        },
        true,
      );
    case "google_ai_studio":
    default:
      return createGeminiProviderImpl(config);
  }
}

export function createGeminiProvider(config: GeminiProviderConfig = {}): AgentProvider {
  return createGeminiProviderImpl(config);
}

export function createAgentProvider(config: GeminiProviderConfig = {}): AgentProvider {
  return createGeminiProvider(config);
}

export function createOpenRouterProvider(config: OpenRouterProviderConfig = {}): AgentProvider {
  return createOpenRouterProviderImpl(config);
}

export function createAnthropicProvider(config: AnthropicProviderConfig = {}): AgentProvider {
  return createAnthropicProviderImpl(config);
}

export { normalizeModelForProvider, normalizeProvider, maxIterations };
export type { StreamChunk };

export * from "./mail-resolution-tools";
export * from "./capability-tools";
