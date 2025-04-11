import { GeminiProvider } from '../gemini-provider';

import {
  createTextTestMessages,
  createToolTestMessages,
  createToolOptions,
  assertTextResponse,
  assertToolCallResponse,
  testGetModel,
  testErrorHandling
} from './test-utils';

// Mock the Google Generative AI library
jest.mock('@google/generative-ai', () => {
  const mockGenerateContentStream = jest.fn();
  
  // Mock GenerativeModel class
  const MockGenerativeModel = jest.fn().mockImplementation(() => ({
    generateContentStream: mockGenerateContentStream,
  }));
  
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockReturnValue(new MockGenerativeModel()),
    })),
    GenerativeModel: MockGenerativeModel,
    Content: {
      Role: {
        USER: 'user',
        MODEL: 'model',
        FUNCTION: 'function',
      }
    },
    HarmBlockThreshold: {
      BLOCK_NONE: 'BLOCK_NONE',
    },
    HarmCategory: {
      HARM_CATEGORY_HATE_SPEECH: 'HARM_CATEGORY_HATE_SPEECH',
      HARM_CATEGORY_DANGEROUS_CONTENT: 'HARM_CATEGORY_DANGEROUS_CONTENT',
      HARM_CATEGORY_HARASSMENT: 'HARM_CATEGORY_HARASSMENT',
      HARM_CATEGORY_SEXUALLY_EXPLICIT: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    },
    SchemaType: {
      STRING: 'STRING',
      NUMBER: 'NUMBER',
      INTEGER: 'INTEGER',
      BOOLEAN: 'BOOLEAN',
      OBJECT: 'OBJECT',
      ARRAY: 'ARRAY'
    },
    Schema: {
      Type: {
        STRING: 'STRING',
        NUMBER: 'NUMBER',
        INTEGER: 'INTEGER',
        BOOLEAN: 'BOOLEAN',
        OBJECT: 'OBJECT',
        ARRAY: 'ARRAY'
      }
    }
  };
});

describe('GeminiProvider', () => {
  let provider: GeminiProvider;
  const mockApiKey = 'mock-api-key';
  const mockModel = 'gemini-pro';

  beforeEach(() => {
    // Create a new instance of the provider before each test
    provider = new GeminiProvider({
      apiKey: mockApiKey,
      model: mockModel,
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
      // Mock Gemini stream response
      const mockStreamResponse = [
        { text: () => 'Hello' },
        { text: () => ', world!' }
      ];
      
      // Setup the mock for generateContentStream method
      const gemini = require('@google/generative-ai');
      const mockGenerateContentStream = jest.fn().mockResolvedValue({
        stream: {
          [Symbol.asyncIterator]: async function* () {
            for (const chunk of mockStreamResponse) {
              yield chunk;
            }
          }
        }
      });
      
      gemini.GoogleGenerativeAI.mockImplementation(() => ({
        getGenerativeModel: jest.fn().mockReturnValue({
          generateContentStream: mockGenerateContentStream,
        }),
      }));
      
      // Create a new instance with the updated mock
      provider = new GeminiProvider({
        apiKey: mockApiKey,
        model: mockModel,
      });
      
      const messages = createTextTestMessages();
      const onToken = jest.fn();
      
      const result = await provider.generateStreamingCompletion(messages, onToken);
      
      // Verify onToken was called for each token
      expect(onToken).toHaveBeenCalledTimes(2);
      expect(onToken).toHaveBeenNthCalledWith(1, 'Hello');
      expect(onToken).toHaveBeenNthCalledWith(2, ', world!');
      
      // Use shared assertions
      assertTextResponse(result, onToken);
    });

    it('should handle tool calls in streaming completion', async () => {
      // Mock Gemini stream response with tool calls
      const mockStreamResponse = [
        {
          text: () => '',
          functionCalls: () => [{
            name: 'get_weather',
            args: { location: 'New York' }
          }]
        }
      ];
      
      // Setup the mock for generateContentStream method
      const gemini = require('@google/generative-ai');
      const mockGenerateContentStream = jest.fn().mockResolvedValue({
        stream: {
          [Symbol.asyncIterator]: async function* () {
            for (const chunk of mockStreamResponse) {
              yield chunk;
            }
          }
        }
      });
      
      gemini.GoogleGenerativeAI.mockImplementation(() => ({
        getGenerativeModel: jest.fn().mockReturnValue({
          generateContentStream: mockGenerateContentStream,
        }),
      }));
      
      // Create a new instance with the updated mock
      provider = new GeminiProvider({
        apiKey: mockApiKey,
        model: mockModel,
      });
      
      const messages = createToolTestMessages();
      const options = createToolOptions();
      const onToken = jest.fn();
      
      const result = await provider.generateStreamingCompletion(messages, onToken, options);
      
      // Use shared assertions
      assertToolCallResponse(result);
    });

    it('should throw an error when the API call fails', async () => {
      // Setup the mock to throw an error
      const gemini = require('@google/generative-ai');
      const mockGenerateContentStream = jest.fn().mockImplementation(() => ({
        stream: jest.fn().mockRejectedValue(new Error('API Error')),
      }));
      
      gemini.GoogleGenerativeAI.mockImplementation(() => ({
        getGenerativeModel: jest.fn().mockReturnValue({
          generateContentStream: mockGenerateContentStream,
        }),
      }));
      
      // Create a new instance with the updated mock
      provider = new GeminiProvider({
        apiKey: mockApiKey,
        model: mockModel,
      });
      
      const messages = createTextTestMessages();
      const onToken = jest.fn();
      
      // Use shared error handling test
      await testErrorHandling(
        provider,
        messages,
        onToken,
        'Failed to generate streaming completion with Gemini'
      );
    });
  });
}); 