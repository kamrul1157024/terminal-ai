import { exec, spawn } from "child_process";
import { promisify } from "util";
import { logger } from "./logger";

const execPromise = promisify(exec);

/**
 * Execute a terminal command
 * @param command The command to execute
 * @param useSudo Whether to use sudo
 * @param stream Whether to stream output without waiting for completion
 * @returns Promise that resolves when the command is complete
 */
export async function execTerminalCommand(
  command: string,
  useSudo: boolean,
  stream: boolean = false,
): Promise<string> {
  try {
    const finalCommand = useSudo ? `sudo ${command}` : command;

    if (stream) {
      // For streaming mode, use spawn and don't wait for completion
      const childProcess = spawn(finalCommand, {
        shell: true,
        stdio: "inherit", // This will automatically pipe output to parent process
      });

      // Return immediately for streaming commands
      return "";
    } else {
      // For normal mode, wait for process to complete
      const { stdout, stderr } = await execPromise(finalCommand);

      if (stderr) {
        logger.error(`Command error: ${stderr}`);
      }

      logger.info(stdout);
      return stdout;
    }
  } catch (error: any) {
    logger.error(`Command execution failed: ${error.message}`);
    throw error;
  }
}
