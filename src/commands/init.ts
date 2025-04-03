import inquirer from 'inquirer';
import { writeConfig, configExists } from '../utils/config';
import { LLMProviderType } from '../llm';
import { getProviderModels, getDefaultModel } from '../utils/model-config';
import { logger } from '../utils/logger';

/**
 * Initialize the Terminal AI CLI by setting up the config
 */
export async function initCommand(): Promise<void> {
  try {
    logger.info('Terminal AI - Initial Setup');
    logger.info('---------------------------');
    
    // Check if config already exists
    if (configExists()) {
      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: 'Configuration already exists. Do you want to overwrite it?',
          default: false
        }
      ]);
      
      if (!overwrite) {
        logger.info('Setup canceled. Keeping existing configuration.');
        return;
      }
    }
    
    // Get provider choice
    const { provider } = await inquirer.prompt([
      {
        type: 'list',
        name: 'provider',
        message: 'Select the AI provider to use:',
        choices: [
          { name: 'OpenAI', value: LLMProviderType.OPENAI },
          { name: 'Claude (Anthropic)', value: LLMProviderType.CLAUDE },
          { name: 'Gemini (Google)', value: LLMProviderType.GEMINI },
          { name: 'Ollama (Local)', value: LLMProviderType.OLLAMA }
          // Add more providers here as they become available
        ]
      }
    ]);
    
    let apiKey = '';
    let apiEndpoint = '';
    
    // Only prompt for API key if not using Ollama (which might not need an API key)
    if (provider !== LLMProviderType.OLLAMA) {
      const { key } = await inquirer.prompt([
        {
          type: 'password',
          name: 'key',
          message: 'Enter your API key:',
          validate: (input) => input.length > 0 ? true : 'API key is required'
        }
      ]);
      apiKey = key;
    } else {
      // For Ollama, prompt for endpoint
      const { endpoint } = await inquirer.prompt([
        {
          type: 'input',
          name: 'endpoint',
          message: 'Enter Ollama API endpoint (default: http://localhost:11434):',
          default: 'http://localhost:11434'
        }
      ]);
      apiEndpoint = endpoint;
    }
    
    // Get models from configuration file for the selected provider
    const models = getProviderModels(provider);
    const defaultModel = getDefaultModel(provider);
    
    // Get model based on provider
    let model = defaultModel;
    
    if (models.length > 0) {
      const { modelChoice } = await inquirer.prompt([
        {
          type: 'list',
          name: 'modelChoice',
          message: `Select the ${provider} model to use:`,
          choices: models.map(m => ({ name: m.name, value: m.value }))
        }
      ]);
      
      model = modelChoice;
    }
    
    // Save the config
    const config: any = {
      provider,
      model
    };
    
    // Only add API key if it's set
    if (apiKey) {
      config.apiKey = apiKey;
    }
    
    // Add API endpoint for Ollama
    if (apiEndpoint) {
      config.apiEndpoint = apiEndpoint;
    }
    
    const success = writeConfig(config);
    
    if (success) {
      logger.success('Configuration saved successfully!');
      logger.info('You can now use the Terminal AI CLI with your configured provider.');
    } else {
      logger.error('Failed to save configuration.');
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error(`Error during initialization: ${error.message}`);
    } else {
      logger.error(`Error during initialization: ${String(error)}`);
    }
  }
} 