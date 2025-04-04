import inquirer from 'inquirer';
import { execTerminalCommand, isSystemModifyingCommand } from '../utils';
import { createLLMProvider, LLMProviderType } from '../llm';
import { CommandProcessor } from '../services';
import { getSystemInfoFunction, getSystemInfoHandler } from '../functions';
import { CumulativeCostTracker } from '../utils/pricing-calculator';
import { runAgentMode } from './agent';
import { Command } from 'commander';
import { readConfig } from '../utils/config';
import { Message, MessageRole } from '../llm/interface';
import { logger } from '../utils/logger';

// Default system prompt for basic mode
const BASIC_SYSTEM_PROMPT = 
  `You are a helpful terminal assistant. Convert natural language requests into terminal commands. 
  Respond with ONLY the terminal command, nothing else. And try to respond with single line commands.`;

// System prompt when context is provided
const CONTEXT_SYSTEM_PROMPT = 
  `You are a helpful terminal assistant. Convert natural language requests into terminal commands. 
  Use the provided context to inform your command generation. 
  Respond with ONLY the terminal command, nothing else. And try to respond with single line commands.
  if user asks question that is not related to terminal commands respond user question.
  `;


// Create a global cost tracker for the application
export const costTracker = new CumulativeCostTracker();

// Store conversation history for agent mode
let conversationHistory: Message[] = [];

/**
 * Read data from stdin if available
 * @returns Promise that resolves with the stdin data or null if no data was piped
 */
async function readFromStdin(): Promise<string | null> {
  // Check if we're receiving piped input
  if (!process.stdin.isTTY) {
    return new Promise((resolve) => {
      let data = '';
      process.stdin.setEncoding('utf8');
      
      process.stdin.on('data', (chunk) => {
        data += chunk;
      });
      
      process.stdin.on('end', () => {
        resolve(data.trim());
      });
    });
  }
  return null;
}

/**
 * Process an AI command in basic mode
 * @param input User input to be processed
 * @param context Optional context from piped input
 */
export async function processAiCommand(input: string, context?: string): Promise<void> {
  try {
    logger.info(`Processing: "${input}"`);
    if (context) {
      logger.info(`With context: ${context}`);
    }
    
    // Create the LLM provider and command processor
    const llmProvider = createLLMProvider();
    const commandProcessor = new CommandProcessor(
      llmProvider, 
      context ? CONTEXT_SYSTEM_PROMPT : BASIC_SYSTEM_PROMPT,
      true
    );
    
    // Register available functions (only system info in basic mode)
    commandProcessor.registerFunction(getSystemInfoFunction, getSystemInfoHandler);
    
    // If we have context, add it to the conversation history
    const history: Message[] = [];
    if (context) {
      history.push({
        role: MessageRole.USER,
        content: `Context: ${context}`
      });
    }
    
    // Process the natural language command
    const terminalCommand = await commandProcessor.processCommand(
      input,
      (token: string) => process.stdout.write(token),
      history
    );
    
    // Execute the command with appropriate handling
    await executeTerminalCommand(terminalCommand);
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error(`Error: ${error.message}`);
    } else {
      logger.error(`Error: ${String(error)}`);
    }
  }
}

/**
 * Execute a terminal command with appropriate safety checks
 * @param command The command to execute
 */
async function executeTerminalCommand(command: string): Promise<void> {
  // Extract content from bash code block if present, handling both ```bash and ``` cases
  const bashBlockRegex = /```(?:bash|sh)?\s*([\s\S]*?)```/;
  const match = command.match(bashBlockRegex);
  
  // If no code block found, do nothing
  if (!match) {
    return;
  }
  
  // Extract command from the code block
  const commandToExecute = match[1].trim();
  
  // If the extracted content is empty, exit early
  if (!commandToExecute) {
    logger.warn('No valid commands found in the code block');
    return;
  }
  
  // Split commands by newlines to check if it's multiline
  const lines = commandToExecute.split('\n').map(line => line.trim()).filter(line => line);
  
  // Check for log tailing command first
  const isLogCommand = lines.some(line => isLogTailingCommand(line));
  if (isLogCommand) {
    logger.info('Log tailing command detected. Starting stream:');
    await execTerminalCommand(commandToExecute, false, true);
    return;
  }
  
  // If it's a multiline command, use eval to execute it
  if (lines.length > 1) {
    logger.info('Multiline command detected. Using eval for execution...');
    
    if (isSystemModifyingCommand(commandToExecute)) {
      // Ask for confirmation first
      logger.warn(`>>>> Multiline command may modify the system. Execute? y or n?`);
      
      const { confirm } = await inquirer.prompt<{ confirm: string }>([
        {
          type: 'input',
          name: 'confirm',
          message: '',
        }
      ]);
      
      if (confirm.toLowerCase() === 'y') {
        // Use eval to execute the multiline command as a single unit
        try {
          await execTerminalCommand(`eval "${commandToExecute.replace(/"/g, '\\"')}"`, false, false);
        } catch (error) {
          // If command fails, try with sudo
          const { sudoConfirm } = await inquirer.prompt<{ sudoConfirm: string }>([
            {
              type: 'input',
              name: 'sudoConfirm',
              message: 'Command failed. Retry with sudo? (y/n):',
            }
          ]);
          
          if (sudoConfirm.toLowerCase() === 'y') {
            await execTerminalCommand(`sudo eval "${commandToExecute.replace(/"/g, '\\"')}"`, true, false);
          }
        }
      }
    } else {
      // For non-system modifying multiline commands, execute without confirmation
      logger.command('Executing multiline command with eval');
      try {
        await execTerminalCommand(`eval "${commandToExecute.replace(/"/g, '\\"')}"`, false, false);
      } catch (error) {
        logger.error('Command execution failed');
      }
    }
  } else if (lines.length === 1) {
    // For single-line commands, use the existing approach
    await executeSingleCommand(lines[0]);
  }
}

// Helper function to identify log tailing commands
function isLogTailingCommand(command: string): boolean {
  const tailingPatterns = [
    /docker logs -f/,
    /tail -f/,
    /kubectl logs -f/,
    /journalctl -f/
  ];
  return tailingPatterns.some(pattern => pattern.test(command));
}

async function executeSingleCommand(command: string, stream: boolean = false): Promise<void> {
  if (isSystemModifyingCommand(command)) {
    // Handle commands that modify the system
    logger.warn(`>>>> \`${command}\` y or n?`);
    
    const { confirm } = await inquirer.prompt<{ confirm: string }>([
      {
        type: 'input',
        name: 'confirm',
        message: '',
      }
    ]);
    
    if (confirm.toLowerCase() === 'y') {
      try {
        await execTerminalCommand(command, false, stream);
      } catch (error) {
        // If command fails, try with sudo
        const { sudoConfirm } = await inquirer.prompt<{ sudoConfirm: string }>([
          {
            type: 'input',
            name: 'sudoConfirm',
            message: 'Command failed. Retry with sudo? (y/n):',
          }
        ]);
        
        if (sudoConfirm.toLowerCase() === 'y') {
          await execTerminalCommand(command, true, stream);
        }
      }
    }
  } else {
    // Handle read-only commands - execute without confirmation
    logger.command(command);
    try {
      await execTerminalCommand(command, false, stream);
    } catch (error) {
      logger.error('Command execution failed');
    }
  }
}

// Re-export the agent mode function
export { runAgentMode };