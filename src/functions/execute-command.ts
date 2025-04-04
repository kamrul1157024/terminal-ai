import { FunctionDefinition } from "../llm/interface";
import { isSystemModifyingCommand } from "../utils";
import { exec } from "child_process";
import { promisify } from "util";
import inquirer from "inquirer";
import { logger } from "../utils/logger";

const execPromise = promisify(exec);

/**
 * Function definition for executing terminal commands
 */
export const executeCommandFunction: FunctionDefinition = {
  name: "execute_command",
  description: "Execute a terminal command and return the result",
  parameters: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "The terminal command to execute",
      },
    },
    required: ["command", "reasoning"],
  },
};

/**
 * Handler for executing commands
 * @param args Function arguments containing command and reasoning
 * @returns The command output
 */
export const executeCommandHandler = async (
  args: Record<string, any>,
): Promise<string> => {
  const command = args.command;

  logger.info(`>> ${command}`);

  if (isSystemModifyingCommand(command)) {
    // Ask for confirmation for potentially dangerous commands
    const { confirm } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirm",
        message: "This command may modify your system. Do you want to proceed?",
        default: false,
      },
    ]);

    if (!confirm) {
      return "Command execution canceled by user.";
    }
  }

  try {
    // Execute the command
    logger.command(command);
    const { stdout, stderr } = await execPromise(command);

    if (stderr) {
      logger.error(`Command error: ${stderr}`);
    }

    logger.info(stdout);
    return `Command output:\n${stdout}${stderr ? "\nErrors:\n" + stderr : ""}`;
  } catch (error: any) {
    // If command fails, try with sudo
    if (error.code !== 0) {
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
        try {
          logger.command(`sudo ${command}`);
          const { stdout, stderr } = await execPromise(`sudo ${command}`);

          if (stderr) {
            logger.error(`Command error: ${stderr}`);
          }

          logger.info(stdout);
          return `Command output (with sudo):\n${stdout}${stderr ? "\nErrors:\n" + stderr : ""}`;
        } catch (sudoError: any) {
          return `Command failed with sudo: ${sudoError.message}`;
        }
      }
    }

    return `Command failed: ${error.message}`;
  }
};
