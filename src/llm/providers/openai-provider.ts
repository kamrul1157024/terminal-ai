import OpenAI from 'openai';
import { 
  LLMProvider, 
  LLMProviderConfig, 
  Message, 
  MessageRole, 
  CompletionOptions,
  CompletionResult,
  FunctionDefinition
} from '../interface';

/**
 * OpenAI implementation of the LLM Provider interface
 */
export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;

  /**
   * Create a new OpenAI provider
   * @param config Configuration options for OpenAI
   */
  constructor(config: LLMProviderConfig) {
    if (!config.apiKey) {
      throw new Error('OpenAI API key is required. Run "ai init" to configure.');
    }
    
    this.client = new OpenAI({
      apiKey: config.apiKey
    });
    this.model = config.model || 'gpt-4o';
  }

  /**
   * Generate a completion using OpenAI's API
   * @param messages Array of messages to process
   * @param options Additional options like function definitions
   * @returns The model's response text and any function calls
   */
  async generateCompletion(
    messages: Message[], 
    options?: CompletionOptions
  ): Promise<CompletionResult> {
    try {
      const openaiMessages = messages.map(msg => {
        // Map our message roles to OpenAI roles
        let role: 'system' | 'user' | 'assistant' | 'function';
        
        switch (msg.role) {
          case MessageRole.SYSTEM:
            role = 'system';
            break;
          case MessageRole.USER:
            role = 'user';
            break;
          case MessageRole.ASSISTANT:
            role = 'assistant';
            break;
          case MessageRole.FUNCTION:
            role = 'function';
            break;
          default:
            role = 'user'; // Default fallback
        }
        
        // Base message
        const openaiMessage: any = {
          role,
          content: msg.content
        };
        
        // Add name for function messages
        if (role === 'function' && msg.name) {
          openaiMessage.name = msg.name;
        }
        
        return openaiMessage;
      });
      
      // Prepare request parameters
      const requestParams: any = {
        model: this.model,
        messages: openaiMessages,
      };
      
      // Add function calling if provided
      if (options?.functions && options.functions.length > 0) {
        requestParams.tools = options.functions.map(func => ({
          type: 'function',
          function: func
        }));
        
        if (options.function_call) {
          if (options.function_call === 'auto' || options.function_call === 'none') {
            requestParams.tool_choice = options.function_call === 'auto' ? 'auto' : 'none';
          } else {
            requestParams.tool_choice = {
              type: 'function',
              function: { name: options.function_call.name }
            };
          }
        }
      }
      
      const response = await this.client.chat.completions.create(requestParams);
      
      // Extract response content and any function calls
      const responseMessage = response.choices[0]?.message;
      const content = responseMessage?.content?.trim() || '';
      
      // Check for tool calls (function calls)
      const result: CompletionResult = { content };
      
      if (responseMessage?.tool_calls && responseMessage.tool_calls.length > 0) {
        const toolCall = responseMessage.tool_calls[0];
        
        if (toolCall.type === 'function') {
          result.functionCall = {
            name: toolCall.function.name,
            arguments: JSON.parse(toolCall.function.arguments)
          };
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error processing with OpenAI:', error);
      throw new Error('Failed to generate completion with OpenAI');
    }
  }
} 