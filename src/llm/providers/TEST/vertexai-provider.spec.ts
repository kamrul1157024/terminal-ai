import { VertexAIProvider } from '../vertexai-provider';

import {
  createTextTestMessages,
  createToolTestMessages,
  createToolOptions,
  assertTextResponse,
  assertToolCallResponse,
  testGetModel,
  testErrorHandling
} from './test-utils';

// Mock the VertexAI library
jest.mock('@google-cloud/vertexai', () => {
  // Mock response for generateStream
  const mockGenerateContentStream = jest.fn();
  
  // Mock VertexAI class
  return {
    VertexAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockReturnValue({
        generateContentStream: mockGenerateContentStream,
      }),
    })),
    SchemaType: {
      STRING: 'STRING',
      NUMBER: 'NUMBER',
      INTEGER: 'INTEGER',
      BOOLEAN: 'BOOLEAN',
      OBJECT: 'OBJECT',
      ARRAY: 'ARRAY'
    }
  };
});

describe('VertexAIProvider', () => {
  let provider: VertexAIProvider;
  const mockConfig = {
    apiKey: 'mock-api-key',
    model: 'gemini-1.5-pro',
    projectId: 'mock-project-id',
    location: 'us-central1',
  };

  beforeEach(() => {
    // Create a new instance of the provider before each test
    provider = new VertexAIProvider(mockConfig);
    
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('getModel', () => {
    it('should return the model name', () => {
      testGetModel(provider, mockConfig.model);
    });
  });

  describe('generateStreamingCompletion', () => {
    it('should generate a streaming completion with text response', async () => {
      // Mock VertexAI stream response
      const mockStreamResponse = [
        { 
          candidates: [{ 
            content: { 
              parts: [{ text: 'Hello' }] 
            } 
          }] 
        },
        { 
          candidates: [{ 
            content: { 
              parts: [{ text: ', world!' }] 
            } 
          }] 
        }
      ];
      
      // Setup the mock for generateContentStream method
      const vertexai = require('@google-cloud/vertexai');
      const mockGenerateContentStream = jest.fn().mockResolvedValue({
        stream: {
          [Symbol.asyncIterator]: async function* () {
            for (const chunk of mockStreamResponse) {
              yield chunk;
            }
          }
        }
      });
      
      vertexai.VertexAI.mockImplementation(() => ({
        getGenerativeModel: jest.fn().mockReturnValue({
          generateContentStream: mockGenerateContentStream,
        }),
      }));
      
      // Create a new instance with the updated mock
      provider = new VertexAIProvider(mockConfig);
      
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
      // Mock VertexAI stream response with tool calls
      const mockStreamResponse = [
        { 
          candidates: [{ 
            content: { 
              parts: [{ 
                functionCall: {
                  name: 'get_weather',
                  args: {
                    location: 'New York'
                  }
                } 
              }] 
            } 
          }] 
        }
      ];
      
      // Setup the mock for generateContentStream method
      const vertexai = require('@google-cloud/vertexai');
      const mockGenerateContentStream = jest.fn().mockResolvedValue({
        stream: {
          [Symbol.asyncIterator]: async function* () {
            for (const chunk of mockStreamResponse) {
              yield chunk;
            }
          }
        }
      });
      
      vertexai.VertexAI.mockImplementation(() => ({
        getGenerativeModel: jest.fn().mockReturnValue({
          generateContentStream: mockGenerateContentStream,
        }),
      }));
      
      // Create a new instance with the updated mock
      provider = new VertexAIProvider(mockConfig);
      
      const messages = createToolTestMessages();
      const options = createToolOptions();
      const onToken = jest.fn();
      
      const result = await provider.generateStreamingCompletion(messages, onToken, options);
      
      // Use shared assertions
      assertToolCallResponse(result);
    });

    it('should handle mixed content and tool calls in streaming completion', async () => {
      // Mock VertexAI stream response with both text and tool calls
      const mockStreamResponse = [
        { 
          candidates: [{ 
            content: { 
              parts: [{ text: 'To get the weather, I need to use a tool.' }] 
            } 
          }] 
        },
        { 
          candidates: [{ 
            content: { 
              parts: [{ 
                functionCall: {
                  name: 'get_weather',
                  args: {
                    location: 'New York'
                  }
                } 
              }] 
            } 
          }] 
        }
      ];
      
      // Setup the mock for generateContentStream method
      const vertexai = require('@google-cloud/vertexai');
      const mockGenerateContentStream = jest.fn().mockResolvedValue({
        stream: {
          [Symbol.asyncIterator]: async function* () {
            for (const chunk of mockStreamResponse) {
              yield chunk;
            }
          }
        }
      });
      
      vertexai.VertexAI.mockImplementation(() => ({
        getGenerativeModel: jest.fn().mockReturnValue({
          generateContentStream: mockGenerateContentStream,
        }),
      }));
      
      // Create a new instance with the updated mock
      provider = new VertexAIProvider(mockConfig);
      
      const messages = createToolTestMessages();
      const options = createToolOptions();
      const onToken = jest.fn();
      
      const result = await provider.generateStreamingCompletion(messages, onToken, options);
      
      // Verify onToken was called for the text content
      expect(onToken).toHaveBeenCalledWith('To get the weather, I need to use a tool.');
      
      // Verify the final result contains both content and tool calls
      expect(result.content).toBe('To get the weather, I need to use a tool.');
      expect(result.toolCalls).toBeDefined();
      expect(result.toolCalls!.length).toBe(1);
      expect(result.toolCalls![0].name).toBe('get_weather');
      expect(result.toolCalls![0].arguments).toEqual({ location: 'New York' });
      expect(result.usage).toBeDefined();
    });

    it('should throw an error when the API call fails', async () => {
      // Setup the mock to throw an error
      const vertexai = require('@google-cloud/vertexai');
      const mockGenerateContentStream = jest.fn().mockRejectedValue(new Error('API Error'));
      
      vertexai.VertexAI.mockImplementation(() => ({
        getGenerativeModel: jest.fn().mockReturnValue({
          generateContentStream: mockGenerateContentStream,
        }),
      }));
      
      // Create a new instance with the updated mock
      provider = new VertexAIProvider(mockConfig);
      
      const messages = createTextTestMessages();
      const onToken = jest.fn();
      
      // Use shared error handling test
      await testErrorHandling(
        provider,
        messages,
        onToken,
        'Failed to generate streaming completion with Vertex AI'
      );
    });
  });
}); 