import fs from "fs";
import path from "path";

import YAML from "yaml";

import { LLMProviderType } from "../llm";

// Model configuration interfaces
export interface ModelPricing {
  input: number; // Price per million tokens for input
  output: number; // Price per million tokens for output
}

export interface ModelLimits {
  max_input_tokens: number;
  max_output_tokens: number;
}

export interface ModelConfig {
  name: string;
  value: string;
  pricing: ModelPricing;
  limits: ModelLimits;
}

export interface ProviderModelConfig {
  default: string;
  models: ModelConfig[];
}

export interface ModelsConfig {
  [key: string]: ProviderModelConfig;
}

export function readModelsConfig(): ModelsConfig | null {
  try {
    const configPath = path.resolve(__dirname, "../config/models.yaml");

    if (!fs.existsSync(configPath)) {
      console.error(`Models configuration file not found at ${configPath}`);
      return null;
    }

    const fileContent = fs.readFileSync(configPath, "utf8");
    const config = YAML.parse(fileContent) as ModelsConfig;
    return config;
  } catch (error) {
    console.error("Error reading models config file:", error);
    return null;
  }
}

export function getProviderModels(provider: LLMProviderType): ModelConfig[] {
  const config = readModelsConfig();
  if (!config || !config[provider]) {
    return [];
  }

  return config[provider].models;
}

export function getDefaultModel(provider: LLMProviderType): string {
  const config = readModelsConfig();
  if (!config || !config[provider]) {
    // Fallback defaults if config is missing
    switch (provider) {
      case LLMProviderType.OPENAI:
        return "gpt-4o";
      case LLMProviderType.CLAUDE:
        return "claude-3-opus-20240229";
      case LLMProviderType.GEMINI:
        return "gemini-1.5-pro";
      case LLMProviderType.OLLAMA:
        return "llama3";
      default:
        return "";
    }
  }

  return config[provider].default;
}

export function getModelByValue(modelValue: string): ModelConfig | null {
  const config = readModelsConfig();
  if (!config) return null;

  for (const provider of Object.values(config)) {
    const model = provider.models.find((m) => m.value === modelValue);
    if (model) return model;
  }

  return null;
}

export function calculateCost(
  modelValue: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const model = getModelByValue(modelValue);
  if (!model) return 0;

  const inputCost = (inputTokens / 1000000) * model.pricing.input;
  const outputCost = (outputTokens / 1000000) * model.pricing.output;

  return inputCost + outputCost;
}
