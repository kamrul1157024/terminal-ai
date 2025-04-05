import { runAgentMode } from "./commands/agent";
import { processAiCommand } from "./commands/ai";
import { initCommand } from "./commands/init";
import { configExists } from "./utils/config";
import { logger } from "./utils/logger";
import "./utils/model-config"; // Ensure model config is loaded
import {
  runWithContext,
  setAutopilot,
  setCostTracker,
  setShowCostInfo,
} from "./utils/context-vars";
import { CumulativeCostTracker } from "./utils/pricing-calculator";

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
export async function processAiCommandWithContext(input: string, options: any) {
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
  if (!configExists()) {
    logger.info("Terminal AI is not configured. Running setup wizard...");
    await initCommand();
  }
}

/**
 * Sets up context variables for the AI session
 */
function setupContextVariables(options: any) {
  setAutopilot(options.autopilot);
  setCostTracker(new CumulativeCostTracker());
  setShowCostInfo(options.cost);
}

/**
 * Processes the command based on options
 */
async function processCommand(input: string, context: string, options: any) {
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