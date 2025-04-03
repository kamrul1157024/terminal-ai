/**
 * Message role types
 */
export enum MessageRole {
  SYSTEM = 'system',
  USER = 'user',
  ASSISTANT = 'assistant',
  FUNCTION = 'function'
}

/**
 * Message structure for LLM interactions
 */
export interface Message {
  role: MessageRole;
  content: string;
  name?: string; // Function name for function messages
}

/**
 * Function parameter for function definitions
 */
export interface FunctionParameter {
  type: string;
  description?: string;
  enum?: string[];
  items?: {
    type: string;
  };
}

/**
 * Function definition for LLM function calls
 */
export interface FunctionDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, FunctionParameter>;
    required?: string[];
  };
}

/**
 * Function call result
 */
export interface FunctionCallResult {
  name: string;
  arguments: Record<string, any>;
}

/**
 * Function handler type for implementing function calls
 */
export type FunctionHandler = (args: Record<string, any>) => Promise<string>;

/**
 * Completion options
 */
export interface CompletionOptions {
  functions?: FunctionDefinition[];
  function_call?: 'auto' | 'none' | { name: string };
}

/**
 * Token usage tracking information
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  model: string;
}

/**
 * Completion result with potential function call and token usage
 */
export interface CompletionResult {
  content: string;
  functionCall?: FunctionCallResult;
  usage?: TokenUsage;
}

/**
 * Interface for language model providers
 */
export interface LLMProvider {
  /**
   * Generate a completion based on messages
   * @param messages Array of messages to process
   * @param options Additional options like function definitions
   * @returns The model's response text and optional function call
   */
  generateCompletion(
    messages: Message[], 
    options?: CompletionOptions
  ): Promise<CompletionResult>;
  
  /**
   * Get the current model being used by the provider
   * @returns The model ID/name
   */
  getModel(): string;
}

/**
 * LLM provider configuration options
 */
export interface LLMProviderConfig {
  apiKey?: string;
  model?: string;
  apiEndpoint?: string;
  [key: string]: any;
} 