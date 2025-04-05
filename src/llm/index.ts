import { readConfig } from "../config/config";

import { LLMProvider, LLMProviderConfig } from "./interface";
import { OllamaProvider } from "./providers/ollama-provider";
import { OpenAIProvider } from "./providers/openai-provider";

export enum LLMProviderType {
  OPENAI = "openai",
  CLAUDE = "claude",
  GEMINI = "gemini",
  OLLAMA = "ollama",
}

export function createLLMProvider(
  type?: LLMProviderType,
  config: LLMProviderConfig = {},
): LLMProvider {
  if (!type || Object.keys(config).length === 0) {
    const savedConfig = readConfig();

    if (savedConfig) {
      type = type || savedConfig.provider;

      config = {
        apiKey: savedConfig.apiKey,
        model: savedConfig.model,
        ...config,
      };
    }
  }

  type = type || LLMProviderType.OPENAI;

  switch (type) {
    case LLMProviderType.OPENAI:
      return new OpenAIProvider(config);
    case LLMProviderType.OLLAMA:
      return new OllamaProvider(config);
    default:
      throw new Error(`Unsupported LLM provider type: ${type}`);
  }
}

export { LLMProvider, LLMProviderConfig };
