#!/usr/bin/env node

import { Command } from "commander";

import { setupCommand } from "./commands/setup";
import { Config, ModelConfig } from "./config";
import { logger } from "./logger";
import { ThreadManager } from "./services";
import * as Input from "./ui/input";

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

  setupConfigSetupCommand(program);
  setupProfileCommands(program);
  setupThreadCommands(program);
  setupMainCommand(program);

  return program;
}

/**
 * Sets up the init command
 */
function setupConfigSetupCommand(program: Command) {
  program
    .command("setup")
    .description("Initialize and configure Terminal AI")
    .action(async () => {
      await setupCommand();
    });
}

/**
 * Sets up profile management commands
 */
function setupProfileCommands(program: Command) {
  const profileCommand = program
    .command("profile")
    .description("Manage AI provider profiles");

  // List profiles command
  profileCommand
    .command("list")
    .description("List all configured profiles")
    .action(async () => {
      const config = Config.readConfig();
      if (!config || config.profiles.length === 0) {
        logger.info(
          "No profiles configured. Run 'ai init' to set up a profile.",
        );
        return;
      }

      logger.info("Configured profiles:");
      for (const profile of config.profiles) {
        const isActive = profile.name === config.activeProfile;
        const activeMarker = isActive ? " (active)" : "";

        // Get model details to show pricing
        const models = ModelConfig.getProviderModels(profile.provider);
        const modelConfig = models.find((m) => m.value === profile.model);

        let pricingInfo = "";
        if (modelConfig) {
          pricingInfo = ` - Pricing: $${modelConfig.pricing.input}/M input, $${modelConfig.pricing.output}/M output`;
        }

        logger.info(
          `- ${profile.name}${activeMarker}: ${profile.provider} / ${profile.model}${pricingInfo}`,
        );
      }
    });

  // Set active profile command
  profileCommand
    .command("set <profile-name>")
    .description("Set the active profile")
    .action(async (profileName: string) => {
      const config = Config.readConfig();
      if (!config) {
        logger.error(
          "No configuration found. Run 'ai init' to set up a profile.",
        );
        return;
      }

      const profile = config.profiles.find((p) => p.name === profileName);
      if (!profile) {
        logger.error(`Profile '${profileName}' not found.`);
        return;
      }

      config.activeProfile = profileName;
      const success = Config.writeConfig(config);
      if (success) {
        logger.success(`Active profile set to '${profileName}'`);
      } else {
        logger.error("Failed to set active profile.");
      }
    });

  // Delete profile command
  profileCommand
    .command("delete <profile-name>")
    .description("Delete a profile")
    .action(async (profileName: string) => {
      const config = Config.readConfig();
      if (!config) {
        logger.error(
          "No configuration found. Run 'ai init' to set up a profile.",
        );
        return;
      }

      const profileIndex = config.profiles.findIndex(
        (p) => p.name === profileName,
      );
      if (profileIndex === -1) {
        logger.error(`Profile '${profileName}' not found.`);
        return;
      }

      // Remove the profile
      config.profiles.splice(profileIndex, 1);

      // If the active profile was deleted, set another one as active
      if (config.activeProfile === profileName && config.profiles.length > 0) {
        config.activeProfile = config.profiles[0].name;
      }

      const success = Config.writeConfig(config);
      if (success) {
        logger.success(`Profile '${profileName}' deleted.`);
        if (config.profiles.length > 0) {
          logger.info(`Active profile is now '${config.activeProfile}'.`);
        } else {
          logger.info(
            "No profiles remaining. Run 'ai init' to set up a new profile.",
          );
        }
      } else {
        logger.error("Failed to delete profile.");
      }
    });

  // Show models command
  profileCommand
    .command("models")
    .description("Show available models and their pricing")
    .option("-p, --provider <provider>", "Filter by provider")
    .action(async (options) => {
      // Get active profile to determine default provider
      const config = Config.readConfig();
      const activeProfile = config ? Config.getActiveProfile() : null;

      let provider = options.provider;

      // If no provider specified, use the active profile's provider
      if (!provider && activeProfile) {
        provider = activeProfile.provider;
      }

      logger.info(`Available models${provider ? ` for ${provider}` : ""}:`);

      if (provider) {
        // Show models for specific provider
        const models = ModelConfig.getProviderModels(provider);
        if (models.length === 0) {
          logger.info(`No models found for provider '${provider}'.`);
          return;
        }

        for (const model of models) {
          logger.info(`- ${model.name} (${model.value})`);
          logger.info(
            `  Pricing: $${model.pricing.input}/M input tokens, $${model.pricing.output}/M output tokens`,
          );
        }
      } else {
        // Show models for all providers
        const config = ModelConfig.readModelsConfig();
        if (!config) {
          logger.error("Failed to read models configuration.");
          return;
        }

        for (const [providerName, providerConfig] of Object.entries(config)) {
          logger.info(`\n${providerName.toUpperCase()} Models:`);
          logger.info(`Default: ${providerConfig.default}`);

          for (const model of providerConfig.models) {
            logger.info(`- ${model.name} (${model.value})`);
            logger.info(
              `  Pricing: $${model.pricing.input}/M input tokens, $${model.pricing.output}/M output tokens`,
            );
          }
        }
      }
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
      await ThreadManager.listThreads(options);
    });

  // Add thread delete command
  threadCommand
    .command("delete <thread-id>")
    .description("Delete a specific conversation thread")
    .action(async (threadId: string) => {
      await ThreadManager.deleteThread(threadId);
    });

  // Add thread attach command
  threadCommand
    .command("attach <thread-id>")
    .description("Attach to an existing conversation thread")
    .action(async (threadId: string) => {
      await ThreadManager.attachToThread(threadId);
    });

  // Add thread rename command
  threadCommand
    .command("rename <thread-id> <new-name>")
    .description("Rename an existing conversation thread")
    .action(async (threadId: string, newName: string) => {
      await ThreadManager.renameThread(threadId, newName);
    });
}

/**
 * Sets up the main AI command
 */
function setupMainCommand(program: Command) {
  program
    .argument("<input>", "The command to interpret")
    .option("-a, --agent", "Run in agent mode with continuous conversation")
    .option("--auto-approve", "Run in auto-approve mode")
    .option("--cost", "Show cost information")
    .option("-p, --profile <profile>", "Use specific profile for this request")
    .option(
      "-t, --thread <threadId>",
      "Continue conversation in specified thread",
    )
    .option("--debug", "Run in debug mode")
    .action(async (input: string, options) => {
      await Input.processAiCommandWithContext(input, options);
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
