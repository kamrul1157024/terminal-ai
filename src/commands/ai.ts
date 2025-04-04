import inquirer from "inquirer";
import { execTerminalCommand, isSystemModifyingCommand } from "../utils";
import { createLLMProvider } from "../llm";
import { CommandProcessor } from "../services";
import { getSystemInfoFunction, getSystemInfoHandler } from "../functions";
import { runAgentMode } from "./agent";
import { Message, MessageRole } from "../llm/interface";
import { logger } from "../utils/logger";
import { FunctionCallProcessor } from "../services/functioncall-processor";

const BASIC_SYSTEM_PROMPT = `You are a helpful terminal assistant. Convert natural language requests into terminal commands. 
  Respond with ONLY the terminal command, nothing else. And try to respond with single line commands.`;

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

    const terminalCommand = await commandProcessor.processCommand(
      input,
      (token: string) => process.stdout.write(token),
      history,
    );

    await executeTerminalCommand(terminalCommand);
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error(`Error: ${error.message}`);
    } else {
      logger.error(`Error: ${String(error)}`);
    }
  }
}

async function executeTerminalCommand(command: string): Promise<void> {
  const bashBlockRegex = /```(?:bash|sh)?\s*([\s\S]*?)```/;
  const match = command.match(bashBlockRegex);

  if (!match) {
    return;
  }

  const commandToExecute = match[1].trim();

  if (!commandToExecute) {
    logger.warn("No valid commands found in the code block");
    return;
  }

  const lines = commandToExecute
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line);

  const isLogCommand = lines.some((line) => isLogTailingCommand(line));
  if (isLogCommand) {
    logger.info("Log tailing command detected. Starting stream:");
    await execTerminalCommand(commandToExecute, false, true);
    return;
  }

  if (lines.length > 1) {
    logger.info("Multiline command detected. Using eval for execution...");

    if (isSystemModifyingCommand(commandToExecute)) {
      logger.warn(
        `>>>> Multiline command may modify the system. Execute? y or n?`,
      );

      const { confirm } = await inquirer.prompt<{ confirm: string }>([
        {
          type: "input",
          name: "confirm",
          message: "",
        },
      ]);

      if (confirm.toLowerCase() === "y") {
        try {
          await execTerminalCommand(
            `eval "${commandToExecute.replace(/"/g, '\\"')}"`,
            false,
            false,
          );
        } catch (error) {
          const { sudoConfirm } = await inquirer.prompt<{
            sudoConfirm: string;
          }>([
            {
              type: "input",
              name: "sudoConfirm",
              message: "Command failed. Retry with sudo? (y/n):",
            },
          ]);

          if (sudoConfirm.toLowerCase() === "y") {
            await execTerminalCommand(
              `sudo eval "${commandToExecute.replace(/"/g, '\\"')}"`,
              true,
              false,
            );
          }
        }
      }
    } else {
      logger.command("Executing multiline command with eval");
      try {
        await execTerminalCommand(
          `eval "${commandToExecute.replace(/"/g, '\\"')}"`,
          false,
          false,
        );
      } catch (error) {
        logger.error("Command execution failed");
      }
    }
  } else if (lines.length === 1) {
    await executeSingleCommand(lines[0]);
  }
}

function isLogTailingCommand(command: string): boolean {
  const tailingPatterns = [
    /docker logs -f/,
    /tail -f/,
    /kubectl logs -f/,
    /journalctl -f/,
  ];
  return tailingPatterns.some((pattern) => pattern.test(command));
}

async function executeSingleCommand(
  command: string,
  stream: boolean = false,
): Promise<void> {
  if (isSystemModifyingCommand(command)) {
    logger.warn(`>>>> \`${command}\` y or n?`);

    const { confirm } = await inquirer.prompt<{ confirm: string }>([
      {
        type: "input",
        name: "confirm",
        message: "",
      },
    ]);

    if (confirm.toLowerCase() === "y") {
      try {
        await execTerminalCommand(command, false, stream);
      } catch (error) {
        // If command fails, try with sudo
        const { sudoConfirm } = await inquirer.prompt<{ sudoConfirm: string }>([
          {
            type: "input",
            name: "sudoConfirm",
            message: "Command failed. Retry with sudo? (y/n):",
          },
        ]);

        if (sudoConfirm.toLowerCase() === "y") {
          await execTerminalCommand(command, true, stream);
        }
      }
    }
  } else {
    logger.command(command);
    try {
      await execTerminalCommand(command, false, stream);
    } catch (error) {
      logger.error("Command execution failed");
    }
  }
}

export { runAgentMode };
