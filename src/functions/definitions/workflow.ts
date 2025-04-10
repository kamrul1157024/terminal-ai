import { z } from "zod";

import { createLLMProvider } from "../../llm";
import { LLMProvider, Message, MessageRole } from "../../llm/interface";
import { logger } from "../../logger";
import { LLMFunction } from "../types";

/**
 * Analyzes a prompt to discover potential workflows using LLM
 */
const workflowDiscovery = async (prompt: string): Promise<string> => {
  try {
    // Create an LLM provider instance using the configured provider
    const llmProvider: LLMProvider = createLLMProvider();
    
    // Define system prompt for workflow discovery
    const systemPrompt = `You are a workflow discovery assistant. 
    Analyze the user's prompt and break it down into a clear, step-by-step workflow.
    For each step, identify:
    1. The specific action to take
    2. Any commands that need to be executed
    3. Any dependencies or prerequisites

    Format your response as a numbered list of steps.`;
    
    // Create messages for the LLM call
    const messages: Message<MessageRole>[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt }
    ];
    
    // Make the actual LLM call
    logger.info("Making LLM call to discover workflow...");
    
    let content = "";
    // Use the streaming API and collect results
    await llmProvider.generateStreamingCompletion(
      messages,
      (token) => {
        content += token;
        logger.info(token);
      }
    );
    
    if (!content) {
      throw new Error("LLM returned empty workflow");
    }
    
    return `Discovered Workflow:\n${content}`;
  } catch (error) {
    logger.error(`Error during workflow discovery: ${error}`);
    // Fallback to a basic workflow if LLM call fails
    const fallbackSteps = [
      "1. Analyze user prompt for workflow requirements",
      "2. Determine necessary steps to accomplish the task",
      "3. Generate appropriate terminal commands",
      "4. Execute commands in sequence",
    ];
    
    return `Discovered Workflow (Fallback):\n${fallbackSteps.join("\n")}`;
  }
};

const ArgumentsSchema = z.object({
  prompt: z.string({
    description: "The user prompt to analyze for workflow discovery",
  }),
});

export const workflowDiscoverer: LLMFunction<typeof ArgumentsSchema> = {
  name: "discover_workflow",
  description: "Analyzes a prompt to discover potential workflows and execution steps",
  args: ArgumentsSchema,
  prompt: `
    Use the \`discover_workflow\` function to analyze user prompts and extract potential workflows.
    This function helps break down complex tasks into actionable steps by using an LLM to analyze the prompt.
  `,
  handler: async ({ prompt }) => {
    try {
      const workflow = await workflowDiscovery(prompt);
      return { data: workflow };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { 
        data: "", 
        error: `Error discovering workflow: ${errorMessage}` 
      };
    }
  },
  render: ({ prompt }) => {
    logger.info(`Discovering workflow from prompt: "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"`);
  },
};
