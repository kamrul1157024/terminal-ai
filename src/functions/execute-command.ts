import { FunctionDefinition } from "../llm/interface";
import { exec, ExecOptions } from "child_process";
import { promisify } from "util";
import inquirer from "inquirer";
import { logger } from "../utils/logger";
import { isSystemQueryingCommand } from "../utils";
import { getAutoApprove } from "../utils/context-vars";
import * as os from "os";

const execPromise = promisify(exec);

export const executeCommandFunction: FunctionDefinition = {
  name: "execute_command",
  description: "Execute a terminal command and return the result",
  parameters: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description:
          "The terminal command to execute with shell try to return in single line",
      },
      requiresSudo: {
        type: "boolean",
        description: "Whether the command requires sudo",
      },
    },
    required: ["command", "requiresSudo"],
  },
};

// Detect default shell once at module level
let defaultShell: string | null = null;

// Function to get the user's default shell
const getDefaultShell = async (): Promise<string> => {
  if (defaultShell) return defaultShell;
  
  const platform = os.platform();
  
  if (platform === 'win32') {
    defaultShell = 'powershell.exe';
    return defaultShell;
  }
  
  try {
    // Use direct command execution to avoid recursive calls
    const shell = execPromise('echo $SHELL', { shell: '/bin/sh' })
      .then(result => result.stdout.trim())
      .catch(() => {
        // Fallback to common shells based on platform
        if (platform === 'darwin') return '/bin/zsh';
        return '/bin/bash';
      });
    
    defaultShell = await shell;
    return defaultShell;
  } catch (e) {
    // Default fallbacks
    if (platform === 'darwin') {
      defaultShell = '/bin/zsh';
    } else {
      defaultShell = '/bin/bash';
    }
    return defaultShell;
  }
};

async function executeCommand(
  command: string,
  requiresSudo: boolean,
): Promise<{ stdout: string; stderr: string }> {
  try {
    // Preserve multiline commands by ensuring they're properly formatted
    const formattedCommand = command.trim();
    
    // Determine appropriate shell and sudo based on OS
    const platform = os.platform();
    const isWindows = platform === 'win32';
    
    // Get shell based on platform
    const shell = await getDefaultShell();
    
    // Options to ensure proper shell interpretation of multiline commands
    const execOptions: ExecOptions = {
      shell,
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer for large outputs
    };
    
    // Process the command to handle multi-line content appropriately
    let executableCommand = formattedCommand;
    
    // Check if command contains newlines or quotes that need special handling
    if (formattedCommand.includes('\n') || formattedCommand.includes("'") || formattedCommand.includes('"')) {
      if (isWindows) {
        // For Windows PowerShell
        executableCommand = formattedCommand.replace(/"/g, '`"');
      } else {
        // For Unix shells (bash/zsh)
        // Instead of wrapping the entire command, we'll identify and process quoted parts
        
        // Simple technique - if we find a quoted string with newlines inside, fix just that part
        const quotedStringRegex = /(['"])((?:\\\1|(?!\1).)*?)(\1)/g;
        executableCommand = formattedCommand.replace(quotedStringRegex, (match, quote, content) => {
          if (content.includes('\n') || content.includes("'")) {
            // Replace the quoted content with a $'' escaped version if it contains newlines or quotes
            return `$'${content.replace(/'/g, "\\'").replace(/\n/g, "\\n")}'`;
          }
          return match; // Leave it unchanged if no newlines
        });
      }
    }
    
    if (requiresSudo) {
      if (isWindows) {
        // On Windows, use PowerShell with elevated privileges
        try {
          // For Windows, we need to handle elevated privileges differently
          // This approach uses a temporary VBS script to request elevation
          const escapedCommand = executableCommand.replace(/"/g, '\\"');
          
          // For simplicity and security, we'll just warn the user
          return { 
            stdout: "", 
            stderr: "Administrator privileges are required. Please run this command manually with admin rights." 
          };
        } catch (error: any) {
          return { stdout: "", stderr: `Failed to run with admin privileges: ${error.message}` };
        }
      } else {
        // Unix-based systems use sudo
        const { stdout, stderr } = await execPromise(`sudo ${executableCommand}`, execOptions);
        return { stdout, stderr };
      }
    }
    
    // Regular command execution (no sudo)
    const { stdout, stderr } = await execPromise(executableCommand, execOptions);
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
      return { stdout: "", stderr: "User do not want to proceed with this command." };
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
