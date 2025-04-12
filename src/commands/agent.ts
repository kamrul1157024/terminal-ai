import chalk from "chalk";
import inquirer from "inquirer";

import { createLLMProvider } from "../llm";
import { logger } from "../logger";
import getSystemPrompt from "../prompt";
import { Thread } from "../repositories";
import { SQLiteThreadRepository } from "../repositories";
import { LLM } from "../services/llm";
import { ToolManager } from "../tools";
import * as ToolDefinitions from "../tools/definitions";
import {
  displayConversationHistory,
  showAssistantMessage,
  showUserMessage,
} from "../ui/output";
import { getCostTracker } from "../utils/context-vars";
const EXIT_COMMANDS = ["exit", "quit", "q"];
const HELP_COMMAND = "help";
const PROMPT_SYMBOL = chalk.green(">> ");
const EMPTY_INPUT_MESSAGE = chalk.yellow(
  "Please enter a command or question. Type \\help for available commands.",
);
const EXIT_MESSAGE = chalk.blue("Exiting agent mode");
const HELP_MESSAGE = chalk.cyan(`
Available commands:
  exit, quit, q - Exit agent mode
  help - Show this help message
`);

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

  if (trimmedInput === HELP_COMMAND) {
    logger.info(HELP_MESSAGE);
    return processUserInput();
  }

  if (!trimmedInput) {
    logger.info(EMPTY_INPUT_MESSAGE);
    return processUserInput();
  }

  return { shouldContinue: true, input: trimmedInput };
}

export interface AgentModeOptions {
  input: string;
  context?: string;
  threadId?: string;
  interactive?: boolean;
  showCost?: boolean;
}

export async function runAgent({
  input,
  context,
  threadId,
  interactive,
  showCost,
}: AgentModeOptions): Promise<void> {
  try {
    const toolManager = new ToolManager();
    toolManager.registerTool(ToolDefinitions.commandExecutor);
    toolManager.registerTool(ToolDefinitions.workflowDiscoverer);
    toolManager.registerToolGroup(ToolDefinitions.browserToolGroup);
    
    const llmProvider = createLLMProvider();
    const llm = new LLM({
      llmProvider,
      systemPrompt: await getSystemPrompt(
        context || "" + toolManager.getToolPrompt(),
      ),
      toolManager,
    });

    const threadRepository = new SQLiteThreadRepository();

    let thread: Thread;
    if (threadId) {
      const existingThread = await threadRepository.getThread(threadId);
      if (!existingThread) {
        thread = await threadRepository.createThread();
      } else {
        thread = existingThread;
        displayConversationHistory(thread, toolManager);
      }
    } else {
      thread = await threadRepository.createThread();
    }

    let conversationHistory = thread.messages;
    let userInput = input;

    if (context && context.trim()) {
      userInput = `${userInput}\n\nAdditional context from piped input:\n${context}`;
    }

    // Add the initial user message if starting a new conversation
    if (conversationHistory.length === 0) {
      if (!userInput.trim()) {
        // Welcome message for new threads
        logger.info(chalk.cyan.bold("\n=== Terminal AI Assistant ==="));
        logger.info(
          chalk.cyan(
            "Type your questions or commands. Type \\help for available commands.\n",
          ),
        );

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
      await threadRepository.updateThread(thread.id, conversationHistory);
    }

    while (true) {
      const lastMessage = conversationHistory[conversationHistory.length - 1];
      if (lastMessage.role === "user") {
        showUserMessage(lastMessage.content);
      }

      if (lastMessage.role === "user" || lastMessage.role === "tool") {
        const { history, usage } = await llm.generateStreamingCompletion({
          onToken: (token: string) => {
            showAssistantMessage(token);
            return;
          },
          conversationHistory,
        });

        conversationHistory = history;

        // Update the thread with new messages
        await threadRepository.updateThread(thread.id, conversationHistory);

        // If this is a new thread with the default name and we now have both user input and AI response,
        // generate a better name based on the conversation content
        if (
          thread.name.startsWith("Thread-") &&
          conversationHistory.length >= 2
        ) {
          const userMessage =
            conversationHistory.find((msg) => msg.role === "user")?.content ||
            "";
          const aiResponse =
            conversationHistory.find((msg) => msg.role === "assistant")
              ?.content || "";

          // Create a name by combining user input and AI response
          const combinedContent = `${userMessage} ${aiResponse}`;
          // Trim to max 120 chars and add ellipsis if truncated
          const truncatedName =
            combinedContent.length > 120
              ? `${combinedContent.substring(0, 120).trim()}...`
              : combinedContent;

          // Update the thread name
          await threadRepository.renameThread(thread.id, truncatedName);
        }

        getCostTracker()?.addUsage(usage);
      } else if (interactive) {
        logger.info(chalk.dim("─".repeat(process.stdout.columns || 80)));

        const { shouldContinue, input } = await processUserInput();
        if (!shouldContinue) {
          break;
        }
        conversationHistory.push({
          role: "user",
          content: input,
        });
      } else {
        break;
      }
    }

    // Show a nice exit message with cost info
    logger.info(chalk.dim("─".repeat(process.stdout.columns || 80)));
    logger.info(chalk.blue.bold("Session ended."));
    if (showCost) {
      getCostTracker()?.displayTotalCost();
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.info(chalk.red(`\n❌ Error: ${error.message}`));
      logger.error(`Error in agent mode: ${error.message}`);
    } else {
      logger.info(chalk.red(`\n❌ Error: ${String(error)}`));
      logger.error(`Error in agent mode: ${String(error)}`);
    }
  }
}
