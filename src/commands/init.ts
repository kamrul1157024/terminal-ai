import inquirer from 'inquirer';
import { writeConfig, configExists } from '../utils/config';
import { LLMProviderType } from '../llm';

/**
 * Initialize the Terminal AI CLI by setting up the config
 */
export async function initCommand(): Promise<void> {
  try {
    console.log('Terminal AI - Initial Setup');
    console.log('---------------------------');
    
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
        console.log('Setup canceled. Keeping existing configuration.');
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
          { name: 'OpenAI', value: LLMProviderType.OPENAI }
          // Add more providers here as they become available
        ]
      }
    ]);
    
    // Get API key
    const { apiKey } = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: 'Enter your API key:',
        validate: (input) => input.length > 0 ? true : 'API key is required'
      }
    ]);
    
    // Get model if OpenAI
    let model = '';
    if (provider === LLMProviderType.OPENAI) {
      const { modelChoice } = await inquirer.prompt([
        {
          type: 'list',
          name: 'modelChoice',
          message: 'Select the OpenAI model to use:',
          choices: [
            { name: 'GPT-4o (Default)', value: 'gpt-4o' },
            { name: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
            { name: 'Custom...', value: 'custom' }
          ]
        }
      ]);
      
      if (modelChoice === 'custom') {
        const { customModel } = await inquirer.prompt([
          {
            type: 'input',
            name: 'customModel',
            message: 'Enter the model name:',
            validate: (input) => input.length > 0 ? true : 'Model name is required'
          }
        ]);
        model = customModel;
      } else {
        model = modelChoice;
      }
    }
    
    // Save the config
    const success = writeConfig({
      provider,
      apiKey,
      model
    });
    
    if (success) {
      console.log('Configuration saved successfully!');
      console.log('You can now use the Terminal AI CLI with your configured provider.');
    } else {
      console.error('Failed to save configuration.');
    }
  } catch (error) {
    console.error('Error during initialization:', error);
  }
} 