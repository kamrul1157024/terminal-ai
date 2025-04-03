import Anthropic from '@anthropic-ai/sdk';
import { 
  LLMProvider, 
  LLMProviderConfig, 
  Message, 
  MessageRole, 
  CompletionOptions,
  CompletionResult,
  FunctionDefinition,
  TokenUsage
} from '../interface';
import { LLMProviderType } from '../index';
import { countPromptTokens, countTokens } from '../../utils/token-counter';

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
      throw new Error('Claude API key is required. Run "ai init" to configure.');
    }
    
    this.client = new Anthropic({
      apiKey: config.apiKey
    });
    this.model = config.model || 'claude-3-opus-20240229';
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
    options?: CompletionOptions
  ): Promise<CompletionResult> {
    try {
      // Extract system message
      const systemMessage = messages.find(msg => msg.role === MessageRole.SYSTEM)?.content || '';
      
      // Map our messages to Claude format
      const claudeMessages = messages
        .filter(msg => msg.role !== MessageRole.SYSTEM) // Exclude system message
        .map(msg => {
          // Convert our message roles to Claude roles
          let role: string;
          
          switch (msg.role) {
            case MessageRole.USER:
              role = 'user';
              break;
            case MessageRole.ASSISTANT:
              role = 'assistant';
              break;
            case MessageRole.FUNCTION:
              // Return function responses as user messages with metadata
              role = 'user';
              return {
                role,
                content: [
                  {
                    type: 'tool_result',
                    tool_use_id: msg.name || 'unknown_tool', // Use function name as tool ID
                    content: msg.content
                  }
                ]
              };
            default:
              role = 'user'; // Default fallback
          }
          
          // Default content format
          return {
            role,
            content: msg.content
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
        const tools = options.functions.map(func => ({
          name: func.name,
          description: func.description,
          input_schema: {
            type: 'object',
            properties: func.parameters.properties,
            required: func.parameters.required || []
          }
        }));
        
        (params as any).tools = tools;
      }

      // If a specific function is requested
      if (options?.function_call && typeof options.function_call !== 'string') {
        (params as any).tool_choice = { type: 'tool', name: options.function_call.name };
      }
      
      const response = await this.client.messages.create(params);
      
      // Extract the text content
      let content = '';
      for (const part of response.content) {
        if (part.type === 'text') {
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
          arguments: toolUse.input
        };
      }
      
      // Add token usage data using tiktoken
      const inputTokens = this.calculateInputTokens(messages);
      const outputTokens = countTokens(content, this.model);
      
      result.usage = {
        inputTokens,
        outputTokens,
        model: this.model
      };
      
      return result;
    } catch (error) {
      console.error('Error processing with Claude:', error);
      throw new Error('Failed to generate completion with Claude');
    }
  }
  
  /**
   * Calculate the number of tokens in the input messages
   * @private
   */
  private calculateInputTokens(messages: Message[]): number {
    let totalTokens = 0;
    
    // Count system message tokens
    const systemMessage = messages.find(msg => msg.role === MessageRole.SYSTEM);
    if (systemMessage) {
      totalTokens += countPromptTokens(systemMessage.content, LLMProviderType.CLAUDE, this.model);
    }
    
    // Count other messages
    for (const msg of messages) {
      if (msg.role !== MessageRole.SYSTEM) {
        totalTokens += countPromptTokens(msg.content, LLMProviderType.CLAUDE, this.model);
      }
    }
    
    return totalTokens;
  }
} 