import inquirer from 'inquirer';
import { execTerminalCommand, isSystemModifyingCommand } from '../utils';
import { createLLMProvider } from '../llm';
import { CommandProcessor } from '../services';
import { FunctionDefinition } from '../llm/interface';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

// Define a function for getting system information
const getSystemInfoFunction: FunctionDefinition = {
  name: 'get_system_info',
  description: 'Get information about the system',
  parameters: {
    type: 'object',
    properties: {
      info_type: {
        type: 'string',
        description: 'Type of information to retrieve',
        enum: ['os', 'cpu', 'memory', 'disk']
      }
    },
    required: ['info_type']
  }
};

// Implementation of the getSystemInfo function
async function getSystemInfoHandler(args: Record<string, any>): Promise<string> {
  const infoType = args.info_type;
  
  switch (infoType) {
    case 'os':
      return (await execPromise('uname -a')).stdout;
    case 'cpu':
      return (await execPromise('sysctl -n machdep.cpu.brand_string')).stdout;
    case 'memory':
      return (await execPromise('vm_stat')).stdout;
    case 'disk':
      return (await execPromise('df -h')).stdout;
    default:
      return 'Unknown info type requested';
  }
}

/**
 * Process an AI command and execute it if confirmed
 * @param input User input to be processed
 */
export async function processAiCommand(input: string): Promise<void> {
  try {
    console.log(`Processing: "${input}"`);
    
    // Create the LLM provider and command processor
    const llmProvider = createLLMProvider();
    const commandProcessor = new CommandProcessor(llmProvider);
    
    // Register sample function
    commandProcessor.registerFunction(getSystemInfoFunction, getSystemInfoHandler);
    
    // Process the natural language command
    const terminalCommand = await commandProcessor.processCommand(input);
    
    if (isSystemModifyingCommand(terminalCommand)) {
      // Handle commands that modify the system
      console.log(`>>>> \`${terminalCommand}\` y or n?`);
      
      const { confirm } = await inquirer.prompt([
        {
          type: 'input',
          name: 'confirm',
          message: '',
        }
      ]);
      
      if (confirm.toLowerCase() === 'y') {
        try {
          await execTerminalCommand(terminalCommand, false);
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
            await execTerminalCommand(terminalCommand, true);
          }
        }
      }
    } else {
      // Handle read-only commands - execute without confirmation
      console.log(`Executing: ${terminalCommand}`);
      try {
        await execTerminalCommand(terminalCommand, false);
      } catch (error) {
        console.error('Command execution failed');
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
} 