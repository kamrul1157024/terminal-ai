import { FunctionDefinition } from "../llm/interface";
import { exec } from "child_process";
import { promisify } from "util";
import inquirer from "inquirer";
import { logger } from "../utils/logger";
import { isSystemQueryingCommand } from "../utils";

const execPromise = promisify(exec);

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
      requiresSudo: {
        type: "boolean",
        description: "Whether the command requires sudo",
      },
    },
    required: ["command", "requiresSudo"],
  },
};

async function executeCommand(
  command: string,
  requiresSudo: boolean,
): Promise<{ stdout: string; stderr: string }> {
  try {
    if (requiresSudo) {
      const { stdout, stderr } = await execPromise(`sudo ${command}`);
      return { stdout, stderr };
    }
    const { stdout, stderr } = await execPromise(command);
    return { stdout, stderr };
  } catch (error: any) {
    return { stdout: "", stderr: `Command failed: ${error.message}` };
  }
}

export const executeCommandHandler = async (args: {
  command: string;
  requiresSudo: boolean;
}): Promise<{ stdout: string; stderr: string }> => {
  const command = args.command;
  const requiresSudo = args.requiresSudo;

  logger.command(requiresSudo ? `sudo ${command}` : command);

  if (!isSystemQueryingCommand(command)) {
    const { confirm } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirm",
        message: "This command may modify your system. Do you want to proceed?",
        default: false,
      },
    ]);

    if (!confirm) {
      return { stdout: "", stderr: "Command execution canceled by user." };
    }
  }

  try {
    const { stdout, stderr } = await executeCommand(command, requiresSudo);

    if (stderr) {
      logger.error(`Command error: ${stderr}`);
    }

    logger.info(stdout);
    return { stdout, stderr };
  } catch (error: any) {
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
