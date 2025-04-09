import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);

export async function getUserAliases(): Promise<string> {
  try {
    const { stdout } = await execPromise("alias");
    return stdout;
  } catch (error) {
    return "";
  }
}

export async function getAvailableCommands(): Promise<string> {
  try {
    const { stdout } = await execPromise("compgen -c");
    return stdout;
  } catch (error) {
    return "";
  }
} 