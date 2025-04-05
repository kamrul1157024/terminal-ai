import { runAgentMode } from "../commands/agent";
import { processAiCommand } from "../commands/ai";
import { initCommand } from "../commands/init";
import { Config } from "../config";
import { logger } from "../logger";
import "../config/model-config"; // Ensure model config is loaded
import { CumulativeCostTracker } from "../services/pricing";
import {
  runWithContext,
  setAutoApprove,
  setCostTracker,
  setShowCostInfo,
} from "../utils/context-vars";

type ProcessAICommandOptions = {
  autoApprove: boolean;
  cost: boolean;
  agent: boolean;
  thread: string;
};
/**
 * Reads content from stdin if data is being piped
 */
export async function readFromStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";

    // Check if stdin is available and has data being piped
    if (process.stdin.isTTY) {
      resolve("");
      return;
    }

    process.stdin.on("data", (chunk) => {
      data += chunk;
    });

    process.stdin.on("end", () => {
      resolve(data);
    });

    // Set encoding to utf8
    process.stdin.setEncoding("utf8");
    // Start reading
    process.stdin.resume();
  });
}

/**
 * Process an AI command with context
 */
export async function processAiCommandWithContext(
  input: string,
  options: ProcessAICommandOptions,
) {
  return runWithContext(async () => {
    await ensureConfigured();
    const pipedContent = await readFromStdin();
    setupContextVariables(options);

    await processCommand(input, pipedContent, options);
  });
}

/**
 * Ensures Terminal AI is configured
 */
async function ensureConfigured() {
  if (!Config.configExists()) {
    logger.info("Terminal AI is not configured. Running setup wizard...");
    await initCommand();
  }
}

/**
 * Sets up context variables for the AI session
 */
function setupContextVariables(options: ProcessAICommandOptions) {
  setAutoApprove(options.autoApprove);
  setCostTracker(new CumulativeCostTracker());
  setShowCostInfo(options.cost);
}

/**
 * Processes the command based on options
 */
async function processCommand(
  input: string,
  context: string,
  options: ProcessAICommandOptions,
) {
  if (options.agent) {
    await runAgentMode({
      input,
      context,
      threadId: options.thread,
    });
  } else {
    await processAiCommand(input, context);
  }
}
