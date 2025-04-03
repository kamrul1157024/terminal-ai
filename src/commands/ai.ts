import inquirer from 'inquirer';
import { execTerminalCommand, isSystemModifyingCommand } from '../utils';
import { createLLMProvider, LLMProviderType } from '../llm';
import { CommandProcessor } from '../services';
import { getSystemInfoFunction, getSystemInfoHandler } from '../functions';
import { CumulativeCostTracker } from '../utils/pricing-calculator';
import { runAgentMode } from './agent';

// Default system prompt for basic mode
const BASIC_SYSTEM_PROMPT = 
  'You are a helpful terminal assistant. Convert natural language requests into terminal commands. ' +
  'Respond with ONLY the terminal command, nothing else.';

// Create a global cost tracker for the application
export const costTracker = new CumulativeCostTracker();

/**
 * Process an AI command in basic mode
 * @param input User input to be processed
 */
export async function processAiCommand(input: string): Promise<void> {
  try {
    console.log(`Processing: "${input}"`);
    
    // Create the LLM provider and command processor
    const llmProvider = createLLMProvider();
    const commandProcessor = new CommandProcessor(llmProvider, BASIC_SYSTEM_PROMPT, true);
    
    // Register available functions (only system info in basic mode)
    commandProcessor.registerFunction(getSystemInfoFunction, getSystemInfoHandler);
    
    // Process the natural language command
    const terminalCommand = await commandProcessor.processCommand(input);
    
    // Execute the command with appropriate handling
    await executeTerminalCommand(terminalCommand);
  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * Execute a terminal command with appropriate safety checks
 * @param command The command to execute
 */
async function executeTerminalCommand(command: string): Promise<void> {
  if (isSystemModifyingCommand(command)) {
    // Handle commands that modify the system
    console.log(`>>>> \`${command}\` y or n?`);
    
    const { confirm } = await inquirer.prompt([
      {
        type: 'input',
        name: 'confirm',
        message: '',
      }
    ]);
    
    if (confirm.toLowerCase() === 'y') {
      try {
        await execTerminalCommand(command, false);
      } catch (error) {
        // If command fails, try with sudo
        const { sudoConfirm } = await inquirer.prompt([
          {
            type: 'input',
            name: 'sudoConfirm',
            message: 'Command failed. Retry with sudo? (y/n):',
          }
        ]);
        
        if (sudoConfirm.toLowerCase() === 'y') {
          await execTerminalCommand(command, true);
        }
      }
    }
  } else {
    // Handle read-only commands - execute without confirmation
    console.log(`Executing: ${command}`);
    try {
      await execTerminalCommand(command, false);
    } catch (error) {
      console.error('Command execution failed');
    }
  }
}

// Re-export the agent mode function
export { runAgentMode }; 