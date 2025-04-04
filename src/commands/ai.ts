import { createLLMProvider } from "../llm";
import { CommandProcessor } from "../services";
import {
  executeCommandFunction,
  executeCommandHandler,
  getSystemInfoFunction,
  getSystemInfoHandler,
} from "../functions";
import { runAgentMode } from "./agent";
import { Message, MessageRole } from "../llm/interface";
import { logger } from "../utils/logger";
import { FunctionCallProcessor } from "../services/functioncall-processor";

const BASIC_SYSTEM_PROMPT = `You are a helpful terminal assistant. Convert natural language requests into terminal commands as tool call of executeCommandFunction.`;

const CONTEXT_SYSTEM_PROMPT = `You are a helpful terminal assistant. Convert natural language requests into terminal commands. 
  Use the provided context to inform your command generation. 
  Respond with ONLY the terminal command, nothing else. And try to respond with single line commands.
  if user asks question that is not related to terminal commands respond user question.
  `;

export async function processAiCommand(
  input: string,
  context?: string,
): Promise<void> {
  try {
    logger.info(`Processing: "${input}"`);
    if (context) {
      logger.info(`With context: ${context}`);
    }

    const llmProvider = createLLMProvider();
    const functionCallProcessor = new FunctionCallProcessor();
    functionCallProcessor.registerFunction(
      getSystemInfoFunction,
      getSystemInfoHandler,
    );

    functionCallProcessor.registerFunction(
      executeCommandFunction,
      executeCommandHandler,
    );

    const commandProcessor = new CommandProcessor({
      llmProvider,
      systemPrompt: context ? CONTEXT_SYSTEM_PROMPT : BASIC_SYSTEM_PROMPT,
      showCostInfo: true,
      functionCallProcessor,
    });

    const history: Message<MessageRole>[] = [];
    if (context) {
      history.push({
        role: "user",
        content: `Context: ${context}`,
      });
    }

    await commandProcessor.processCommand(
      input,
      (token: string) => process.stdout.write(token),
      history,
    );
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error(`Error: ${error.message}`);
    } else {
      logger.error(`Error: ${String(error)}`);
    }
  }
}

export { runAgentMode };
