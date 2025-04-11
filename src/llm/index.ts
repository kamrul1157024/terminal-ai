import { readConfig } from "../config/config";
import { getActiveProfile } from "../utils/context-vars";

import { LLMProvider, LLMProviderConfig } from "./interface";
import { GeminiProvider } from "./providers/gemini-provider";
import { OllamaProvider } from "./providers/ollama-provider";
import { OpenAIProvider } from "./providers/openai-provider";
import { VertexAIProvider } from "./providers/vertexai-provider";

export enum LLMProviderType {
  OPENAI = "openai",
  CLAUDE = "claude",
  GEMINI = "gemini",
  OLLAMA = "ollama",
  VERTEXAI = "vertexai",
}

export function createLLMProvider(
  type?: LLMProviderType,
  config: LLMProviderConfig = {},
): LLMProvider {
  const activeProfile = getActiveProfile();
  let effectiveConfig: LLMProviderConfig & {
    projectId?: string;
    location?: string;
  } = { ...config };
  let providerType = type;

  if (activeProfile) {
    providerType = providerType || activeProfile.provider;
    effectiveConfig = {
      apiKey: activeProfile.apiKey,
      model: activeProfile.model,
      apiEndpoint: activeProfile.apiEndpoint,
      projectId: activeProfile.projectId,
      location: activeProfile.location,
      ...config,
    };
  } else if (!providerType || Object.keys(config).length === 0) {
    const savedConfig = readConfig();
    if (savedConfig) {
      const savedActiveProfile = savedConfig.profiles.find(
        (p) => p.name === savedConfig.activeProfile,
      );
      if (savedActiveProfile) {
        providerType = providerType || savedActiveProfile.provider;
        effectiveConfig = {
          apiKey: savedActiveProfile.apiKey,
          model: savedActiveProfile.model,
          apiEndpoint: savedActiveProfile.apiEndpoint,
          projectId: savedActiveProfile.projectId,
          location: savedActiveProfile.location,
          ...config,
        };
      }
    }
  }

  providerType = providerType || LLMProviderType.OPENAI;

  switch (providerType) {
    case LLMProviderType.OPENAI:
      return new OpenAIProvider(effectiveConfig);
    case LLMProviderType.OLLAMA:
      return new OllamaProvider(effectiveConfig);
    case LLMProviderType.GEMINI:
      return new GeminiProvider(effectiveConfig);
    case LLMProviderType.VERTEXAI:
      if (!effectiveConfig.projectId || !effectiveConfig.location) {
        throw new Error(
          "Vertex AI provider requires projectId and location in config.",
        );
      }
      return new VertexAIProvider(
        effectiveConfig as Required<
          Pick<typeof effectiveConfig, "projectId" | "location">
        > &
          typeof effectiveConfig,
      );
    default:
      throw new Error(`Unsupported LLM provider type: ${providerType}`);
  }
}

export { LLMProvider, LLMProviderConfig };
