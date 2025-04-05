import { readConfig } from "../config/config";
import { getActiveProfile } from "../utils/context-vars";

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
  // First, check if there's an active profile in the context
  const activeProfile = getActiveProfile();

  if (activeProfile) {
    type = type || activeProfile.provider;

    config = {
      apiKey: activeProfile.apiKey,
      model: activeProfile.model,
      apiEndpoint: activeProfile.apiEndpoint,
      ...config,
    };
  }
  // If no active profile, fall back to the global config
  else if (!type || Object.keys(config).length === 0) {
    const savedConfig = readConfig();

    if (savedConfig) {
      const activeProfile = savedConfig.profiles.find(
        (p) => p.name === savedConfig.activeProfile,
      );

      if (activeProfile) {
        type = type || activeProfile.provider;

        config = {
          apiKey: activeProfile.apiKey,
          model: activeProfile.model,
          apiEndpoint: activeProfile.apiEndpoint,
          ...config,
        };
      }
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
