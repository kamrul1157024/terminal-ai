import { runAgent } from "../commands/agent";
import { setupCommand } from "../commands/setup";
import { Config } from "../config";
import { logger } from "../logger";
import "../config/model-config"; // Ensure model config is loaded
import { CumulativeCostTracker } from "../services/pricing";
import {
  runWithContext,
  setActiveProfile,
  setAgentMode,
  setAutoApprove,
  setCostTracker,
  setDebug,
  setShowCostInfo,
} from "../utils/context-vars";

type ProcessAICommandOptions = {
  autoApprove: boolean;
  cost: boolean;
  agent: boolean;
  thread: string;
  profile?: string;
  debug?: boolean;
  interactive: boolean;
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

    await runAgent({
      input,
      context: pipedContent,
      threadId: options.thread,
      interactive: options.interactive,
    });
  });
}

/**
 * Ensures Terminal AI is configured
 */
async function ensureConfigured() {
  if (!Config.configExists()) {
    logger.info("Terminal AI is not configured. Running setup wizard...");
    await setupCommand();
  }
}

/**
 * Sets up context variables for the AI session
 */
function setupContextVariables(options: ProcessAICommandOptions) {
  setAutoApprove(options.autoApprove);
  setCostTracker(new CumulativeCostTracker());
  setShowCostInfo(options.cost);
  setDebug(options.debug ?? false);
  setAgentMode(options.agent);
  if (options.profile) {
    const config = Config.readConfig();
    if (config) {
      const requestedProfile = config.profiles.find(
        (p) => p.name === options.profile,
      );
      if (requestedProfile) {
        setActiveProfile(requestedProfile);
      } else {
        logger.warn(
          `Profile '${options.profile}' not found. Using default active profile.`,
        );
        setActiveProfile(Config.getActiveProfile());
      }
    }
  } else {
    // Use the default active profile
    setActiveProfile(Config.getActiveProfile());
  }
}