import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { LLMProviderType } from '../llm';

// Model configuration interfaces
export interface ModelConfig {
  name: string;
  value: string;
}

export interface ProviderModelConfig {
  default: string;
  models: ModelConfig[];
}

export interface ModelsConfig {
  [key: string]: ProviderModelConfig;
}

// Path to the models config file
const MODELS_CONFIG_PATH = path.join(__dirname, '../../src/config/models.yaml');

/**
 * Read the models configuration from YAML file
 * @returns The models configuration object or null if not found
 */
export function readModelsConfig(): ModelsConfig | null {
  try {
    const configPath = path.resolve(__dirname, '../config/models.yaml');
    
    if (!fs.existsSync(configPath)) {
      console.error(`Models configuration file not found at ${configPath}`);
      return null;
    }
    
    const fileContent = fs.readFileSync(configPath, 'utf8');
    const config = YAML.parse(fileContent) as ModelsConfig;
    return config;
  } catch (error) {
    console.error('Error reading models config file:', error);
    return null;
  }
}

/**
 * Get models for a specific provider
 * @param provider Provider type
 * @returns Array of model configurations for the provider
 */
export function getProviderModels(provider: LLMProviderType): ModelConfig[] {
  const config = readModelsConfig();
  if (!config || !config[provider]) {
    return [];
  }
  
  return config[provider].models;
}

/**
 * Get the default model for a provider
 * @param provider Provider type
 * @returns Default model value
 */
export function getDefaultModel(provider: LLMProviderType): string {
  const config = readModelsConfig();
  if (!config || !config[provider]) {
    // Fallback defaults if config is missing
    switch (provider) {
      case LLMProviderType.OPENAI:
        return 'gpt-4o';
      case LLMProviderType.CLAUDE:
        return 'claude-3-opus-20240229';
      case LLMProviderType.GEMINI:
        return 'gemini-1.5-pro';
      case LLMProviderType.OLLAMA:
        return 'llama3';
      default:
        return '';
    }
  }
  
  return config[provider].default;
} 