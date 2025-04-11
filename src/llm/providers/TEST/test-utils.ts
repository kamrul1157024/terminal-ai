import {
  Message,
  MessageRole,
  CompletionOptions,
  CompletionResult,
  ToolDefinition,
  LLMProvider
} from '../../interface';

/**
 * Standard test messages for text-only responses
 */
export const createTextTestMessages = (): Message<MessageRole>[] => [
  { role: 'user', content: 'Say hello world' }
];

/**
 * Standard test messages for tool calls
 */
export const createToolTestMessages = (): Message<MessageRole>[] => [
  { role: 'user', content: 'What\'s the weather in New York?' }
];

/**
 * Standard weather tool definition for testing
 */
export const createWeatherToolDefinition = (): ToolDefinition => ({
  name: 'get_weather',
  description: 'Get the current weather in a location',
  parameters: {
    type: 'object',
    properties: {
      location: {
        type: 'string',
        description: 'The city and state, e.g. San Francisco, CA'
      }
    },
    required: ['location']
  }
});

/**
 * Standard test options with tools
 */
export const createToolOptions = (): CompletionOptions => ({
  tools: [createWeatherToolDefinition()]
});

/**
 * Shared assertions for text response tests
 */
export const assertTextResponse = (
  result: CompletionResult,
  onToken: jest.Mock,
  expectedContent = 'Hello, world!'
): void => {
  // Verify the final result
  expect(result.content).toBe(expectedContent);
  expect(result.toolCalls).toBeUndefined();
  expect(result.usage).toBeDefined();
  
  // Verify onToken was called with the expected content
  expect(onToken).toHaveBeenCalled();
  
  // If the content has multiple parts, ensure they were all called
  if (expectedContent.includes('Hello') && expectedContent.includes('world')) {
    expect(onToken).toHaveBeenCalledWith(expect.stringContaining('Hello'));
    expect(onToken).toHaveBeenCalledWith(expect.stringContaining('world'));
  }
};

/**
 * Shared assertions for tool call response tests
 */
export const assertToolCallResponse = (
  result: CompletionResult,
  expectedToolName = 'get_weather',
  expectedArguments = { location: 'New York' }
): void => {
  expect(result.toolCalls).toBeDefined();
  expect(result.toolCalls!.length).toBe(1);
  expect(result.toolCalls![0].name).toBe(expectedToolName);
  expect(result.toolCalls![0].arguments).toEqual(expectedArguments);
  expect(result.usage).toBeDefined();
};

/**
 * Shared test for verifying a provider returns the correct model
 */
export const testGetModel = (
  provider: LLMProvider, 
  expectedModel: string
): void => {
  expect(provider.getModel()).toBe(expectedModel);
};

/**
 * Reusable test for error handling
 */
export const testErrorHandling = async (
  provider: LLMProvider,
  messages: Message<MessageRole>[],
  onToken: jest.Mock,
  expectedError: string
): Promise<void> => {
  await expect(provider.generateStreamingCompletion(messages, onToken))
    .rejects.toThrow(expectedError);
}; 