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

export async function runAgentMode({
  input,
  context,
}: {
  input: string;
  context?: string;
}): Promise<void> {
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

    let conversationHistory: Message<MessageRole>[] = [];
    let userInput = input;

    if (context && context.trim()) {
      userInput = `${userInput}\n\nAdditional context from piped input:\n${context}`;
      logger.info("Including piped content as additional context");
    }

    conversationHistory.push({
      role: "user",
      content: userInput,
    });

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
