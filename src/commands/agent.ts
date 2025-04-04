import inquirer from "inquirer";
import { createLLMProvider } from "../llm";
import { CommandProcessor } from "../services";
import { MessageRole, Message } from "../llm/interface";
import {
  getSystemInfoFunction,
  getSystemInfoHandler,
  executeCommandFunction,
  executeCommandHandler,
} from "../functions";
import { FunctionCallProcessor } from "../services/functioncall-processor";
import { CumulativeCostTracker } from "../utils/pricing-calculator";
import { logger } from "../utils/logger";

const costTracker = new CumulativeCostTracker();
const AGENT_SYSTEM_PROMPT = `You are a helpful terminal agent. Help the user accomplish their tasks by executing terminal commands.
  if user have any queries and commans try to figureout the best way to do it and use the execute_command function to run commands
  Keep responses concise and focused on the user's goal.`;

export async function runAgentMode(
  initialInput: string,
  context?: string,
): Promise<void> {
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
      showCostInfo: true,
      functionCallProcessor,
    });

    let conversationHistory: Message<MessageRole>[] = [];
    let userInput = initialInput;

    if (context && context.trim()) {
      userInput = `${userInput}\n\nAdditional context from piped input:\n${context}`;
      logger.info("Including piped content as additional context");
    }

    conversationHistory.push({
      role: "user",
      content: userInput,
    });

    while (true) {
      conversationHistory = await commandProcessor.processCommand(
        userInput,
        (token: string) => process.stdout.write(token),
        conversationHistory,
      );
      if (
        conversationHistory[conversationHistory.length - 1].role === "assistant"
      ) {
        break;
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
