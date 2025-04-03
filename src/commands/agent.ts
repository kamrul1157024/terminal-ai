import inquirer from 'inquirer';
import { createLLMProvider } from '../llm';
import { CommandProcessor } from '../services';
import { MessageRole, Message } from '../llm/interface';
import { 
  getAllFunctionDefinitions, 
  getSystemInfoFunction, 
  getSystemInfoHandler,
  executeCommandFunction,
  executeCommandHandler
} from '../functions';
import { CumulativeCostTracker } from '../utils/pricing-calculator';
import { costTracker } from './ai';
import { logger } from '../utils/logger';

/**
 * Agent system prompt - instructs the LLM to act as a terminal assistant
 */
const AGENT_SYSTEM_PROMPT = 
  'You are a helpful terminal agent. Help the user accomplish their tasks by executing terminal commands. ' +
  'When appropriate, use the execute_command function to run commands, providing clear reasoning for each command. ' +
  'Keep responses concise and focused on the user\'s goal.';

/**
 * Run in agent mode with continuous conversation
 * @param initialInput Initial user input to start the conversation
 */
export async function runAgentMode(initialInput: string): Promise<void> {
  try {
    logger.info('Starting agent mode...');
    logger.info(`Initial query: "${initialInput}"`);
    logger.info('The agent will suggest commands and execute them with your permission.');
    logger.info('Type "exit" or "quit" to end the session.');
    
    // Create the LLM provider and command processor with cost tracking
    const llmProvider = createLLMProvider();
    const commandProcessor = new CommandProcessor(llmProvider, AGENT_SYSTEM_PROMPT, true);
    
    // Register functions
    commandProcessor.registerFunction(executeCommandFunction, executeCommandHandler);
    commandProcessor.registerFunction(getSystemInfoFunction, getSystemInfoHandler);
    
    // Initialize conversation history
    let conversationHistory: Message[] = [];
    let userInput = initialInput;
    
    // Agent conversation loop
    while (userInput.toLowerCase() !== 'exit' && userInput.toLowerCase() !== 'quit') {
      // Add user message to history
      conversationHistory.push({
        role: MessageRole.USER,
        content: userInput
      });
      
      // Process command with conversation history
      const aiResponse = await commandProcessor.processCommand(
        userInput,
        (token: string) => process.stdout.write(token),
        conversationHistory
      );
      
      // Add assistant response to history
      conversationHistory.push({
        role: MessageRole.ASSISTANT,
        content: aiResponse
      });
      
      logger.aiResponse(aiResponse);
      
      // Get next user input
      const { nextInput } = await inquirer.prompt<{ nextInput: string }>([
        {
          type: 'input',
          name: 'nextInput',
          message: '\nYou: ',
          default: 'exit'
        }
      ]);
      
      userInput = nextInput;
    }
    
    // Display cumulative cost information for the session
    costTracker.displayTotalCost();
    
    logger.info('Exiting agent mode. Goodbye!');
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error(`Error in agent mode: ${error.message}`);
    } else {
      logger.error(`Error in agent mode: ${String(error)}`);
    }
  }
} 