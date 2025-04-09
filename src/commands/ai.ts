import { FunctionDefinitions, FunctionManager } from "../functions";
import { createLLMProvider } from "../llm";
import { Message, MessageRole } from "../llm/interface";
import { logger } from "../logger";
import { LLM } from "../services/llm";
import { showAssistantMessage } from "../ui/output";
import { getCostTracker, getShowCostInfo } from "../utils/context-vars";
import { getGitInfo } from "../utils/git-info";
import { getSystemInfoFromOS } from "../utils/system-info";

const BASIC_SYSTEM_PROMPT = `You are a helpful terminal assistant. Convert natural language requests into terminal commands as tool call of executeCommandFunction.

SYSTEM INFORMATION:
${getSystemInfoFromOS()}
`;

const CONTEXT_SYSTEM_PROMPT = `You are a helpful terminal assistant. Convert natural language requests into terminal commands. 
  Use the provided context to inform your command generation. 
  use the \`execute_command\` function to execute terminal commands.
  if user asks question that is not related to terminal commands respond user question.
  `;

export async function processAiCommand(
  input: string,
  context?: string,
): Promise<void> {
  try {
    logger.debug(`Processing: "${input}"`);
    
    // Get git information
    const gitInfo = await getGitInfo();
    let fullContext = context || '';
    
    if (gitInfo) {
      fullContext = fullContext ? `${fullContext}\n\n${gitInfo}` : gitInfo;
    }

    if (fullContext) {
      logger.debug(`With context: ${fullContext}`);
    }

    const llmProvider = createLLMProvider();
    const functionManager = new FunctionManager();

    functionManager.registerFunction(FunctionDefinitions.commandExecutor);

    const llm = new LLM({
      llmProvider,
      systemPrompt: fullContext ? CONTEXT_SYSTEM_PROMPT : BASIC_SYSTEM_PROMPT,
      functionManager,
    });

    let userInput = input;
    if (fullContext) {
      userInput = `${fullContext}\n${userInput}`;
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