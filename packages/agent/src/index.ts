import { chat, type StreamChunk } from "@tanstack/ai";
import {
  createGeminiChat,
  geminiText,
  type GeminiTextConfig,
  type GeminiTextModel,
} from "@tanstack/ai-gemini";

type AgentChatOptions = Omit<Parameters<typeof chat>[0], "adapter" | "stream">;

export interface AgentProvider {
  chat(options: AgentChatOptions): Promise<unknown>;
  stream(options: AgentChatOptions): AsyncIterable<StreamChunk>;
}

export interface GeminiProviderConfig extends Omit<GeminiTextConfig, "apiKey"> {
  apiKey?: string;
  model?: GeminiTextModel;
}

export interface OpenRouterProviderConfig {
  apiKey?: string;
  model?: string;
  baseURL?: string;
  [key: string]: unknown;
}

export interface AnthropicProviderConfig {
  apiKey?: string;
  model?: string;
  baseURL?: string;
  [key: string]: unknown;
}

const DEFAULT_GEMINI_MODEL: GeminiTextModel = "gemini-2.5-flash";

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

function createUnsupportedProvider(name: string): AgentProvider {
  const error = new Error(`${name} provider is not implemented yet.`);

  return {
    chat() {
      throw error;
    },
    stream() {
      throw error;
    },
  };
}

export function createGeminiProvider(config: GeminiProviderConfig = {}): AgentProvider {
  const { model = DEFAULT_GEMINI_MODEL, apiKey, ...adapterConfig } = config;
  const adapter = apiKey
    ? createGeminiChat(model, apiKey, adapterConfig)
    : geminiText(model, adapterConfig);

  return createTextAgentProvider(adapter);
}

export function createAgentProvider(config: GeminiProviderConfig = {}): AgentProvider {
  return createGeminiProvider(config);
}

export function createOpenRouterProvider(_config: OpenRouterProviderConfig = {}): AgentProvider {
  return createUnsupportedProvider("OpenRouter");
}

export function createAnthropicProvider(_config: AnthropicProviderConfig = {}): AgentProvider {
  return createUnsupportedProvider("Anthropic");
}

export type { StreamChunk };
