import fs from "fs";
import os from "os";
import path from "path";

import YAML from "yaml";

import { LLMProviderType } from "../llm";
import { logger } from "../logger";

/**
 * Configuration interface for a single LLM profile
 */
export interface ProfileConfig {
  name: string;
  provider: LLMProviderType;
  model: string;
  apiKey?: string;
  apiEndpoint?: string;
}

/**
 * Configuration interface for Terminal AI
 */
export interface TerminalAIConfig {
  activeProfile: string;
  profiles: ProfileConfig[];
}


if(!fs.existsSync(path.join(os.homedir(), ".terminal-ai"))) {
  fs.mkdirSync(path.join(os.homedir(), ".terminal-ai"), { recursive: true });
}

const CONFIG_PATH = path.join(os.homedir(), ".terminal-ai", "config.yaml");

/**
 * Read configuration from ~/.terminal-ai.yaml
 * @returns The config object or null if not found
 */
export function readConfig(): TerminalAIConfig | null {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      return null;
    }

    const fileContent = fs.readFileSync(CONFIG_PATH, "utf8");
    const config = YAML.parse(fileContent) as TerminalAIConfig;
    return config;
  } catch (error) {
    console.error("Error reading config file:", error);
    return null;
  }
}

/**
 * Get active profile configuration
 * @returns The active profile config or null if not found
 */
export function getActiveProfile(): ProfileConfig | null {
  const config = readConfig();
  if (!config || config.profiles.length === 0) {
    return null;
  }

  return (
    config.profiles.find((p) => p.name === config.activeProfile) ||
    config.profiles[0]
  );
}

/**
 * Write configuration to ~/.terminal-ai.yaml
 * @param config The configuration object to save
 * @returns Success status
 */
export function writeConfig(config: TerminalAIConfig): boolean {
  try {
    const yamlString = YAML.stringify(config);
    fs.writeFileSync(CONFIG_PATH, yamlString, "utf8");
    return true;
  } catch (error) {
    logger.error(`Error writing config file: ${error}`);
    return false;
  }
}

/**
 * Check if configuration exists
 * @returns true if config file exists and is readable
 */
export function configExists(): boolean {
  return fs.existsSync(CONFIG_PATH);
}
