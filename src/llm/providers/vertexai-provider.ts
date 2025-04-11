import {
  VertexAI,
  GenerativeModel,
  Content as VertexContent,
  Part as VertexPart,
  Tool as VertexTool,
  FunctionDeclarationSchema as VertexFunctionDeclarationSchema,
  Schema as VertexSchema,
  SchemaType as VertexSchemaType,
} from "@google-cloud/vertexai";

import { countPromptTokens, countTokens } from "../../utils/token-counter";
import { LLMProviderType } from "../index";
import {
  LLMProvider,
  LLMProviderConfig,
  Message,
  MessageRole,
  CompletionOptions,
  CompletionResult,
  TokenUsage,
  ToolCallResult,
  ToolDefinition,
  ToolParameter,
} from "../interface";

// Helper function to map our FunctionParameter to Vertex AI Schema
// Adjusted to use Vertex AI types
const mapParameterToVertexSchema = (
  param: ToolParameter | { type: string },
): VertexSchema => {
  if (!("description" in param)) {
    if (param.type === "string") return { type: VertexSchemaType.STRING };
    if (param.type === "number") return { type: VertexSchemaType.NUMBER };
    if (param.type === "integer") return { type: VertexSchemaType.INTEGER };
    if (param.type === "boolean") return { type: VertexSchemaType.BOOLEAN };
    return { type: VertexSchemaType.STRING };
  }
  if (param.type === "object" && "properties" in param && param.properties) {
    return {
      type: VertexSchemaType.OBJECT,
      description: param.description,
      properties: Object.entries(param.properties).reduce(
        (acc, [key, value]) => {
          acc[key] = mapParameterToVertexSchema(value);
          return acc;
        },
        {} as { [k: string]: VertexSchema },
      ),
      required:
        "required" in param && Array.isArray(param.required)
          ? param.required
          : [],
    };
  } else if (param.type === "array" && "items" in param && param.items) {
    return {
      type: VertexSchemaType.ARRAY,
      description: param.description,
      items: mapParameterToVertexSchema(param.items),
    };
  } else if (param.type === "string") {
    if ("enum" in param && Array.isArray(param.enum) && param.enum.length > 0) {
      return {
        type: VertexSchemaType.STRING,
        description: param.description,
        enum: param.enum,
        format: "enum",
      };
    } else {
      return { type: VertexSchemaType.STRING, description: param.description };
    }
  } else if (param.type === "number") {
    return { type: VertexSchemaType.NUMBER, description: param.description };
  } else if (param.type === "integer") {
    return { type: VertexSchemaType.INTEGER, description: param.description };
  } else if (param.type === "boolean") {
    return { type: VertexSchemaType.BOOLEAN, description: param.description };
  }
  return { type: VertexSchemaType.STRING, description: param.description };
};

// Interface extending LLMProviderConfig for Vertex AI specifics
interface VertexAIProviderConfig extends LLMProviderConfig {
  projectId: string;
  location: string;
}

export class VertexAIProvider implements LLMProvider {
  private vertexAI: VertexAI;
  private modelId: string; // Model ID like "gemini-1.5-flash-001"
  private generativeModel: GenerativeModel;

  constructor(config: VertexAIProviderConfig) {
    if (!config.projectId || !config.location) {
      throw new Error(
        'Vertex AI requires Project ID and Location. Run "ai init" to configure.',
      );
    }
    this.vertexAI = new VertexAI({
      project: config.projectId,
      location: config.location,
    });
    this.modelId = config.model || "gemini-1.5-flash-001"; // Use configured model or default

    // Instantiate the model
    this.generativeModel = this.vertexAI.getGenerativeModel({
      model: this.modelId,
      // safetySettings: [{ category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }],
      // generationConfig: { maxOutputTokens: 256 }, // Example config
    });
  }

  getModel(): string {
    return this.modelId;
  }

  // Specific mapping for Vertex AI types
  private mapToVertexAIMessages(
    messages: Message<MessageRole>[],
  ): VertexContent[] {
    const vertexMessages: VertexContent[] = [];
    messages.forEach((msg) => {
      if (msg.role === "user") {
        vertexMessages.push({
          role: "user",
          parts: [{ text: msg.content as string }],
        });
      } else if (msg.role === "assistant") {
        vertexMessages.push({
          role: "model",
          parts: [{ text: msg.content as string }],
        });
      } else if (msg.role === "tool_call") {
        vertexMessages.push({
          role: "model",
          parts: msg.content.map((call) => ({
            functionCall: { name: call.name, args: call.arguments || {} },
          })) as VertexPart[],
        });
      } else if (msg.role === "tool") {
        msg.content.forEach((call) => {
          vertexMessages.push({
            role: "tool",
            parts: [
              {
                functionResponse: {
                  name: call.name,
                  response: { content: call.result + (call.error || "") },
                },
              },
            ] as VertexPart[],
          });
        });
      } // System messages handled via systemInstruction
    });
    return vertexMessages;
  }

  // Specific mapping for Vertex AI types
  private mapToVertexAITools(tools: ToolDefinition[]): VertexTool[] {
    if (tools.length === 0) return [];
    return [
      {
        functionDeclarations: tools.map((tool) => {
          let mappedProperties: { [k: string]: VertexSchema } = {};
          let requiredProperties: string[] = [];
          if (
            tool.parameters &&
            typeof tool.parameters === "object" &&
            "properties" in tool.parameters &&
            tool.parameters.properties
          ) {
            mappedProperties = Object.entries(
              tool.parameters.properties,
            ).reduce(
              (acc, [key, param]) => {
                acc[key] = mapParameterToVertexSchema(param);
                return acc;
              },
              {} as { [k: string]: VertexSchema },
            );
            requiredProperties =
              "required" in tool.parameters &&
              Array.isArray(tool.parameters.required)
                ? tool.parameters.required
                : [];
          }
          const parameters: VertexFunctionDeclarationSchema = {
            type: VertexSchemaType.OBJECT,
            properties: mappedProperties,
            required: requiredProperties,
          };
          return { name: tool.name, description: tool.description, parameters };
        }),
      },
    ];
  }

  async generateStreamingCompletion(
    messages: Message<MessageRole>[],
    onToken: (token: string) => void,
    options?: CompletionOptions,
  ): Promise<CompletionResult> {
    try {
      const vertexMessages = this.mapToVertexAIMessages(messages);
      const tools = options?.tools
        ? this.mapToVertexAITools(options.tools)
        : undefined;
      const systemMessages = messages.filter((msg) => msg.role === "system");
      const systemInstructionContent =
        systemMessages.length > 0
          ? systemMessages.map((msg) => msg.content).join("\n\n")
          : undefined;

      const request = {
        contents: vertexMessages,
        tools: tools,
        systemInstruction: systemInstructionContent
          ? ({
              role: "system",
              parts: [{ text: systemInstructionContent }],
            } as VertexContent)
          : undefined,
      };

      const streamingResp =
        await this.generativeModel.generateContentStream(request);

      let fullContent = "";
      let toolCalls: ToolCallResult[] = [];

      // Process the stream using the response handler
      for await (const item of streamingResp.stream) {
        // Check for function calls in the response candidates
        const candidate = item.candidates?.[0];
        const firstPart = candidate?.content?.parts?.[0];

        if (firstPart?.functionCall) {
          toolCalls.push({
            name: firstPart.functionCall.name,
            arguments: firstPart.functionCall.args || {},
            callId:
              Date.now().toString() + Math.random().toString(36).substring(7),
          });
        } else if (firstPart?.text) {
          // Process text content
          const content = firstPart.text;
          if (content) {
            onToken(content);
            fullContent += content;
          }
        }
      }

      // Aggregate results after stream completion if needed (Vertex specific)
      // const aggregatedResponse = await streamingResp.response;
      // Process aggregatedResponse.candidates[0].content.parts for function calls if not handled in stream?

      const completionResult: CompletionResult = { content: fullContent };
      if (toolCalls.length > 0) {
        completionResult.toolCalls = toolCalls;
      }

      const usage: TokenUsage = {
        inputTokens: this.estimateInputTokens(messages), // Placeholder
        outputTokens: countTokens(fullContent, this.modelId), // Placeholder
        model: this.modelId,
        // Note: Vertex AI might provide usage metadata in aggregatedResponse.usageMetadata
      };
      completionResult.usage = usage;

      return completionResult;
    } catch (error) {
      console.error("Vertex AI Error:", error);
      if (error instanceof Error) {
        throw new Error(
          `Failed to generate streaming completion with Vertex AI: ${error.message}`,
        );
      }
      throw new Error(
        `Failed to generate streaming completion with Vertex AI: Unknown error`,
      );
    }
  }

  // Reuse or adapt token estimation from GeminiProvider
  private estimateInputTokens(messages: Message<MessageRole>[]): number {
    let totalTokens = 0;
    messages
      .filter((m) => m.role === "system")
      .forEach((m) => {
        totalTokens += countTokens(m.content as string, this.modelId);
      });
    for (const message of messages.filter((m) => m.role !== "system")) {
      if (message.role === "tool") {
        for (const call of message.content) {
          totalTokens += countPromptTokens(
            call.result + (call.error || ""),
            LLMProviderType.VERTEXAI,
            this.modelId,
          );
        }
      } else if (message.role === "tool_call") {
        totalTokens += countTokens(
          JSON.stringify(message.content),
          this.modelId,
        );
      } else {
        if (typeof message.content === "string") {
          totalTokens += countTokens(message.content, this.modelId);
        }
      }
    }
    return totalTokens;
  }
}
