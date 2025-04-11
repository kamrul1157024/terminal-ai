import inquirer from "inquirer";
import { z } from "zod";

import { logger } from "../../logger";
import { isSystemQueryingCommand } from "../../utils";
import { executeCommand } from "../../utils/command-executor";
import { getAutoApprove } from "../../utils/context-vars";
import { LLMTool } from "../types";

export const executeCommandHandler = async (args: {
  command: string;
}): Promise<{ stdout: string; stderr: string }> => {
  const command = args.command;
  if (!isSystemQueryingCommand(command) && !getAutoApprove()) {
    const { confirm } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirm",
        message: "This command may modify your system. Do you want to proceed?",
        default: false,
      },
    ]);

    if (!confirm) {
      return {
        stdout: "",
        stderr:
          "After asking for confirmation, user do not want to proceed with this command.",
      };
    }
  }

  try {
    const { stdout, stderr } = await executeCommand(command, false);

    if (stderr) {
      logger.error(`Command error: ${stderr}`);
    }
    return { stdout, stderr };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code !== 0) {
      logger.error(`Command failed with error: ${error.message}`);

      const { useSudo } = await inquirer.prompt([
        {
          type: "confirm",
          name: "useSudo",
          message: "Command failed. Retry with sudo?",
          default: false,
        },
      ]);

      if (useSudo) {
        const { stdout, stderr } = await executeCommand(command, true);
        return { stdout, stderr };
      }
    }
    return {
      stdout: "",
      stderr: `Trying to run command with sudo but user denied.`,
    };
  }
};

const ArgumentsSchema = z.object({
  command: z.string({
    description:
      "The terminal command to execute with shell try to return in single line",
  }),
});

export const commandExecutor: LLMTool<typeof ArgumentsSchema> = {
  name: "execute_command",
  description: "Execute a terminal command and return the result",
  args: ArgumentsSchema,
  prompt: `
    use the \`execute_command\` function to execute terminal commands.
    if user asks question that is not related to terminal commands respond user question.
  `,
  handler: async ({ command }) => {
    const { stdout, stderr } = await executeCommandHandler({ command });
    return { data: stdout, error: stderr };
  },
  render: ({ command }) => {
    logger.command(command);
  },
};
