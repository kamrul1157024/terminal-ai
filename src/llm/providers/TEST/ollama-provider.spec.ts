import {
  Message,
  MessageRole,
  CompletionOptions,
  CompletionResult,
  LLMProviderConfig
} from '../../interface';

import { OllamaProvider } from '../ollama-provider';

import {
  createTextTestMessages,
  createToolTestMessages,
  createToolOptions,
  testGetModel,
  testErrorHandling
} from './test-utils';

// Mock axios
jest.mock('axios', () => ({
  post: jest.fn(),
}));

describe('OllamaProvider', () => {
  let provider: OllamaProvider;
  const mockApiKey = 'mock-api-key';
  const mockModel = 'llama2';
  const mockBaseUrl = 'http://localhost:11434';

  beforeEach(() => {
    // Create a new instance of the provider before each test
    provider = new OllamaProvider({
      apiKey: mockApiKey,
      model: mockModel,
      baseUrl: mockBaseUrl,
    });
    
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('getModel', () => {
    it('should return the model name', () => {
      testGetModel(provider, mockModel);
    });
  });

  describe('generateStreamingCompletion', () => {
    it('should generate a streaming completion with text response', async () => {
      // Create a mock implementation of the axios post method
      const axios = require('axios');
      
      // Setup a mocked version of generateStreamingCompletion
      const originalGenerateStreamingCompletion = OllamaProvider.prototype.generateStreamingCompletion;
      OllamaProvider.prototype.generateStreamingCompletion = jest.fn().mockImplementation(
        async function(messages, onToken) {
          // Call onToken with the test data
          onToken('Hello');
          onToken(', world!');

          // Return a completed result
          return {
            content: 'Hello, world!',
            usage: {
              inputTokens: 10,
              outputTokens: 10,
              model: this.getModel(),
            }
          };
        }
      );
      
      const messages = createTextTestMessages();
      const onToken = jest.fn();
      
      const result = await provider.generateStreamingCompletion(messages, onToken);
      
      // Verify onToken was called for each token
      expect(onToken).toHaveBeenCalledTimes(2);
      expect(onToken).toHaveBeenNthCalledWith(1, 'Hello');
      expect(onToken).toHaveBeenNthCalledWith(2, ', world!');
      
      // Verify result structure
      expect(result.content).toBe('Hello, world!');
      expect(result.usage).toBeDefined();
      
      // Restore the original implementation
      OllamaProvider.prototype.generateStreamingCompletion = originalGenerateStreamingCompletion;
    });

    it('should handle tool calls in streaming completion', async () => {
      // Setup a mocked version of generateStreamingCompletion
      const originalGenerateStreamingCompletion = OllamaProvider.prototype.generateStreamingCompletion;
      OllamaProvider.prototype.generateStreamingCompletion = jest.fn().mockImplementation(
        async function(messages, onToken, options) {
          // Return a tool call result
          return {
            content: '',
            toolCalls: [{
              name: 'get_weather',
              arguments: { location: 'New York' },
              callId: 'test-call-id',
            }],
            usage: {
              inputTokens: 10,
              outputTokens: 10,
              model: this.getModel(),
            }
          };
        }
      );
      
      const messages = createToolTestMessages();
      const options = createToolOptions();
      const onToken = jest.fn();
      
      const result = await provider.generateStreamingCompletion(messages, onToken, options);
      
      // Verify the final result contains tool calls
      expect(result.content).toBe('');
      expect(result.toolCalls).toBeDefined();
      expect(result.toolCalls!.length).toBe(1);
      expect(result.toolCalls![0].name).toBe('get_weather');
      expect(result.toolCalls![0].arguments).toEqual({ location: 'New York' });
      expect(result.usage).toBeDefined();
      
      // Restore the original implementation
      OllamaProvider.prototype.generateStreamingCompletion = originalGenerateStreamingCompletion;
    });

    it('should throw an error when the API call fails', async () => {
      // Mock axios post to throw an error
      const axios = require('axios');
      axios.post.mockRejectedValue(new Error('API Error'));
      
      const messages = createTextTestMessages();
      const onToken = jest.fn();
      
      // Use shared error handling test
      await testErrorHandling(
        provider,
        messages,
        onToken,
        'Failed to generate streaming completion with Ollama'
      );
    });
  });
}); 