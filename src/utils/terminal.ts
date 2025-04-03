import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

/**
 * Execute a terminal command
 * @param command The command to execute
 * @param useSudo Whether to use sudo
 * @returns Promise that resolves when the command is complete
 */
export async function execTerminalCommand(command: string, useSudo: boolean): Promise<string> {
  try {
    const finalCommand = useSudo ? `sudo ${command}` : command;
    const { stdout, stderr } = await execPromise(finalCommand);
    
    if (stderr) {
      console.error(`Command error: ${stderr}`);
    }
    
    console.log(stdout);
    return stdout;
  } catch (error: any) {
    console.error(`Command execution failed: ${error.message}`);
    throw error;
  }
} 