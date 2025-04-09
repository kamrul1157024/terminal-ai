import { FunctionDefinitions, FunctionManager } from "../functions";
import { createLLMProvider } from "../llm";
import { Message, MessageRole } from "../llm/interface";
import { logger } from "../logger";
import getSystemPrompt from "../prompt";
import { LLM } from "../services/llm";
import { showAssistantMessage } from "../ui/output";
import { getCostTracker, getShowCostInfo } from "../utils/context-vars";


export async function processAiCommand(
  input: string,
  context?: string,
): Promise<void> {
  try {
    logger.debug(`Processing: "${input}"`);
    
    const llmProvider = createLLMProvider();
    const functionManager = new FunctionManager();

    functionManager.registerFunction(FunctionDefinitions.commandExecutor);

    const llm = new LLM({
      llmProvider,
      systemPrompt: await getSystemPrompt(context || ''),
      functionManager,
    });

    let userInput = input;

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