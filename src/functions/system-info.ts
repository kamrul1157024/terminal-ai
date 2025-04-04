import { FunctionDefinition } from "../llm/interface";
import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);

/**
 * Function definition for getting system information
 */
export const getSystemInfoFunction: FunctionDefinition = {
  name: "get_system_info",
  description: "Get information about the system",
  parameters: {
    type: "object",
    properties: {
      info_type: {
        type: "string",
        description: "Type of information to retrieve",
        enum: ["os", "cpu", "memory", "disk"],
      },
    },
    required: ["info_type"],
  },
};

/**
 * Implementation of the getSystemInfo function
 * @param args Function arguments
 * @returns System information as a string
 */
export async function getSystemInfoHandler(
  args: Record<string, any>,
): Promise<string> {
  const infoType = args.info_type;

  switch (infoType) {
    case "os":
      return (await execPromise("uname -a")).stdout;
    case "cpu":
      return (await execPromise("sysctl -n machdep.cpu.brand_string")).stdout;
    case "memory":
      return (await execPromise("vm_stat")).stdout;
    case "disk":
      return (await execPromise("df -h")).stdout;
    default:
      return "Unknown info type requested";
  }
}
