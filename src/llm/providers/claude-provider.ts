// @ts-nocheck
import Anthropic from "@anthropic-ai/sdk";
import {
  LLMProvider,
  LLMProviderConfig,
  Message,
  MessageRole,
  CompletionOptions,
  CompletionResult,
  FunctionDefinition,
  TokenUsage,
  FunctionCallResult,
} from "../interface";
import { LLMProviderType } from "../index";
import { countPromptTokens, countTokens } from "../../utils/token-counter";

/**
 * Claude implementation of the LLM Provider interface
 */
export class ClaudeProvider implements LLMProvider {
  private client: Anthropic;
  private model: string;

  /**
   * Create a new Claude provider
   * @param config Configuration options for Claude
   */
  constructor(config: LLMProviderConfig) {
    if (!config.apiKey) {
      throw new Error(
        'Claude API key is required. Run "ai init" to configure.',
      );
    }

    this.client = new Anthropic({
      apiKey: config.apiKey,
    });
    this.model = config.model || "claude-3-opus-20240229";
  }

  /**
   * Get the current model being used by the provider
   * @returns The model ID/name
   */
  getModel(): string {
    return this.model;
  }

  /**
   * Generate a completion using Claude's API
   * @param messages Array of messages to process
   * @param options Additional options like function definitions
   * @returns The model's response text and any function calls
   */
  async generateCompletion(
    messages: Message[],
    options?: CompletionOptions,
  ): Promise<CompletionResult> {
    try {
      // Extract system message
      const systemMessage =
        messages.find((msg) => msg.role === MessageRole.SYSTEM)?.content || "";

      // Map our messages to Claude format
      const claudeMessages = messages
        .filter((msg) => msg.role !== MessageRole.SYSTEM) // Exclude system message
        .map((msg) => {
          // Convert our message roles to Claude roles
          let role: string;

          switch (msg.role) {
            case MessageRole.USER:
              role = "user";
              break;
            case MessageRole.ASSISTANT:
              role = "assistant";
              break;
            case MessageRole.FUNCTION:
              // Return function responses as user messages with metadata
              role = "user";
              return {
                role,
                content: [
                  {
                    type: "tool_result",
                    tool_use_id: msg.name || "unknown_tool", // Use function name as tool ID
                    content: msg.content,
                  },
                ],
              };
            default:
              role = "user"; // Default fallback
          }

          // Default content format
          return {
            role,
            content: msg.content,
          };
        });

      // Prepare request parameters
      const params: Anthropic.MessageCreateParams = {
        model: this.model,
        messages: claudeMessages as any, // Type casting to avoid TS errors
        max_tokens: 4096,
        system: systemMessage,
      };

      // Add tool calling if provided
      if (options?.functions && options.functions.length > 0) {
        const tools = options.functions.map((func) => ({
          name: func.name,
          description: func.description,
          input_schema: {
            type: "object",
            properties: func.parameters.properties,
            required: func.parameters.required || [],
          },
        }));

        (params as any).tools = tools;
      }

      // If a specific function is requested
      if (options?.function_call && typeof options.function_call !== "string") {
        (params as any).tool_choice = {
          type: "tool",
          name: options.function_call.name,
        };
      }

      const response = await this.client.messages.create(params);

      // Extract the text content
      let content = "";
      for (const part of response.content) {
        if (part.type === "text") {
          content += part.text;
        }
      }

      const result: CompletionResult = { content };

      // Check for tool use in the response
      const responseAny = response as any;
      if (responseAny.tool_uses && responseAny.tool_uses.length > 0) {
        const toolUse = responseAny.tool_uses[0];
        result.functionCall = {
          name: toolUse.name,
          arguments: toolUse.input,
        };
      }

      // Add token usage data using tiktoken
      const inputTokens = this.calculateInputTokens(messages);
      const outputTokens = countTokens(content, this.model);

      result.usage = {
        inputTokens,
        outputTokens,
        model: this.model,
      };

      return result;
    } catch (error) {
      console.error("Error processing with Claude:", error);
      throw new Error("Failed to generate completion with Claude");
    }
  }

  /**
   * Calculate the number of tokens in the input messages
   * @private
   */
  private calculateInputTokens(messages: Message[]): number {
    let totalTokens = 0;

    // Count system message tokens
    const systemMessage = messages.find(
      (msg) => msg.role === MessageRole.SYSTEM,
    );
    if (systemMessage) {
      totalTokens += countPromptTokens(
        systemMessage.content,
        LLMProviderType.CLAUDE,
        this.model,
      );
    }

    // Count other messages
    for (const msg of messages) {
      if (msg.role !== MessageRole.SYSTEM) {
        totalTokens += countPromptTokens(
          msg.content,
          LLMProviderType.CLAUDE,
          this.model,
        );
      }
    }

    return totalTokens;
  }

  /**
   * Generate a streaming completion using Claude's API
   * @param messages Array of messages to process
   * @param onToken Callback function for each token received
   * @param options Additional options like function definitions
   * @returns The complete model's response text and any function calls
   */
  async generateStreamingCompletion(
    messages: Message[],
    onToken: (token: string) => void,
    options?: CompletionOptions,
  ): Promise<CompletionResult> {
    try {
      // Extract system message
      const systemMessage =
        messages.find((msg) => msg.role === MessageRole.SYSTEM)?.content || "";

      // Map our messages to Claude format
      const claudeMessages = messages
        .filter((msg) => msg.role !== MessageRole.SYSTEM) // Exclude system message
        .map((msg) => {
          // Convert our message roles to Claude roles
          let role: string;

          switch (msg.role) {
            case MessageRole.USER:
              role = "user";
              break;
            case MessageRole.ASSISTANT:
              role = "assistant";
              break;
            case MessageRole.FUNCTION:
              // Return function responses as user messages with metadata
              role = "user";
              return {
                role,
                content: [
                  {
                    type: "tool_result",
                    tool_use_id: msg.name || "unknown_tool", // Use function name as tool ID
                    content: msg.content,
                  },
                ],
              };
            default:
              role = "user"; // Default fallback
          }

          // Default content format
          return {
            role,
            content: msg.content,
          };
        });

      // Prepare request parameters
      const params: Anthropic.MessageCreateParams = {
        model: this.model,
        messages: claudeMessages as any, // Type casting to avoid TS errors
        max_tokens: 4096,
        system: systemMessage,
        stream: true,
      };

      // Add tool calling if provided
      if (options?.functions && options.functions.length > 0) {
        const tools = options.functions.map((func) => ({
          name: func.name,
          description: func.description,
          input_schema: {
            type: "object",
            properties: func.parameters.properties,
            required: func.parameters.required || [],
          },
        }));

        (params as any).tools = tools;
      }

      // If a specific function is requested
      if (options?.function_call && typeof options.function_call !== "string") {
        (params as any).tool_choice = {
          type: "tool",
          name: options.function_call.name,
        };
      }

      // Initialize variables to track the complete response
      let fullContent = "";
      let functionCall: FunctionCallResult | undefined;

      // Create a streaming response
      const stream = await this.client.messages.create(params);

      // Process the stream
      for await (const chunk of stream) {
        if (
          chunk.type === "content_block_delta" &&
          chunk.delta.type === "text_delta"
        ) {
          const content = chunk.delta.text;

          if (content) {
            // Send the token to the callback
            onToken(content);
            // Accumulate the content
            fullContent += content;
          }
        }

        // Check for tool use in the stream
        // Note: Claude's streaming API doesn't directly support tool use in the same way
        // This is a simplified implementation that may need adjustment based on actual API behavior
        const chunkAny = chunk as any;
        if (chunkAny.type === "tool_use_delta") {
          // Initialize function call if not already done
          if (!functionCall) {
            functionCall = {
              name: chunkAny.delta.name || "",
              arguments: "",
            };
          }

          // Accumulate tool input
          if (chunkAny.delta.input) {
            // For streaming, we need to accumulate the JSON string
            if (typeof functionCall.arguments === "string") {
              functionCall.arguments += chunkAny.delta.input;
            } else {
              // If it's already an object, convert it to string and append
              functionCall.arguments =
                JSON.stringify(functionCall.arguments) + chunkAny.delta.input;
            }
          }
        }
      }

      // Parse function call arguments if present
      if (functionCall && typeof functionCall.arguments === "string") {
        try {
          functionCall.arguments = JSON.parse(functionCall.arguments);
        } catch (error) {
          console.warn("Failed to parse function call arguments", error);
        }
      }

      // Create the result object
      const result: CompletionResult = { content: fullContent };

      // Add function call if present
      if (functionCall) {
        result.functionCall = functionCall;
      }

      // Add token usage data using tiktoken
      const inputTokens = this.calculateInputTokens(messages);
      const outputTokens = countTokens(fullContent, this.model);

      result.usage = {
        inputTokens,
        outputTokens,
        model: this.model,
      };

      return result;
    } catch (error) {
      console.error("Error processing streaming with Claude:", error);
      throw new Error("Failed to generate streaming completion with Claude");
    }
  }
}
