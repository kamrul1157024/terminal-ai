import OpenAI from 'openai';
import { 
  LLMProvider, 
  LLMProviderConfig, 
  Message, 
  MessageRole, 
  CompletionOptions,
  CompletionResult,
  FunctionDefinition,
  TokenUsage,
  FunctionCallResult
} from '../interface';
import { LLMProviderType } from '../index';
import { countPromptTokens, countTokens } from '../../utils/token-counter';

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
   * Get the current model being used by the provider
   * @returns The model ID/name
   */
  getModel(): string {
    return this.model;
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
      
      // Track token usage
      const usage: TokenUsage = {
        // Use API reported token counts if available, otherwise estimate
        inputTokens: response.usage?.prompt_tokens || this.estimateInputTokens(messages),
        outputTokens: response.usage?.completion_tokens || countTokens(content, this.model),
        model: this.model
      };
      
      result.usage = usage;
      
      return result;
    } catch (error) {
      console.error('Error processing with OpenAI:', error);
      throw new Error('Failed to generate completion with OpenAI');
    }
  }
  
  /**
   * Generate a streaming completion using OpenAI's API
   * @param messages Array of messages to process
   * @param onToken Callback function for each token received
   * @param options Additional options like function definitions
   * @returns The complete model's response text and any function calls
   */
  async generateStreamingCompletion(
    messages: Message[], 
    onToken: (token: string) => void,
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
        stream: true,
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
      
      // Initialize variables to track the complete response
      let fullContent = '';
      let functionCall: FunctionCallResult | undefined;
      let inputTokens = 0;
      let outputTokens = 0;
      
      // Create a streaming response
      const stream = await this.client.chat.completions.create(requestParams);
      
      // Process the stream
      for await (const chunk of stream as any) {
        const content = chunk.choices[0]?.delta?.content || '';
        
        if (content) {
          // Send the token to the callback
          onToken(content);
          // Accumulate the content
          fullContent += content;
        }
        
        // Check for function calls in the stream
        const toolCalls = chunk.choices[0]?.delta?.tool_calls;
        if (toolCalls && toolCalls.length > 0) {
          const toolCall = toolCalls[0];
          
          if (toolCall.type === 'function') {
            // Initialize function call if not already done
            if (!functionCall) {
              functionCall = {
                name: toolCall.function?.name || '',
                arguments: ''
              };
            }
            
            // Accumulate function arguments
            if (toolCall.function?.arguments) {
              // For streaming, we need to accumulate the JSON string
              if (typeof functionCall.arguments === 'string') {
                functionCall.arguments += toolCall.function.arguments;
              } else {
                // If it's already an object, convert it to string and append
                functionCall.arguments = JSON.stringify(functionCall.arguments) + toolCall.function.arguments;
              }
            }
          }
        }
      }
      
      // Parse function call arguments if present
      if (functionCall && typeof functionCall.arguments === 'string') {
        try {
          functionCall.arguments = JSON.parse(functionCall.arguments);
        } catch (error) {
          console.warn('Failed to parse function call arguments', error);
        }
      }
      
      // Create the result object
      const result: CompletionResult = { content: fullContent };
      
      // Add function call if present
      if (functionCall) {
        result.functionCall = functionCall;
      }
      
      // Track token usage
      // For streaming, we need to estimate token usage
      const usage: TokenUsage = {
        inputTokens: this.estimateInputTokens(messages),
        outputTokens: countTokens(fullContent, this.model),
        model: this.model
      };
      
      result.usage = usage;
      
      return result;
    } catch (error) {
      console.error('Error processing streaming with OpenAI:', error);
      throw new Error('Failed to generate streaming completion with OpenAI');
    }
  }
  
  /**
   * Estimate the number of tokens in the input messages
   * @private
   */
  private estimateInputTokens(messages: Message[]): number {
    let totalTokens = 0;
    
    for (const message of messages) {
      totalTokens += countPromptTokens(message.content, LLMProviderType.OPENAI, this.model);
    }
    
    return totalTokens;
  }
} 