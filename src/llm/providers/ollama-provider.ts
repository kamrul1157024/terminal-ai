import axios from "axios";

import { logger } from "../../logger";
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
} from "../interface";

// Extended config for Ollama provider
interface OllamaProviderConfig extends LLMProviderConfig {
  baseUrl?: string;
}

// Extended options for Ollama
interface OllamaOptions {
  temperature?: number;
  [key: string]: unknown;
}

export class OllamaProvider implements LLMProvider {
  private baseUrl: string;
  private model: string;

  constructor(config: OllamaProviderConfig) {
    this.baseUrl = config.baseUrl || "http://localhost:11434";
    this.model = config.model || "llama3";
  }

  getModel(): string {
    return this.model;
  }

  private mapToOllamaMessages(
    messages: Message<MessageRole>[]
  ): { role: string; content: string; images?: string[] }[] {
    const ollamaMessages: { role: string; content: string; images?: string[] }[] = [];
    
    messages.forEach((msg) => {
      if (msg.role === "user" || msg.role === "system" || msg.role === "assistant") {
        ollamaMessages.push({
          role: msg.role,
          content: msg.content as string,
        });
      }
      
      // Handle function calls and results if needed
      if (msg.role === "function") {
        msg.content.forEach((call) => {
          ollamaMessages.push({
            role: "tool",
            content: call.result + call.error,
          });
        });
      }
    });

    return ollamaMessages;
  }

  private mapOllamaToolsToFunctionCall(toolCall: {
    function: {
      name: string;
      arguments: Record<string, unknown>;
    };
  }): FunctionCallResult {
    return {
      name: toolCall.function.name,
      arguments: toolCall.function.arguments || {},
      callId: Date.now().toString(), // Ollama doesn't provide callId, generate one
    };
  }

  private mapToOllamaTools(
    functions: FunctionDefinition[]
  ): Array<{ type: string; function: { name: string; description: string; parameters: Record<string, unknown> } }> {
    return functions.map((func) => ({
      type: "function",
      function: {
        name: func.name,
        description: func.description,
        parameters: func.parameters,
      },
    }));
  }

  async generateStreamingCompletion(
    messages: Message<MessageRole>[],
    onToken: (token: string) => void,
    options?: CompletionOptions
  ): Promise<CompletionResult> {
    try {
      const ollamaMessages = this.mapToOllamaMessages(messages);
      const ollamaTools = options?.functions ? this.mapToOllamaTools(options.functions) : [];

      const requestBody: {
        model: string;
        messages: { role: string; content: string; images?: string[] }[];
        stream: boolean;
        tools?: Array<{ type: string; function: { name: string; description: string; parameters: Record<string, unknown> } }>;
        options?: OllamaOptions;
      } = {
        model: this.model,
        messages: ollamaMessages,
        stream: true,
      };

      if (ollamaTools.length > 0) {
        requestBody.tools = ollamaTools;
      }

      // Add custom Ollama options if needed
      if (options) {
        requestBody.options = {};
        
        // Add temperature if available through custom extension
        if ('temperature' in options) {
          requestBody.options.temperature = options.temperature as number;
        }
      }
      
      logger.debug(`Sending request to Ollama API at ${this.baseUrl}/api/chat`);
      logger.debug(`Using model: ${this.model}`);

      const response = await axios.post(`${this.baseUrl}/api/chat`, requestBody, {
        responseType: 'stream'
      });

      let fullContent = "";
      let functionCalls: FunctionCallResult[] = [];

      // Handle streaming response
      const stream = response.data as NodeJS.ReadableStream;
      
      return new Promise((resolve, reject) => {
        let responseBuffer = '';
        
        stream.on('data', (chunk: Buffer) => {
          const chunkStr = chunk.toString();
          responseBuffer += chunkStr;
          
          // Process complete JSON objects from the buffer
          let startIdx = 0;
          let endIdx: number;
          
          while ((endIdx = responseBuffer.indexOf('\n', startIdx)) !== -1) {
            const jsonStr = responseBuffer.substring(startIdx, endIdx).trim();
            startIdx = endIdx + 1;
            
            if (jsonStr) {
              try {
                const data = JSON.parse(jsonStr);
                
                if (data.message?.content) {
                  onToken(data.message.content);
                  fullContent += data.message.content;
                }
                
                if (data.message?.tool_calls) {
                  functionCalls = data.message.tool_calls.map(
                    this.mapOllamaToolsToFunctionCall
                  );
                }
              } catch {
                // Ignore incomplete JSON
              }
            }
          }
          
          // Keep the remaining part that might be an incomplete JSON
          responseBuffer = responseBuffer.substring(startIdx);
        });
        
        stream.on('end', () => {
          const result: CompletionResult = { content: fullContent };
          
          if (functionCalls.length > 0) {
            result.functionCalls = functionCalls;
          }
          
          const usage: TokenUsage = {
            inputTokens: this.estimateInputTokens(messages),
            outputTokens: countTokens(fullContent, this.model),
            model: this.model,
          };
          
          result.usage = usage;
          resolve(result);
        });
        
        stream.on('error', (err: Error) => {
          reject(new Error(`Failed to generate streaming completion with Ollama: ${err.message}`));
        });
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        // Check if it's an Axios error by checking for response property
        if (error && typeof error === 'object' && 'response' in error) {
          const axiosError = error as { 
            response?: { 
              status?: number; 
              data?: unknown;
              statusText?: string;
            }; 
            message: string 
          };
          
          // Handle Axios errors with more detail
          const statusCode = axiosError.response?.status;
          const statusText = axiosError.response?.statusText;
          const errorMessage = axiosError.message;
          
          // Safely handle response data to avoid circular reference errors
          let responseStr = '';
          try {
            const responseData = axiosError.response?.data;
            if (responseData) {
              // Handle different types of response data
              if (typeof responseData === 'string') {
                responseStr = `\nResponse: ${responseData}`;
              } else if (typeof responseData === 'object') {
                // Use a safer approach with try/catch for objects
                try {
                  responseStr = `\nResponse: ${JSON.stringify(responseData)}`;
                } catch {
                  responseStr = `\nResponse: [Complex object that couldn't be stringified]`;
                }
              }
            }
          } catch {
            responseStr = `\nResponse: [Error accessing response data]`;
          }
          
          // Add diagnostic info for common error codes
          let diagnosticInfo = '';
          if (statusCode === 400) {
            diagnosticInfo = `\n\nPossible causes for 400 Bad Request:
- Invalid model name '${this.model}'. Make sure the model is downloaded via 'ollama pull <model>'
- Incorrect request format or parameters
- Model not running or not available on the Ollama server
- Ollama server is running but not responding correctly

Try checking:
1. Is Ollama running? Run 'ollama list' to see available models
2. Can you connect to ${this.baseUrl}?
3. Does the model '${this.model}' exist on your Ollama server?`;
          } else if (statusCode === 404) {
            diagnosticInfo = `\n\nThe Ollama API endpoint was not found. Is the Ollama server running at ${this.baseUrl}?`;
          } else if (statusCode === 500) {
            diagnosticInfo = `\n\nOllama server encountered an internal error. Check the Ollama server logs for more details.`;
          }
          
          throw new Error(
            `Ollama API error (${statusCode} ${statusText || ''}): ${errorMessage}${responseStr}${diagnosticInfo}`
          );
        }
        throw new Error(`Failed to generate streaming completion with Ollama: ${error.message}`);
      }
      throw new Error(`Failed to generate streaming completion with Ollama: Unknown error`);
    }
  }

  private estimateInputTokens(messages: Message<MessageRole>[]): number {
    let totalTokens = 0;

    for (const message of messages) {
      if (message.role === "function") {
        for (const call of message.content) {
          totalTokens += countPromptTokens(
            call.result + call.error,
            LLMProviderType.OLLAMA,
            this.model,
          );
        }
      } else {
        if (typeof message.content === "string") {
          totalTokens += countTokens(message.content, this.model);
        } else {
          totalTokens += countTokens(
            JSON.stringify(message.content),
            this.model,
          );
        }
      }
    }

    return totalTokens;
  }
} 