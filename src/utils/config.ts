import fs from 'fs';
import path from 'path';
import os from 'os';
import YAML from 'yaml';
import { LLMProviderType } from '../llm';

/**
 * Configuration interface for Terminal AI
 */
export interface TerminalAIConfig {
  provider: LLMProviderType;
  apiKey: string;
  model?: string;
}

// Default configuration path
const CONFIG_PATH = path.join(os.homedir(), '.terminal-ai.yaml');

/**
 * Read configuration from ~/.terminal-ai.yaml
 * @returns The config object or null if not found
 */
export function readConfig(): TerminalAIConfig | null {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      return null;
    }
    
    const fileContent = fs.readFileSync(CONFIG_PATH, 'utf8');
    const config = YAML.parse(fileContent) as TerminalAIConfig;
    return config;
  } catch (error) {
    console.error('Error reading config file:', error);
    return null;
  }
}

/**
 * Write configuration to ~/.terminal-ai.yaml
 * @param config The configuration object to save
 * @returns Success status
 */
export function writeConfig(config: TerminalAIConfig): boolean {
  try {
    const yamlString = YAML.stringify(config);
    fs.writeFileSync(CONFIG_PATH, yamlString, 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing config file:', error);
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