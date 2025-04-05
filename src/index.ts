#!/usr/bin/env node

import { Command } from "commander";
import { processAiCommand } from "./commands/ai";
import { runAgentMode } from "./commands/agent";
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
import { SQLiteSessionManager } from "./session-manager";

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

// Add thread commands
const threadCommand = program
  .command("thread")
  .description("Manage conversation threads");

// Add thread list command
threadCommand
  .command("list")
  .description("List all conversation threads")
  .action(async () => {
    const sessionManager = new SQLiteSessionManager();
    const threads = await sessionManager.listThreads();
    
    if (threads.length === 0) {
      logger.info("No threads found.");
      return;
    }
    
    console.log("Conversation threads:");
    console.log("====================");
    
    threads.forEach((thread, index) => {
      const messageCount = thread.messages.length;
      const lastUpdate = thread.updatedAt.toLocaleString();
      console.log(`${index + 1}. ${thread.name} (ID: ${thread.id})`);
      console.log(`   Messages: ${messageCount}, Last updated: ${lastUpdate}`);
    });
  });

// Add thread delete command
threadCommand
  .command("delete <thread-id>")
  .description("Delete a specific conversation thread")
  .action(async (threadId: string) => {
    const sessionManager = new SQLiteSessionManager();
    const thread = await sessionManager.getThread(threadId);
    
    if (!thread) {
      logger.error(`Thread with ID ${threadId} not found.`);
      return;
    }
    
    const result = await sessionManager.deleteThread(threadId);
    if (result) {
      logger.info(`Thread "${thread.name}" (ID: ${threadId}) deleted successfully.`);
    } else {
      logger.error(`Failed to delete thread with ID ${threadId}.`);
    }
  });

// Add thread attach command
threadCommand
  .command("attach <thread-id>")
  .description("Attach to an existing conversation thread")
  .action(async (threadId: string) => {
    const sessionManager = new SQLiteSessionManager();
    const thread = await sessionManager.getThread(threadId);
    
    if (!thread) {
      logger.error(`Thread with ID ${threadId} not found.`);
      return;
    }
    
    logger.info(`Attaching to thread: ${thread.name} (ID: ${thread.id})`);
    
    // Print the existing conversation
    if (thread.messages.length > 0) {
      console.log("\nConversation history:");
      console.log("====================");
      
      // Display conversation history
      thread.messages.forEach((message) => {
        const role = message.role.charAt(0).toUpperCase() + message.role.slice(1);
        if (message.role === "user" || message.role === "assistant") {
          console.log(`\n${role}: ${message.content}`);
        }
      });
      
      console.log("\n====================");
      console.log("Continuing conversation. Type your message below:");
    }
    
    // Start agent mode with this thread
    await runWithContext(async () => {
      setAutopilot(false);
      setCostTracker(new CumulativeCostTracker());
      setShowCostInfo(false);
      
      await runAgentMode({
        input: "",
        threadId: thread.id,
      });
    });
  });

// Add thread rename command
threadCommand
  .command("rename <thread-id> <new-name>")
  .description("Rename an existing conversation thread")
  .action(async (threadId: string, newName: string) => {
    const sessionManager = new SQLiteSessionManager();
    const thread = await sessionManager.getThread(threadId);
    
    if (!thread) {
      logger.error(`Thread with ID ${threadId} not found.`);
      return;
    }
    
    try {
      const oldName = thread.name;
      const updatedThread = await sessionManager.renameThread(threadId, newName);
      logger.info(`Thread renamed from "${oldName}" to "${updatedThread.name}" (ID: ${threadId}).`);
    } catch (error) {
      logger.error(`Failed to rename thread: ${error}`);
    }
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

function processAiCommandWithContext(input: string, options: any) {
  return runWithContext(async () => {
    if (!configExists()) {
      logger.info("Terminal AI is not configured. Running setup wizard...");
      await initCommand();
    }

    const pipedContent = await readFromStdin();

    setAutopilot(options.autopilot);
    setCostTracker(new CumulativeCostTracker());
    setShowCostInfo(options.cost);

    if (options.agent) {
      await runAgentMode({
        input,
        context: pipedContent,
        threadId: options.thread,
      });
    } else {
      await processAiCommand(input, pipedContent);
    }
  });
}

// Add the main command
program
  .argument("<input>", "The command to interpret")
  .option("-a, --agent", "Run in agent mode with continuous conversation")
  .option("--autopilot", "Run in autopilot mode")
  .option("--cost", "Show cost information")
  .option("-t, --thread <threadId>", "Continue conversation in specified thread")
  .action(async (input: string, options) => {
    await processAiCommandWithContext(input, options);
  });

// Parse arguments
program.parse(process.argv);

// If no command is provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
