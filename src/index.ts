#!/usr/bin/env node

import { Command } from "commander";
import { processAiCommand, runAgentMode } from "./commands/ai";
import { initCommand } from "./commands/init";
import { configExists } from "./utils/config";
import { logger } from "./utils/logger";
import "./utils/model-config"; // Ensure model config is loaded
import { setAutopilot } from "./utils/context-vars";

// Package version from package.json
const packageJson = require("../package.json");

// Create a new command instance
const program = new Command();

program
  .name("ai")
  .description("AI-powered terminal command interpreter")
  .version(packageJson.version);

// Add init command
program
  .command("init")
  .description("Initialize and configure Terminal AI")
  .action(async () => {
    await initCommand();
  });

// Read from stdin if data is being piped
async function readFromStdin(): Promise<string> {
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

// Add the main command
program
  .argument("<input>", "The command to interpret")
  .option("-a, --agent", "Run in agent mode with continuous conversation")
  .option("--autopilot", "Run in autopilot mode")
  .action(async (input: string, options) => {
    // Check if config exists
    if (!configExists()) {
      logger.info("Terminal AI is not configured. Running setup wizard...");
      await initCommand();
    }

    // Read piped content if any
    const pipedContent = await readFromStdin();

    setAutopilot(options.autopilot);

    if (options.agent) {
      await runAgentMode({
        input,
        context: pipedContent,
      });
    } else {
      await processAiCommand(input, pipedContent);
    }
  });

// Parse arguments
program.parse(process.argv);

// If no command is provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
