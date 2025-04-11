import chalk from "chalk";
import inquirer from "inquirer";

import { Message, MessageRole } from "../llm/interface";
import { logger } from "../logger";
import { Thread } from "../repositories";
import { ToolManager } from "../tools/manager";
import { getAgentMode } from "../utils/context-vars";

export function displayThreadsList(threads: Thread[]) {
  const formattedThreads = formatThreadsForDisplay(threads);

  formattedThreads.forEach((thread) => {
    logger.info(`${chalk.cyan(thread.index)}. ${thread.displayString}`);
  });
}

export function formatThreadsForDisplay(threads: Thread[]) {
  return threads.map((thread, index) => {
    const messageCount = thread.messages.length;
    const lastUpdate = thread.updatedAt.toLocaleString();

    return {
      index: index + 1,
      id: thread.id,
      name: thread.name,
      messageCount,
      lastUpdate,
      displayString: `${chalk.green(thread.name)} ${chalk.gray(`(ID: ${thread.id})`)}\n   ${chalk.yellow(`Messages: ${messageCount}`)} • ${chalk.blue(`Last updated: ${lastUpdate}`)}`,
    };
  });
}

export function displayConversationHistory(
  thread: Thread,
  functionManager: ToolManager,
) {
  if (thread.messages.length > 0) {
    thread.messages.forEach((message: Message<MessageRole>) => {
      if (message.role === "user") {
        showUserMessage(message.content);
        return;
      }
      if (message.role === "assistant") {
        showAssistantMessagePrefix();
        showAssistantMessage(message.content);
        return;
      }
      if (message.role === "tool_call") {
        message.content.forEach((toolCall) => {
          functionManager.handleToolCallRender(toolCall);
        });
      }
      if (message.role === "tool") {
        const data = JSON.parse(message.content[0].result);
        if (data.error) {
          logger.error(data.error);
        } else {
          logger.info(data.data);
        }
        return;
      }
    });
  }
}

export async function promptThreadAction(): Promise<string> {
  const { action } = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: "What would you like to do?",
      choices: [
        { name: "Attach to a thread", value: "attach" },
        { name: "Return to command line", value: "exit" },
      ],
    },
  ]);

  return action;
}

export async function promptThreadSelection(
  threads: Thread[],
): Promise<string> {
  const formattedThreads = formatThreadsForDisplay(threads);

  process.on("SIGINT", () => {
    logger.info(chalk.yellow("\nOperation cancelled by user. Exiting..."));
    process.exit(0);
  });

  const { selectedThread } = await inquirer.prompt([
    {
      type: "list",
      name: "selectedThread",
      message: "Select a thread to attach:",
      choices: formattedThreads.map((thread) => ({
        name: `[${thread.id}] ${thread.name}`,
        value: thread.id,
      })),
    },
  ]);

  return selectedThread;
}

export function isTTY() {
  return process.stdout.isTTY;
}

export function showUserMessage(message: string) {
  if (!isTTY()) {
    return;
  }
  logger.info(chalk.bold.cyan("You: ") + chalk.white(message));
}

export function showAssistantMessagePrefix() {
  if (!isTTY() || !getAgentMode()) {
    return;
  }
  process.stdout.write(chalk.bold.yellow("LLM: "));
}

export function showAssistantMessage(message: string) {
  if (!isTTY()) {
    return process.stdout.write(message);
  }
  process.stdout.write(chalk.white(message));
}

export function terminalOutput(message: string) {
  process.stdout.write(chalk.blue(message));
}

export function terminalError(message: string) {
  process.stderr.write(chalk.red(message));
}
