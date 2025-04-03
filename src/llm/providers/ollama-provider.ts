import { Ollama } from 'ollama';
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
 * Ollama implementation of the LLM Provider interface
 */
export class OllamaProvider implements LLMProvider {
  private client: Ollama;
  private model: string;
  private baseUrl: string;

  /**
   * Create a new Ollama provider
   * @param config Configuration options for Ollama
   */
  constructor(config: LLMProviderConfig) {
    this.baseUrl = config.apiEndpoint || 'http://localhost:11434';
    this.client = new Ollama({
      host: this.baseUrl
    });
    this.model = config.model || 'llama3';
  }

  /**
   * Get the current model being used by the provider
   * @returns The model ID/name
   */
  getModel(): string {
    return this.model;
  }

  /**
   * Generate a completion using Ollama's API
   * @param messages Array of messages to process
   * @param options Additional options like function definitions
   * @returns The model's response text
   */
  async generateCompletion(
    messages: Message[], 
    options?: CompletionOptions
  ): Promise<CompletionResult> {
    try {
      // Ollama doesn't directly support function calling like OpenAI, Claude, and Gemini
      // So we'll add function definitions to the prompt if they exist
      const ollamaMessages = this.mapToOllamaMessages(messages);
      let prompt = ollamaMessages;
      
      // If there are function definitions, add them to the prompt
      if (options?.functions && options.functions.length > 0) {
        prompt += "\n\nYou have access to the following functions:\n";
        
        for (const func of options.functions) {
          prompt += `\nFunction: ${func.name}\n`;
          prompt += `Description: ${func.description}\n`;
          prompt += "Parameters:\n";
          
          for (const [key, value] of Object.entries(func.parameters.properties)) {
            const required = (func.parameters.required || []).includes(key) 
              ? "(required)" 
              : "(optional)";
            prompt += `  - ${key}: ${value.type} ${required} - ${value.description || ''}\n`;
          }
          
          prompt += "\n";
        }
        
        prompt += "\nTo call a function, respond in the format:\n";
        prompt += "```json\n{\"function\": \"function_name\", \"arguments\": {\"arg1\": \"value1\", \"arg2\": \"value2\"}}\n```\n\n";
      }
      
      // Generate a response
      const response = await this.client.chat({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        stream: false
      });
      
      // Extract content from response
      const content = response.message.content;
      
      // Check if response has a function call
      const result: CompletionResult = { content };
      const functionCallMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      
      if (functionCallMatch) {
        try {
          const functionCallJson = JSON.parse(functionCallMatch[1]);
          if (functionCallJson.function && functionCallJson.arguments) {
            result.functionCall = {
              name: functionCallJson.function,
              arguments: functionCallJson.arguments
            };
            
            // Remove the function call from content
            result.content = content.replace(/```json\s*([\s\S]*?)\s*```/, '').trim();
          }
        } catch (error) {
          console.warn('Failed to parse function call from Ollama response', error);
        }
      }
      
      // Track token usage (Ollama may provide token stats in response)
      const responseAny = response as any;
      let inputTokens = 0;
      let outputTokens = 0;
      
      // Check if Ollama reports token usage
      if (responseAny.prompt_eval_count && responseAny.eval_count) {
        // Use model-reported token counts when available
        inputTokens = responseAny.prompt_eval_count;
        outputTokens = responseAny.eval_count;
      } else {
        // Fall back to tiktoken calculation
        inputTokens = this.calculateInputTokens(messages, prompt);
        outputTokens = countTokens(content, this.model);
      }
      
      // Add usage information to the response
      result.usage = {
        inputTokens,
        outputTokens,
        model: this.model
      };
      
      return result;
    } catch (error) {
      console.error('Error processing with Ollama:', error);
      throw new Error('Failed to generate completion with Ollama');
    }
  }
  
  /**
   * Maps our messages format to Ollama's format
   * @param messages Our standard message format
   * @returns Formatted prompt for Ollama
   */
  private mapToOllamaMessages(messages: Message[]): string {
    const systemPrompt = messages.find(msg => msg.role === MessageRole.SYSTEM)?.content || '';
    
    // Format all messages in a way Ollama can understand
    let prompt = '';
    
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
          prompt += `Function ${msg.name || 'unknown'} returned: ${msg.content}\n\n`;
          break;
      }
    }
    
    return prompt.trim();
  }
  
  /**
   * Calculate input tokens using tiktoken (used as fallback)
   * @param messages Original messages array
   * @param formattedPrompt The final formatted prompt sent to Ollama
   * @returns Estimated token count
   */
  private calculateInputTokens(messages: Message[], formattedPrompt: string): number {
    // For Ollama, it's better to count the final formatted prompt
    // since we add function definitions directly to the prompt
    return countTokens(formattedPrompt, this.model);
  }

  /**
   * Generate a streaming completion using Ollama's API
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
      // Ollama doesn't directly support function calling like OpenAI, Claude, and Gemini
      // So we'll add function definitions to the prompt if they exist
      const ollamaMessages = this.mapToOllamaMessages(messages);
      let prompt = ollamaMessages;
      
      // If there are function definitions, add them to the prompt
      if (options?.functions && options.functions.length > 0) {
        prompt += "\n\nYou have access to the following functions:\n";
        
        for (const func of options.functions) {
          prompt += `\nFunction: ${func.name}\n`;
          prompt += `Description: ${func.description}\n`;
          prompt += "Parameters:\n";
          
          for (const [key, value] of Object.entries(func.parameters.properties)) {
            const required = (func.parameters.required || []).includes(key) 
              ? "(required)" 
              : "(optional)";
            prompt += `  - ${key}: ${value.type} ${required} - ${value.description || ''}\n`;
          }
          
          prompt += "\n";
        }
        
        prompt += "\nTo call a function, respond in the format:\n";
        prompt += "```json\n{\"function\": \"function_name\", \"arguments\": {\"arg1\": \"value1\", \"arg2\": \"value2\"}}\n```\n\n";
      }
      
      // Initialize variables to track the complete response
      let fullContent = '';
      let functionCall: FunctionCallResult | undefined;
      
      // Generate a streaming response
      const stream = await this.client.chat({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        stream: true
      });
      
      // Process the stream
      for await (const chunk of stream) {
        const content = chunk.message?.content || '';
        
        if (content) {
          // Send the token to the callback
          onToken(content);
          // Accumulate the content
          fullContent += content;
        }
      }
      
      // Check if response has a function call
      const result: CompletionResult = { content: fullContent };
      const functionCallMatch = fullContent.match(/```json\s*([\s\S]*?)\s*```/);
      
      if (functionCallMatch) {
        try {
          const functionCallJson = JSON.parse(functionCallMatch[1]);
          if (functionCallJson.function && functionCallJson.arguments) {
            result.functionCall = {
              name: functionCallJson.function,
              arguments: functionCallJson.arguments
            };
            
            // Remove the function call from content
            result.content = fullContent.replace(/```json\s*([\s\S]*?)\s*```/, '').trim();
          }
        } catch (error) {
          console.warn('Failed to parse function call from Ollama response', error);
        }
      }
      
      // Track token usage (Ollama may provide token stats in response)
      const responseAny = stream as any;
      let inputTokens = 0;
      let outputTokens = 0;
      
      // Check if Ollama reports token usage
      if (responseAny.prompt_eval_count && responseAny.eval_count) {
        // Use model-reported token counts when available
        inputTokens = responseAny.prompt_eval_count;
        outputTokens = responseAny.eval_count;
      } else {
        // Fall back to tiktoken calculation
        inputTokens = this.calculateInputTokens(messages, prompt);
        outputTokens = countTokens(result.content, this.model);
      }
      
      // Add usage information to the response
      result.usage = {
        inputTokens,
        outputTokens,
        model: this.model
      };
      
      return result;
    } catch (error) {
      console.error('Error processing streaming with Ollama:', error);
      throw new Error('Failed to generate streaming completion with Ollama');
    }
  }
} 