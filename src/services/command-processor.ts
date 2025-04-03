import { 
  LLMProvider, 
  Message, 
  MessageRole, 
  FunctionDefinition,
  CompletionOptions,
  FunctionCallResult,
  TokenUsage
} from '../llm/interface';
import { displayCostInfo } from '../utils/pricing-calculator';

/**
 * Default system prompt for terminal command generation
 */
const DEFAULT_TERMINAL_SYSTEM_PROMPT = 
  'You are a helpful terminal assistant. Convert natural language requests into terminal commands. ' +
  'Respond with ONLY the terminal command, nothing else.';

/**
 * Function handler type
 */
export type FunctionHandler = (args: Record<string, any>) => Promise<string>;

/**
 * Service for processing natural language commands
 */
export class CommandProcessor {
  private llmProvider: LLMProvider;
  private systemPrompt: string;
  private functions: FunctionDefinition[] = [];
  private functionHandlers: Map<string, FunctionHandler> = new Map();
  private showCostInfo: boolean = true;
  
  /**
   * Create a new command processor
   * @param llmProvider The LLM provider to use
   * @param systemPrompt Optional custom system prompt
   * @param showCostInfo Whether to display cost information (default: true)
   */
  constructor(
    llmProvider: LLMProvider, 
    systemPrompt: string = DEFAULT_TERMINAL_SYSTEM_PROMPT,
    showCostInfo: boolean = true
  ) {
    this.llmProvider = llmProvider;
    this.systemPrompt = systemPrompt;
    this.showCostInfo = showCostInfo;
  }
  
  /**
   * Register a function for the LLM to use
   * @param definition Function definition
   * @param handler Function handler implementation
   */
  registerFunction(definition: FunctionDefinition, handler: FunctionHandler): void {
    this.functions.push(definition);
    this.functionHandlers.set(definition.name, handler);
  }
  
  /**
   * Handle a function call from the LLM
   * @param functionCall The function call details
   * @param history Conversation history to update
   */
  private async handleFunctionCall(
    functionCall: FunctionCallResult,
    history: Message[]
  ): Promise<void> {
    const handler = this.functionHandlers.get(functionCall.name);
    
    if (!handler) {
      throw new Error(`No handler registered for function: ${functionCall.name}`);
    }
    
    try {
      // Parse arguments if they're a string
      const args = typeof functionCall.arguments === 'string' 
        ? JSON.parse(functionCall.arguments)
        : functionCall.arguments;
        
      const result = await handler(args);
      
      // Add function result to history
      history.push({
        role: MessageRole.FUNCTION,
        name: functionCall.name,
        content: result
      });
    } catch (error: any) {
      console.error(`Error executing function ${functionCall.name}:`, error);
      throw new Error(`Function execution failed: ${error.message}`);
    }
  }
  
  /**
   * Process a natural language command using the LLM provider
   * @param input User's natural language input
   * @param conversationHistory Optional previous conversation history
   * @returns The terminal command to execute
   * @deprecated Use processCommand instead, which now uses streaming by default
   */
  async processCommandNonStreaming(
    input: string, 
    conversationHistory: Message[] = []
  ): Promise<string> {
    // Create a copy of the conversation history to work with
    const history = [...conversationHistory];
    
    // Create messages array with system prompt and user input
    const messages: Message[] = [
      { role: MessageRole.SYSTEM, content: this.systemPrompt },
      ...history,
      { role: MessageRole.USER, content: input }
    ];
    
    // Prepare options with registered functions
    const options: CompletionOptions = {};
    if (this.functions.length > 0) {
      options.functions = this.functions;
      options.function_call = 'auto';
    }
    
    // Generate completion using the LLM provider
    const completion = await this.llmProvider.generateCompletion(messages, options);
    
    // Display cost information if enabled and usage data is available
    if (this.showCostInfo && completion.usage) {
      displayCostInfo(completion.usage);
    }
    
    // If a function was called, handle it and continue the conversation
    if (completion.functionCall) {
      // Add the model's response to history
      history.push({
        role: MessageRole.ASSISTANT,
        content: completion.content || ''
      });
      
      // Handle the function call
      await this.handleFunctionCall(completion.functionCall, history);
      
      // Generate a final response after the function call
      const finalCompletion = await this.llmProvider.generateCompletion(
        [
          { role: MessageRole.SYSTEM, content: this.systemPrompt },
          ...history
        ],
        { function_call: 'none' } // Don't call functions again
      );
      
      // Display cost information for the final completion if enabled
      if (this.showCostInfo && finalCompletion.usage) {
        displayCostInfo(finalCompletion.usage);
      }
      
      return finalCompletion.content;
    }
    
    // Return the content if no function was called
    return completion.content;
  }
  
  /**
   * Process a natural language command using the LLM provider
   * @param input User's natural language input
   * @param onToken Optional callback function for each token received (defaults to process.stdout.write)
   * @param conversationHistory Optional previous conversation history
   * @returns The terminal command to execute
   */
  async processCommand(
    input: string, 
    onToken: (token: string) => void = (token) => process.stdout.write(token),
    conversationHistory: Message[] = []
  ): Promise<string> {
    // Create a copy of the conversation history to work with
    const history = [...conversationHistory];
    
    // Create messages array with system prompt and user input
    const messages: Message[] = [
      { role: MessageRole.SYSTEM, content: this.systemPrompt },
      ...history,
      { role: MessageRole.USER, content: input }
    ];
    
    // Prepare options with registered functions
    const options: CompletionOptions = {};
    if (this.functions.length > 0) {
      options.functions = this.functions;
      options.function_call = 'auto';
    }
    
    // Generate completion using the LLM provider with streaming
    const completion = await this.llmProvider.generateStreamingCompletion(messages, onToken, options);
    
    // Display cost information if enabled and usage data is available
    if (this.showCostInfo && completion.usage) {
      displayCostInfo(completion.usage);
    }
    
    // If a function was called, handle it and continue the conversation
    if (completion.functionCall) {
      // Add the model's response to history
      history.push({
        role: MessageRole.ASSISTANT,
        content: completion.content || ''
      });
      
      // Handle the function call
      await this.handleFunctionCall(completion.functionCall, history);
      
      // Generate a final response after the function call
      const finalCompletion = await this.llmProvider.generateStreamingCompletion(
        [
          { role: MessageRole.SYSTEM, content: this.systemPrompt },
          ...history
        ],
        onToken,
        { function_call: 'none' } // Don't call functions again
      );
      
      // Display cost information for the final completion if enabled
      if (this.showCostInfo && finalCompletion.usage) {
        displayCostInfo(finalCompletion.usage);
      }
      
      return finalCompletion.content;
    }
    
    // Return the content if no function was called
    return completion.content;
  }
  
  /**
   * Enable or disable displaying cost information
   * @param enable Whether to enable cost display
   */
  setCostInfoDisplay(enable: boolean): void {
    this.showCostInfo = enable;
  }
} 