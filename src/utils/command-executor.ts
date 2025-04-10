import { exec, spawn } from "child_process";
import * as os from "os";
import { promisify } from "util";

import { terminalError, terminalOutput } from "../ui/output";

const execPromise = promisify(exec);
let defaultShell: string | null = null;

// Function to get the user's default shell
const getDefaultShell = async (): Promise<string> => {
  if (defaultShell) return defaultShell;

  const platform = os.platform();

  if (platform === "win32") {
    defaultShell = "powershell.exe";
    return defaultShell;
  }

  try {
    // Use direct command execution to avoid recursive calls
    const shell = execPromise("echo $SHELL", { shell: "/bin/sh" })
      .then((result) => result.stdout.trim())
      .catch(() => {
        // Fallback to common shells based on platform
        if (platform === "darwin") return "/bin/zsh";
        return "/bin/bash";
      });

    defaultShell = await shell;
    return defaultShell;
  } catch {
    if (platform === "darwin") {
      defaultShell = "/bin/zsh";
    } else {
      defaultShell = "/bin/bash";
    }
    return defaultShell;
  }
};

async function spawnCommand(
  command: string,
  args: string[],
  shell: string,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell,
      stdio: ['inherit', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      stdout += output;
      terminalOutput(output);
    });

    child.stderr?.on('data', (data: Buffer) => {
      const error = data.toString();
      stderr += error;
      terminalError(error);
    });

    child.on('close', (code: number) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });

    child.on('error', (error: Error) => {
      reject(error);
    });
  });
}

export async function executeCommand(
  command: string,
  requiresSudo: boolean,
): Promise<{ stdout: string; stderr: string }> {
  try {
    const formattedCommand = command.trim();
    const platform = os.platform();
    const isWindows = platform === "win32";
    const shell = await getDefaultShell();

    let executableCommand = formattedCommand;

    if (
      formattedCommand.includes("\n") ||
      formattedCommand.includes("'") ||
      formattedCommand.includes('"') ||
      formattedCommand.includes("`")
    ) {
      if (isWindows) {
        executableCommand = formattedCommand
          .replace(/"/g, '`"')
          .replace(/`/g, "``");
      } else {
        executableCommand = formattedCommand.replace(/`/g, "\\`");
        const quotedStringRegex = /(['"])((?:\\\1|(?!\1).)*?)(\1)/g;
        executableCommand = executableCommand.replace(
          quotedStringRegex,
          (match, quote, content) => {
            if (content.includes("\n") || content.includes("'")) {
              return `$'${content.replace(/'/g, "\\'").replace(/\n/g, "\\n")}'`;
            }
            return match;
          },
        );
      }
    }

    if (requiresSudo) {
      if (isWindows) {
        return {
          stdout: "",
          stderr:
            "Administrator privileges are required. Please run this command manually with admin rights.",
        };
      } else {
        return spawnCommand('sudo', [executableCommand], shell);
      }
    }

    // Regular command execution (no sudo)
    return spawnCommand(executableCommand, [], shell);
  } catch (error) {
    if (error instanceof Error) {
      return { stdout: "", stderr: `Command failed: ${error.message}` };
    }
    return { stdout: "", stderr: `Command failed: ${String(error)}` };
  }
}