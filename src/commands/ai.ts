import { FunctionDefinitions, FunctionManager } from "../functions";
import { createLLMProvider } from "../llm";
import { Message, MessageRole } from "../llm/interface";
import { logger } from "../logger";
import { LLM } from "../services/llm";
import { showAssistantMessage } from "../ui/output";
import { getCostTracker, getShowCostInfo } from "../utils/context-vars";
import { getSystemInfoFromOS } from "../utils/system-info";

const BASIC_SYSTEM_PROMPT = `You are a helpful terminal assistant. Convert natural language requests into terminal commands as tool call of executeCommandFunction.

SYSTEM INFORMATION:
${getSystemInfoFromOS()}
`;

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
    logger.debug(`Processing: "${input}"`);
    if (context) {
      logger.debug(`With context: ${context}`);
    }

    const llmProvider = createLLMProvider();
    const functionManager = new FunctionManager();

    functionManager.registerFunction(FunctionDefinitions.commandExecutor);

    const llm = new LLM({
      llmProvider,
      systemPrompt: context ? CONTEXT_SYSTEM_PROMPT : BASIC_SYSTEM_PROMPT,
      functionManager,
    });

    let userInput = input;
    if (context) {
      userInput = `${context}\n${userInput}`;
    }

    const history: Message<MessageRole>[] = [];
    history.push({
      role: "user",
      content: userInput,
    });

    const { usage } = await llm.generateStreamingCompletion({
      onToken: (token: string) => showAssistantMessage(token),
      conversationHistory: history,
    });
    process.stdout.write("\n");
    getCostTracker()?.addUsage(usage);

    if (getShowCostInfo()) {
      getCostTracker()?.displayTotalCost();
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error(`Error: ${error.message}`);
    } else {
      logger.error(`Error: ${String(error)}`);
    }
  }
}
