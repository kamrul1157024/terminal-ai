import inquirer from "inquirer";

import { Config, ModelConfig } from "../config";
import { LLMProviderType } from "../llm";
import { logger } from "../logger";

/**
 * Initialize the Terminal AI CLI by setting up the config
 */
export async function setupCommand(): Promise<void> {
  try {
    logger.info("Terminal AI - Initial Setup");
    logger.info("---------------------------");

    let config: Config.TerminalAIConfig | null = null;

    // Check if config already exists
    if (Config.configExists()) {
      config = Config.readConfig();
      const { action } = await inquirer.prompt([
        {
          type: "list",
          name: "action",
          message: "Configuration already exists. What would you like to do?",
          choices: [
            { name: "Create a new profile", value: "create" },
            { name: "Edit existing profile", value: "edit" },
            { name: "Set active profile", value: "set" },
            { name: "Cancel", value: "cancel" },
          ],
        },
      ]);

      if (action === "cancel") {
        logger.info("Setup canceled. Keeping existing configuration.");
        return;
      }

      if (action === "edit" && config) {
        await editExistingProfile(config);
        return;
      }

      if (action === "set" && config) {
        await setActiveProfile(config);
        return;
      }
    }

    // New configuration or new profile setup
    const profileConfig = await setupNewProfile();

    if (!config) {
      // Create new configuration file with the first profile
      config = {
        activeProfile: profileConfig.name,
        profiles: [profileConfig],
      };
    } else {
      // Add new profile to existing configuration
      if (!config.profiles) {
        config.profiles = [];
      }
      config.profiles.push(profileConfig);
      config.activeProfile = profileConfig.name;
    }

    const success = Config.writeConfig(config);

    if (success) {
      logger.success("Configuration saved successfully!");
      logger.info(
        "You can now use the Terminal AI CLI with your configured provider.",
      );
    } else {
      logger.error("Failed to save configuration.");
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error(`Error during initialization: ${error.message}`);
    } else {
      logger.error(`Error during initialization: ${String(error)}`);
    }
  }
}

/**
 * Setup a new profile
 */
async function setupNewProfile(): Promise<Config.ProfileConfig> {
  // Get profile name
  const { profileName } = await inquirer.prompt([
    {
      type: "input",
      name: "profileName",
      message: "Enter a name for this profile:",
      default: "default",
      validate: (input) =>
        input.length > 0 ? true : "Profile name is required",
    },
  ]);

  // Get provider choice
  const { provider } = await inquirer.prompt([
    {
      type: "list",
      name: "provider",
      message: "Select the AI provider to use:",
      choices: [
        { name: "OpenAI", value: LLMProviderType.OPENAI },
        { name: "Ollama (Local)", value: LLMProviderType.OLLAMA },
        // Add more providers here as they become available
      ],
    },
  ]);

  let apiKey = "";
  let apiEndpoint = "";

  // Only prompt for API key if not using Ollama (which might not need an API key)
  if (provider !== LLMProviderType.OLLAMA) {
    const { key } = await inquirer.prompt([
      {
        type: "input",
        name: "key",
        message: "Enter your API key:",
        validate: (input) => (input.length > 0 ? true : "API key is required"),
      },
    ]);
    apiKey = key;
  } else {
    // For Ollama, prompt for endpoint
    const { endpoint } = await inquirer.prompt([
      {
        type: "input",
        name: "endpoint",
        message: "Enter Ollama API endpoint (default: http://localhost:11434):",
        default: "http://localhost:11434",
      },
    ]);
    apiEndpoint = endpoint;
  }

  // Get models from configuration file for the selected provider
  const models = ModelConfig.getProviderModels(provider);
  const defaultModel = ModelConfig.getDefaultModel(provider);

  // Get model based on provider
  let model = defaultModel;

  if (models.length > 0) {
    // Format model choices to include pricing information
    const modelChoices = models.map((m) => ({
      name: `${m.name} - Input: $${m.pricing.input}/M tokens, Output: $${m.pricing.output}/M tokens`,
      value: m.value,
    }));

    const { modelChoice } = await inquirer.prompt([
      {
        type: "list",
        name: "modelChoice",
        message: `Select the ${provider} model to use:`,
        choices: modelChoices,
      },
    ]);

    model = modelChoice;
  }

  // Create profile config
  const profileConfig: Config.ProfileConfig = {
    name: profileName,
    provider,
    model,
  };

  // Only add API key if it's set
  if (apiKey) {
    profileConfig.apiKey = apiKey;
  }

  // Add API endpoint for Ollama
  if (apiEndpoint) {
    profileConfig.apiEndpoint = apiEndpoint;
  }

  return profileConfig;
}

/**
 * Edit an existing profile
 */
async function editExistingProfile(
  config: Config.TerminalAIConfig,
): Promise<void> {
  // Select profile to edit
  const { profileName } = await inquirer.prompt([
    {
      type: "list",
      name: "profileName",
      message: "Select profile to edit:",
      choices: config.profiles.map((p) => ({ name: p.name, value: p.name })),
    },
  ]);

  const profileIndex = config.profiles.findIndex((p) => p.name === profileName);
  if (profileIndex === -1) {
    logger.error("Profile not found.");
    return;
  }

  // Setup a new profile with the same name
  const updatedProfile = await setupNewProfile();
  updatedProfile.name = profileName;

  // Replace the profile in the config
  config.profiles[profileIndex] = updatedProfile;

  // Save the updated config
  const success = Config.writeConfig(config);
  if (success) {
    logger.success("Profile updated successfully!");
  } else {
    logger.error("Failed to update profile.");
  }
}

/**
 * Set the active profile
 */
async function setActiveProfile(
  config: Config.TerminalAIConfig,
): Promise<void> {
  // Select profile to set as active
  const { profileName } = await inquirer.prompt([
    {
      type: "list",
      name: "profileName",
      message: "Select profile to set as active:",
      choices: config.profiles.map((p) => ({ name: p.name, value: p.name })),
    },
  ]);

  // Set the active profile
  config.activeProfile = profileName;

  // Save the updated config
  const success = Config.writeConfig(config);
  if (success) {
    logger.success(`Active profile set to '${profileName}'`);
  } else {
    logger.error("Failed to set active profile.");
  }
}
