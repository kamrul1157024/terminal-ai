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
  'You are a helpful terminal assistant. Convert natural language requests into terminal commands. ' +
  'Respond with ONLY the terminal command, nothing else.';

// System prompt when context is provided
const CONTEXT_SYSTEM_PROMPT = 
  'You are a helpful terminal assistant. Convert natural language requests into terminal commands. ' +
  'Use the provided context to inform your command generation. ' +
  'Respond with ONLY the terminal command, nothing else.';

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
  const bashBlockRegex = /```(?:bash)?\s*([\s\S]*?)```/;
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
  
  // Split commands by newlines and filter out empty lines
  const commands = commandToExecute.split('\n').map(cmd => cmd.trim()).filter(cmd => cmd);

  // If multiple commands, execute them sequentially
  if (commands.length > 1) {
    logger.info('Multiple commands detected. Executing sequentially...');
    for (const cmd of commands) {
      // Check if this is a log tailing command
      if (isLogTailingCommand(cmd)) {
        logger.info('Log tailing command detected. Starting stream:');
        await executeSingleCommand(cmd);
        return; // Exit after starting the streaming command
      }
      
      await executeSingleCommand(cmd);
    }
  } else if (commands.length === 1) {
    // Single command
    const shouldStream = isLogTailingCommand(commands[0]);
    await executeSingleCommand(commands[0], shouldStream);
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

/**
 * AI command for processing natural language commands
 */
export function aiCommand(program: Command) {
  program
    .command('ai')
    .description('AI-powered terminal command interpreter')
    .argument('[input...]', 'Natural language command to execute')
    .option('-a, --agent', 'Run in agent mode with continuous conversation')
    .action(async (input: string[], options: { agent?: boolean }) => {
      try {
        // Read configuration
        const config = readConfig();
        
        if (!config) {
          logger.error('Configuration not found. Please run "ai init" first.');
          process.exit(1);
        }
        
        // Read from stdin if available
        const context = await readFromStdin();
        
        // Create LLM provider
        const llmProvider = createLLMProvider(config.provider, {
          apiKey: config.apiKey,
          model: config.model,
          apiEndpoint: config.apiEndpoint
        });
        
        // Create command processor with appropriate system prompt
        const processor = new CommandProcessor(
          llmProvider,
          context ? CONTEXT_SYSTEM_PROMPT : BASIC_SYSTEM_PROMPT
        );
        
        // Check if we're in agent mode
        if (options.agent) {
          logger.info('Agent mode activated. Type "exit" or "quit" to end the session.');
          
          // If we have context, add it to the conversation history
          if (context) {
            conversationHistory.push({
              role: MessageRole.USER,
              content: `Context: ${context}`
            });
          }
          
          // If input was provided, process it first
          if (input.length > 0) {
            const initialInput = input.join(' ');
            logger.userInput(initialInput);
            
            // Process with streaming output
            logger.aiResponse('');
            const command = await processor.processCommand(
              initialInput,
              (token: string) => process.stdout.write(token),
              conversationHistory
            );
            
            // Add to conversation history
            conversationHistory.push(
              { role: MessageRole.USER, content: initialInput },
              { role: MessageRole.ASSISTANT, content: command }
            );
            
            logger.command(command);
          }
          
          // Start interactive loop
          const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
          });
          
          const askQuestion = () => {
            readline.question('\n', async (userInput: string) => {
              if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === 'quit') {
                logger.info('Ending agent session.');
                readline.close();
                return;
              }
              
              logger.userInput(userInput);
              
              // Process with streaming output
              logger.aiResponse('');
              const command = await processor.processCommand(
                userInput,
                (token: string) => process.stdout.write(token),
                conversationHistory
              );
              
              // Add to conversation history
              conversationHistory.push(
                { role: MessageRole.USER, content: userInput },
                { role: MessageRole.ASSISTANT, content: command }
              );
              
              logger.command(command);
              
              // Continue the loop
              askQuestion();
            });
          };
          
          askQuestion();
        } else {
          // Single command mode
          if (input.length === 0) {
            logger.error('Please provide a command to execute.');
            process.exit(1);
          }
          
          const userInput = input.join(' ');
          logger.userInput(userInput);
          
          // Initialize history with context if available
          const history: Message[] = [];
          if (context) {
            history.push({
              role: MessageRole.USER,
              content: `Context: ${context}`
            });
          }
          
          // Process with streaming output
          logger.aiResponse('');
          const command = await processor.processCommand(
            userInput,
            (token: string) => process.stdout.write(token),
            history
          );
          
          logger.command(command);
        }
      } catch (error: unknown) {
        if (error instanceof Error) {
          logger.error(`Error: ${error.message}`);
        } else {
          logger.error(`Error: ${String(error)}`);
        }
        process.exit(1);
      }
    });
} 