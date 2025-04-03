import { 
  LLMProvider, 
  Message, 
  MessageRole, 
  FunctionDefinition,
  CompletionOptions,
  FunctionCallResult
} from '../llm/interface';

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
  
  /**
   * Create a new command processor
   * @param llmProvider The LLM provider to use
   * @param systemPrompt Optional custom system prompt
   */
  constructor(
    llmProvider: LLMProvider, 
    systemPrompt: string = DEFAULT_TERMINAL_SYSTEM_PROMPT
  ) {
    this.llmProvider = llmProvider;
    this.systemPrompt = systemPrompt;
  }
  
  /**
   * Register a function that can be called by the LLM
   * @param functionDef Function definition
   * @param handler Function handler implementation
   */
  registerFunction(functionDef: FunctionDefinition, handler: FunctionHandler): void {
    this.functions.push(functionDef);
    this.functionHandlers.set(functionDef.name, handler);
  }
  
  /**
   * Handle a function call by invoking the appropriate handler
   * @param functionCall The function call from the LLM
   * @param conversationHistory Current conversation history
   * @returns Result of the function call
   */
  private async handleFunctionCall(
    functionCall: FunctionCallResult,
    conversationHistory: Message[]
  ): Promise<string> {
    const handler = this.functionHandlers.get(functionCall.name);
    
    if (!handler) {
      throw new Error(`No handler registered for function: ${functionCall.name}`);
    }
    
    try {
      const result = await handler(functionCall.arguments);
      
      // Add the function call and result to the conversation history
      conversationHistory.push({
        role: MessageRole.ASSISTANT,
        content: '',
        name: functionCall.name
      });
      
      conversationHistory.push({
        role: MessageRole.FUNCTION,
        name: functionCall.name,
        content: result
      });
      
      return result;
    } catch (error) {
      console.error(`Error executing function ${functionCall.name}:`, error);
      throw error;
    }
  }
  
  /**
   * Process a natural language command using the LLM provider
   * @param input User's natural language input
   * @param conversationHistory Optional previous conversation history
   * @returns The terminal command to execute
   */
  async processCommand(
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
      
      return finalCompletion.content;
    }
    
    // Return the content if no function was called
    return completion.content;
  }
} 