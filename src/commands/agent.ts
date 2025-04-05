import inquirer from "inquirer";
import { createLLMProvider } from "../llm";
import { CommandProcessor } from "../services";
import { MessageRole, Message, TokenUsage } from "../llm/interface";
import {
  getSystemInfoFunction,
  getSystemInfoHandler,
  executeCommandFunction,
  executeCommandHandler,
} from "../functions";
import { FunctionCallProcessor } from "../services/functioncall-processor";
import {
  CumulativeCostTracker,
  displayCostInfo,
} from "../utils/pricing-calculator";
import { logger } from "../utils/logger";
import { getShowCostInfo } from "../utils/context-vars";
import { SQLiteSessionManager, Thread } from "../session-manager";

// Constants
const costTracker = new CumulativeCostTracker();
const AGENT_SYSTEM_PROMPT = `You are a helpful terminal agent. Help the user accomplish their tasks by executing terminal commands.
  if user have any queries and commans try to figureout the best way to do it and use the execute_command function to run commands
  if the command execution fails, try to figureout the issue and resolve it
  Keep responses concise and focused on the user's goal.`;
const EXIT_COMMANDS = ["\exit", "\quit", "\q"];
const PROMPT_SYMBOL = ">>";
const EMPTY_INPUT_MESSAGE =
  "Please enter a command or question. Type \\exit, \\quit, or \\q to exit.";
const EXIT_MESSAGE = "Exiting agent mode";

/**
 * Process user input and check for special commands
 * @returns true if the loop should continue, false if it should exit
 */
async function processUserInput(): Promise<{
  shouldContinue: boolean;
  input: string;
}> {
  const response = await inquirer.prompt([
    {
      type: "input",
      name: "userInput",
      message: PROMPT_SYMBOL,
      default: "",
    },
  ]);

  const trimmedInput = response.userInput.trim();

  if (EXIT_COMMANDS.includes(trimmedInput)) {
    logger.info(EXIT_MESSAGE);
    return { shouldContinue: false, input: trimmedInput };
  }

  if (!trimmedInput) {
    console.log(EMPTY_INPUT_MESSAGE);
    return processUserInput();
  }

  return { shouldContinue: true, input: trimmedInput };
}

export interface AgentModeOptions {
  input: string;
  context?: string;
  threadId?: string;
}

export async function runAgentMode({
  input,
  context,
  threadId,
}: AgentModeOptions): Promise<void> {
  try {
    const functionCallProcessor = new FunctionCallProcessor();
    functionCallProcessor.registerFunction(
      executeCommandFunction,
      executeCommandHandler,
    );
    functionCallProcessor.registerFunction(
      getSystemInfoFunction,
      getSystemInfoHandler,
    );

    const llmProvider = createLLMProvider();
    const commandProcessor = new CommandProcessor({
      llmProvider,
      systemPrompt: AGENT_SYSTEM_PROMPT,
      functionCallProcessor,
    });

    // Initialize the session manager
    const sessionManager = new SQLiteSessionManager();
    
    // Initialize or load thread
    let thread: Thread;
    if (threadId) {
      const existingThread = await sessionManager.getThread(threadId);
      if (!existingThread) {
        logger.info(`Thread with ID ${threadId} not found. Creating a new thread.`);
        thread = await sessionManager.createThread();
      } else {
        thread = existingThread;
        logger.info(`Loaded thread: ${thread.name} (${thread.id})`);
      }
    } else {
      thread = await sessionManager.createThread();
      logger.info(`Created new thread: ${thread.name} (${thread.id})`);
    }

    let conversationHistory = thread.messages;
    let userInput = input;

    if (context && context.trim()) {
      userInput = `${userInput}\n\nAdditional context from piped input:\n${context}`;
      logger.info("Including piped content as additional context");
    }

    // Add the initial user message if starting a new conversation
    if (conversationHistory.length === 0) {
      if (!userInput.trim()) {
        // If no input is provided and this is a new thread, prompt for input
        const { shouldContinue, input: firstInput } = await processUserInput();
        if (!shouldContinue) {
          return;
        }
        userInput = firstInput;
      }
      
      conversationHistory.push({
        role: "user",
        content: userInput,
      });
    } else if (userInput.trim()) {
      // If continuing a conversation and input is provided, add it
      conversationHistory.push({
        role: "user",
        content: userInput,
      });
    }

    // Update the thread with the messages
    if (conversationHistory.length > thread.messages.length) {
      await sessionManager.updateThread(thread.id, conversationHistory);
    }

    const totalUsage: TokenUsage = {
      inputTokens: 0,
      outputTokens: 0,
      model: llmProvider.getModel(),
    };

    while (true) {
      // Process the command with the LLM
      const { history, usage } = await commandProcessor.processCommand({
        input: userInput,
        onToken: (token: string) => process.stdout.write(token),
        conversationHistory,
      });

      conversationHistory = history;
      
      // Update the thread with new messages
      await sessionManager.updateThread(thread.id, conversationHistory);
      
      // If this is a new thread with the default name and we now have both user input and AI response,
      // generate a better name based on the conversation content
      if (thread.name.startsWith('Thread-') && conversationHistory.length >= 2) {
        const userMessage = conversationHistory.find(msg => msg.role === 'user')?.content || '';
        const aiResponse = conversationHistory.find(msg => msg.role === 'assistant')?.content || '';
        
        // Create a name by combining user input and AI response
        const combinedContent = `${userMessage} ${aiResponse}`;
        // Trim to max 120 chars and add ellipsis if truncated
        const truncatedName = combinedContent.length > 120 
          ? `${combinedContent.substring(0, 120).trim()}...` 
          : combinedContent;
        
        // Update the thread name
        await sessionManager.renameThread(thread.id, truncatedName);
      }
      
      totalUsage.inputTokens += usage.inputTokens;
      totalUsage.outputTokens += usage.outputTokens;

      // Get next user input if the last message was from the assistant
      if (
        conversationHistory[conversationHistory.length - 1].role === "assistant"
      ) {
        const { shouldContinue, input } = await processUserInput();
        if (!shouldContinue) {
          break;
        }
        if (getShowCostInfo()) {
          displayCostInfo(totalUsage);
        }
        userInput = input;
      }
    }

    costTracker.displayTotalCost();
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error(`Error in agent mode: ${error.message}`);
    } else {
      logger.error(`Error in agent mode: ${String(error)}`);
    }
  }
}
