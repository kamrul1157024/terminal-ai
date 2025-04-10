import {
  GoogleGenerativeAI,
  GenerativeModel,
  Tool,
  Content,
  SchemaType,
  FunctionDeclarationSchema,
  GenerateContentRequest,
  Schema,
  Part,
} from "@google/generative-ai";

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
  FunctionCallResult,
  FunctionDefinition,
  FunctionParameter,
} from "../interface";

// Extended config for Gemini provider
interface GeminiProviderConfig extends LLMProviderConfig {
  // Can add Gemini-specific config options here
}

// Helper function to map our FunctionParameter to Gemini Schema
const mapParameterToSchema = (param: FunctionParameter | { type: string }): Schema => {
  // Handle the simpler { type: string } case first (for array items)
  if (!('description' in param)) { // Basic check to differentiate
     if (param.type === 'string') return { type: SchemaType.STRING };
     if (param.type === 'number') return { type: SchemaType.NUMBER };
     if (param.type === 'integer') return { type: SchemaType.INTEGER };
     if (param.type === 'boolean') return { type: SchemaType.BOOLEAN };
     return { type: SchemaType.STRING }; // Default fallback for simple types
  }

  // Now handle the full FunctionParameter
  if (param.type === 'object' && 'properties' in param && param.properties) {
    return {
      type: SchemaType.OBJECT,
      description: param.description,
      properties: Object.entries(param.properties).reduce((acc, [key, value]) => {
        acc[key] = mapParameterToSchema(value); // Recursively map nested properties
        return acc;
      }, {} as { [k: string]: Schema }),
      required: ('required' in param && Array.isArray(param.required)) ? param.required : [],
    }
  } else if (param.type === 'array' && 'items' in param && param.items) {
    return {
      type: SchemaType.ARRAY,
      description: param.description,
      items: mapParameterToSchema(param.items), // Map the items definition
    }
  } else if (param.type === 'string') {
    // Check if enum is present and valid
    if ('enum' in param && Array.isArray(param.enum) && param.enum.length > 0) {
      // EnumStringSchema requires format = 'enum'
      return { 
        type: SchemaType.STRING, 
        description: param.description, 
        enum: param.enum, 
        format: 'enum' // Set format to 'enum'
      }; 
    } else {
      return { type: SchemaType.STRING, description: param.description }; // This matches SimpleStringSchema
    }
  } else if (param.type === 'number') {
    return { type: SchemaType.NUMBER, description: param.description };
  } else if (param.type === 'integer') {
    return { type: SchemaType.INTEGER, description: param.description };
  } else if (param.type === 'boolean') {
    return { type: SchemaType.BOOLEAN, description: param.description };
  }
  // Fallback for unknown types
  return { type: SchemaType.STRING, description: param.description };
};

export class GeminiProvider implements LLMProvider {
  private client: GoogleGenerativeAI;
  private model: string;
  private generativeModel: GenerativeModel;

  constructor(config: GeminiProviderConfig) {
    if (!config.apiKey) {
      throw new Error(
        'Gemini API key is required. Run "ai init" to configure.',
      );
    }

    this.client = new GoogleGenerativeAI(config.apiKey);
    this.model = config.model || "gemini-2.0-flash-lite";
    this.generativeModel = this.client.getGenerativeModel({
      model: this.model,
    });
  }

  getModel(): string {
    return this.model;
  }

  // Helper method to convert messages to Gemini format
  private mapToGeminiMessages(messages: Message<MessageRole>[]): Content[] {
    const geminiMessages: Content[] = [];

    // Map messages other than system messages
    messages.forEach((msg) => {
      if (msg.role === "user") {
        geminiMessages.push({
          role: "user",
          parts: [{ text: msg.content as string }],
        });
      } else if (msg.role === "assistant") {
        geminiMessages.push({
          role: "model", // Gemini uses 'model' for assistant role
          parts: [{ text: msg.content as string }],
        });
      } else if (msg.role === "function_call") {
        geminiMessages.push({
          role: "model",
          parts: msg.content.map((call) => ({
            functionCall: {
              name: call.name,
              args: call.arguments || {},
            },
          })) as Part[], // Ensure parts are correctly typed
        });
      } else if (msg.role === "function") {
        msg.content.forEach((call) => {
          geminiMessages.push({
            role: "function", // Gemini uses 'function' for tool role
            parts: [
              {
                functionResponse: {
                  name: call.name,
                  response: { content: call.result + (call.error || "") },
                },
              },
            ] as Part[], // Ensure parts are correctly typed
          });
        });
      } // System messages are handled separately via systemInstruction
    });
    
    return geminiMessages;
  }

  // Helper to convert our function definitions to Gemini format
  private mapToGeminiFunctions(functions: FunctionDefinition[]): Tool[] {
    if (functions.length === 0) return [];
    
    return [{
      functionDeclarations: functions.map(func => {
        // Convert FunctionDefinition parameters to Gemini Schema
        let mappedProperties: { [k: string]: Schema } = {};
        let requiredProperties: string[] = [];

        // Check if parameters is an object and has properties
        if (func.parameters && typeof func.parameters === 'object' && 'properties' in func.parameters && func.parameters.properties) {
          mappedProperties = Object.entries(func.parameters.properties).reduce((acc, [key, param]) => {
            acc[key] = mapParameterToSchema(param);
            return acc;
          }, {} as { [k: string]: Schema });
          // Ensure required is an array before assigning
          requiredProperties = ('required' in func.parameters && Array.isArray(func.parameters.required)) ? func.parameters.required : [];
        }
        
        const parameters: FunctionDeclarationSchema = {
          type: SchemaType.OBJECT,
          properties: mappedProperties,
          required: requiredProperties,
        };
        
        return {
          name: func.name,
          description: func.description,
          parameters: parameters,
        }
      }),
    }];
  }

  async generateStreamingCompletion(
    messages: Message<MessageRole>[],
    onToken: (token: string) => void,
    options?: CompletionOptions,
  ): Promise<CompletionResult> {
    try {
      const geminiMessages = this.mapToGeminiMessages(messages);
      const tools = options?.functions ? this.mapToGeminiFunctions(options.functions) : undefined;
      
      // Extract system prompt
      const systemMessages = messages.filter(msg => msg.role === "system");
      const systemInstructionContent = systemMessages.length > 0 
        ? systemMessages.map(msg => msg.content).join("\n\n")
        : undefined;

      // Prepare the request for generateContentStream
      const request: GenerateContentRequest = {
        contents: geminiMessages,
        tools: tools,
        // System instruction should be a Content object
        systemInstruction: systemInstructionContent ? { role: "system", parts: [{ text: systemInstructionContent }] } : undefined,
        // Add generationConfig if needed (temperature, etc.)
        // generationConfig: { temperature: 0.7 },
      };

      const result = await this.generativeModel.generateContentStream(request);
      
      let fullContent = "";
      let functionCalls: FunctionCallResult[] = [];

      for await (const chunk of result.stream) {
        // Check for function calls first using the function call method
        const fcs = chunk.functionCalls?.(); // Call the function to get the array
        if (fcs && fcs.length > 0) {
          fcs.forEach(fc => {
            functionCalls.push({
              name: fc.name,
              arguments: fc.args || {},
              callId: Date.now().toString() + Math.random().toString(36).substring(7), // Generate a unique ID
            });
          })
        } else {
          // Process text content if no function call
          const content = chunk.text();
          if (content) {
            onToken(content);
            fullContent += content;
          }
        }
      }

      const completionResult: CompletionResult = { content: fullContent };
      
      if (functionCalls.length > 0) {
        completionResult.functionCalls = functionCalls;
      }

      // Note: Gemini API (v1) for generateContentStream might not directly
      // return token counts in the streaming response.
      // We continue to estimate them.
      const usage: TokenUsage = {
        inputTokens: this.estimateInputTokens(messages),
        outputTokens: countTokens(fullContent, this.model),
        model: this.model,
      };

      completionResult.usage = usage;

      return completionResult;
    } catch (error) {
      console.error("Gemini Error:", error);
      if (error instanceof Error) {
        throw new Error(
          `Failed to generate streaming completion with Gemini: ${error.message}`
        );
      }
      throw new Error(
        `Failed to generate streaming completion with Gemini: Unknown error`
      );
    }
  }

  private estimateInputTokens(messages: Message<MessageRole>[]): number {
    let totalTokens = 0;
    // Include system prompt tokens if any
    messages.filter(m => m.role === 'system').forEach(m => {
      totalTokens += countTokens(m.content as string, this.model);
    });

    for (const message of messages.filter(m => m.role !== 'system')) {
      if (message.role === "function") {
        for (const call of message.content) {
          totalTokens += countPromptTokens(
            call.result + (call.error || ""),
            LLMProviderType.GEMINI,
            this.model,
          );
        }
      } else if (message.role === "function_call") {
        totalTokens += countTokens(JSON.stringify(message.content), this.model); // Estimate tokens for function calls
      } else {
        if (typeof message.content === "string") {
          totalTokens += countTokens(message.content, this.model);
        }
      }
    }

    return totalTokens;
  }
} 