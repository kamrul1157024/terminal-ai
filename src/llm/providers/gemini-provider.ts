// @ts-nocheck
import { GoogleGenerativeAI } from "@google/generative-ai";
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
 * Gemini implementation of the LLM Provider interface
 */
export class GeminiProvider implements LLMProvider {
  private client: GoogleGenerativeAI;
  private model: string;

  /**
   * Create a new Gemini provider
   * @param config Configuration options for Gemini
   */
  constructor(config: LLMProviderConfig) {
    if (!config.apiKey) {
      throw new Error(
        'Gemini API key is required. Run "ai init" to configure.',
      );
    }

    this.client = new GoogleGenerativeAI(config.apiKey);
    this.model = config.model || "gemini-1.5-pro";
  }

  /**
   * Get the current model being used by the provider
   * @returns The model ID/name
   */
  getModel(): string {
    return this.model;
  }

  /**
   * Generate a completion using Gemini's API
   * @param messages Array of messages to process
   * @param options Additional options like function definitions
   * @returns The model's response text and any function calls
   */
  async generateCompletion(
    messages: Message[],
    options?: CompletionOptions,
  ): Promise<CompletionResult> {
    try {
      // Get a generative model
      const genModel = this.client.getGenerativeModel({ model: this.model });

      // Map our messages to Gemini format
      const geminiMessages = this.mapToGeminiMessages(messages);

      // Prepare the chat session
      const chat = genModel.startChat({
        generationConfig: {
          maxOutputTokens: 4096,
        },
        // Use type assertion for tools
        tools: this.prepareTools(options?.functions || []),
      });

      // Send the message
      const result = await chat.sendMessage(geminiMessages);

      // Extract the response content
      const content = result.response.text();
      const response: CompletionResult = { content };

      // Type assertion for accessing function calls
      const responseAny = result.response as any;
      if (
        responseAny.functionCalls &&
        Array.isArray(responseAny.functionCalls) &&
        responseAny.functionCalls.length > 0
      ) {
        const functionCall = responseAny.functionCalls[0];

        response.functionCall = {
          name: functionCall.name,
          arguments: JSON.parse(functionCall.args),
        };
      }

      // Calculate token usage, using model-reported counts if available
      let inputTokens = 0;
      let outputTokens = 0;

      // Gemini API might provide token counts through the response object
      if (
        responseAny.usageMetadata?.promptTokenCount &&
        responseAny.usageMetadata?.candidatesTokenCount
      ) {
        // Use model-reported token counts when available (more accurate)
        inputTokens = responseAny.usageMetadata.promptTokenCount;
        outputTokens = responseAny.usageMetadata.candidatesTokenCount;
      } else {
        // Fall back to tiktoken calculation when model doesn't report usage
        inputTokens = this.calculateInputTokens(messages);
        outputTokens = countTokens(content, this.model);
      }

      // Add usage information to the response
      response.usage = {
        inputTokens,
        outputTokens,
        model: this.model,
      };

      return response;
    } catch (error) {
      console.error("Error processing with Gemini:", error);
      throw new Error("Failed to generate completion with Gemini");
    }
  }

  /**
   * Maps our messages format to Gemini's content format
   * @param messages Our standard message format
   * @returns Content for Gemini API
   */
  private mapToGeminiMessages(messages: Message[]): string {
    const systemPrompt =
      messages.find((msg) => msg.role === MessageRole.SYSTEM)?.content || "";

    // Format all messages in a way Gemini can understand
    let prompt = "";

    if (systemPrompt) {
      prompt += `System: ${systemPrompt}\n\n`;
    }

    // Add all other messages
    for (const msg of messages) {
      if (msg.role === MessageRole.SYSTEM) continue;

      switch (msg.role) {
        case MessageRole.USER:
          prompt += `User: ${msg.content}\n\n`;
          break;
        case MessageRole.ASSISTANT:
          prompt += `Assistant: ${msg.content}\n\n`;
          break;
        case MessageRole.FUNCTION:
          prompt += `Function ${msg.name || "unknown"} returned: ${msg.content}\n\n`;
          break;
      }
    }

    return prompt.trim();
  }

  /**
   * Calculate input tokens using tiktoken (used as fallback)
   * @param messages Array of messages
   * @returns Estimated token count
   */
  private calculateInputTokens(messages: Message[]): number {
    let totalTokens = 0;

    for (const msg of messages) {
      totalTokens += countPromptTokens(
        msg.content,
        LLMProviderType.GEMINI,
        this.model,
      );
    }

    return totalTokens;
  }

  /**
   * Prepare function definitions in Gemini's format
   * @param functions Our standard function definitions
   * @returns Gemini tool formats
   */
  private prepareTools(functions: FunctionDefinition[]): any[] {
    if (!functions || functions.length === 0) {
      return [];
    }

    return functions.map((func) => ({
      functionDeclarations: [
        {
          name: func.name,
          description: func.description,
          parameters: {
            type: "OBJECT",
            properties: Object.entries(func.parameters.properties).map(
              ([key, value]) => ({
                name: key,
                type: this.mapParameterType(value.type),
                description: value.description || "",
                required: (func.parameters.required || []).includes(key),
              }),
            ),
          },
        },
      ],
    }));
  }

  /**
   * Map our parameter types to Gemini parameter types
   * @param type Our parameter type
   * @returns Gemini parameter type
   */
  private mapParameterType(type: string): string {
    switch (type.toLowerCase()) {
      case "string":
        return "STRING";
      case "number":
      case "integer":
        return "NUMBER";
      case "boolean":
        return "BOOLEAN";
      default:
        return "STRING";
    }
  }

  /**
   * Generate a streaming completion using Gemini's API
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
      // Get a generative model
      const genModel = this.client.getGenerativeModel({ model: this.model });

      // Map our messages to Gemini format
      const geminiMessages = this.mapToGeminiMessages(messages);

      // Prepare the chat session
      const chat = genModel.startChat({
        generationConfig: {
          maxOutputTokens: 4096,
        },
        // Use type assertion for tools
        tools: this.prepareTools(options?.functions || []),
      });

      // Initialize variables to track the complete response
      let fullContent = "";
      let functionCall: FunctionCallResult | undefined;

      // Send the message with streaming
      const result = await chat.sendMessageStream(geminiMessages);

      // Process the stream
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();

        if (chunkText) {
          // Send the token to the callback
          onToken(chunkText);
          // Accumulate the content
          fullContent += chunkText;
        }
      }

      // Get the complete response
      const response = await result.response;

      // Create the result object
      const responseResult: CompletionResult = { content: fullContent };

      // Check for function calls
      const responseAny = response as any;
      if (
        responseAny.functionCalls &&
        Array.isArray(responseAny.functionCalls) &&
        responseAny.functionCalls.length > 0
      ) {
        const functionCallData = responseAny.functionCalls[0];

        responseResult.functionCall = {
          name: functionCallData.name,
          arguments: JSON.parse(functionCallData.args),
        };
      }

      // Calculate token usage, using model-reported counts if available
      let inputTokens = 0;
      let outputTokens = 0;

      // Gemini API might provide token counts through the response object
      if (
        responseAny.usageMetadata?.promptTokenCount &&
        responseAny.usageMetadata?.candidatesTokenCount
      ) {
        // Use model-reported token counts when available (more accurate)
        inputTokens = responseAny.usageMetadata.promptTokenCount;
        outputTokens = responseAny.usageMetadata.candidatesTokenCount;
      } else {
        // Fall back to tiktoken calculation when model doesn't report usage
        inputTokens = this.calculateInputTokens(messages);
        outputTokens = countTokens(fullContent, this.model);
      }

      // Add usage information to the response
      responseResult.usage = {
        inputTokens,
        outputTokens,
        model: this.model,
      };

      return responseResult;
    } catch (error) {
      console.error("Error processing streaming with Gemini:", error);
      throw new Error("Failed to generate streaming completion with Gemini");
    }
  }
}
