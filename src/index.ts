#!/usr/bin/env node

import { Command } from "commander";
import { initCommand } from "./commands/init";
import * as threadManager from "./thread-manager";
import * as inputProcessor from "./input-processor";

// Package version from package.json
const packageJson = require("../package.json");

/**
 * Sets up the command line program
 */
function setupProgram() {
  // Create a new command instance
  const program = new Command();

  program
    .name("ai")
    .description("AI-powered terminal command interpreter")
    .version(packageJson.version);

  setupInitCommand(program);
  setupThreadCommands(program);
  setupMainCommand(program);

  return program;
}

/**
 * Sets up the init command
 */
function setupInitCommand(program: Command) {
  program
    .command("init")
    .description("Initialize and configure Terminal AI")
    .action(async () => {
      await initCommand();
    });
}

/**
 * Sets up all thread related commands
 */
function setupThreadCommands(program: Command) {
  // Add thread commands
  const threadCommand = program
    .command("thread")
    .description("Manage conversation threads");

  // Add thread list command
  threadCommand
    .command("list")
    .description("List all conversation threads")
    .option("-f, --filter <name>", "Filter threads by name")
    .action(async (options) => {
      await threadManager.listThreads(options);
    });

  // Add thread delete command
  threadCommand
    .command("delete <thread-id>")
    .description("Delete a specific conversation thread")
    .action(async (threadId: string) => {
      await threadManager.deleteThread(threadId);
    });

  // Add thread attach command
  threadCommand
    .command("attach <thread-id>")
    .description("Attach to an existing conversation thread")
    .action(async (threadId: string) => {
      await threadManager.attachToThread(threadId);
    });

  // Add thread rename command
  threadCommand
    .command("rename <thread-id> <new-name>")
    .description("Rename an existing conversation thread")
    .action(async (threadId: string, newName: string) => {
      await threadManager.renameThread(threadId, newName);
    });
}

/**
 * Sets up the main AI command
 */
function setupMainCommand(program: Command) {
  program
    .argument("<input>", "The command to interpret")
    .option("-a, --agent", "Run in agent mode with continuous conversation")
    .option("--autopilot", "Run in autopilot mode")
    .option("--cost", "Show cost information")
    .option(
      "-t, --thread <threadId>",
      "Continue conversation in specified thread",
    )
    .action(async (input: string, options) => {
      await inputProcessor.processAiCommandWithContext(input, options);
    });
}

// Main execution
function main() {
  const program = setupProgram();

  program.parse(process.argv);

  if (!process.argv.slice(2).length) {
    program.outputHelp();
  }
}

main();
