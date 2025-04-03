import { LLMProvider, LLMProviderConfig } from './interface';
import { OpenAIProvider } from './providers/openai-provider';
import { ClaudeProvider } from './providers/claude-provider';
import { GeminiProvider } from './providers/gemini-provider';
import { OllamaProvider } from './providers/ollama-provider';
import { readConfig } from '../utils/config';

/**
 * Available LLM provider types
 */
export enum LLMProviderType {
  OPENAI = 'openai',
  CLAUDE = 'claude',
  GEMINI = 'gemini',
  OLLAMA = 'ollama'
  // Add more providers here as they become available
}

/**
 * Creates and returns an LLM provider based on the specified type
 * @param type The type of LLM provider to create (optional, will use config if available)
 * @param config Configuration for the provider (optional, will use config if available)
 * @returns An instance of the requested LLM provider
 */
export function createLLMProvider(
  type?: LLMProviderType,
  config: LLMProviderConfig = {}
): LLMProvider {
  // Try to read from config file if not explicitly provided
  if (!type || Object.keys(config).length === 0) {
    const savedConfig = readConfig();
    
    if (savedConfig) {
      type = type || savedConfig.provider;
      
      // Merge configs, with passed config taking precedence
      config = {
        apiKey: savedConfig.apiKey,
        model: savedConfig.model,
        ...config
      };
    }
  }

  // Default to OpenAI if no type is specified
  type = type || LLMProviderType.OPENAI;
  
  switch (type) {
    case LLMProviderType.OPENAI:
      return new OpenAIProvider(config);
    case LLMProviderType.CLAUDE:
      return new ClaudeProvider(config);
    case LLMProviderType.GEMINI:
      return new GeminiProvider(config);
    case LLMProviderType.OLLAMA:
      return new OllamaProvider(config);
    default:
      throw new Error(`Unsupported LLM provider type: ${type}`);
  }
}

// Re-export the interfaces
export { LLMProvider, LLMProviderConfig };