# LLM Provider Tests

This directory contains unit tests for the LLM providers in the terminal-ai application. The tests focus on verifying the correct functionality of each provider's implementation of the `LLMProvider` interface.

## Testing Approach

The tests follow a modular and reusable approach:

1. **Shared Test Utilities**: Common test fixtures, assertion helpers, and utility functions are defined in `test-utils.ts` to promote code reuse across provider tests.

2. **Provider-Specific Mocking**: Each provider test file contains provider-specific mocking logic for their respective APIs.

3. **Standard Test Coverage**:
   - Verifying `getModel()` returns the correct model name
   - Testing `generateStreamingCompletion()` with:
     - Text-only responses
     - Tool call responses
     - Mixed text and tool call responses
     - Error handling

## Running Tests

To run all tests:

```bash
npm test
```

To run tests for a specific provider:

```bash
npm test -- -t "OpenAIProvider"
npm test -- -t "GeminiProvider" 
npm test -- -t "OllamaProvider"
npm test -- -t "VertexAIProvider"
```

## Test Structure

```
TEST/
├── README.md
├── test-utils.ts             # Shared test utilities and helpers
├── openai-provider.spec.ts   # Tests for OpenAI provider
├── gemini-provider.spec.ts   # Tests for Gemini provider
├── ollama-provider.spec.ts   # Tests for Ollama provider
└── vertexai-provider.spec.ts # Tests for VertexAI provider
```

## Adding Tests for New Providers

When adding tests for a new provider:

1. Create a new test file following the naming convention `<provider-name>.spec.ts`
2. Import the shared test utilities from `test-utils.ts`
3. Set up provider-specific mocks for the underlying API
4. Implement standard test cases using the shared utilities
5. Add any provider-specific test cases as needed 