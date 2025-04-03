# AI CLI

[![npm version](https://img.shields.io/npm/v/ai.svg)](https://www.npmjs.com/package/ai)
[![CI](https://github.com/yourusername/ai/actions/workflows/pull-request.yml/badge.svg)](https://github.com/yourusername/ai/actions/workflows/pull-request.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A CLI application that uses AI to process natural language commands and execute them in the terminal.

## Features

- Convert natural language to terminal commands with real-time streaming responses
- Special handling for potentially dangerous commands
- Automatic sudo escalation when required
- Configurable AI provider support
- Interactive agent mode with conversational interface
- Support for multiple AI providers:
  - OpenAI
  - Claude (Anthropic)
  - Gemini (Google)
  - Ollama (local models)

## Installation

### Requirements

- Node.js v20.0.0 or higher

### Using npx (recommended)

You can run AI CLI without installing it using npx:

```bash
npx ai init
npx ai "your command in natural language"
```

### Global Installation

If you prefer to install the package globally:

```bash
npm install -g ai
```

Then you can use the `ai` command directly:

```bash
ai init
ai "your command in natural language"
```

### From Source

1. Clone this repository
2. Install dependencies:
   ```
   yarn install
   ```
3. Build the application:
   ```
   yarn build
   ```
4. Link the application globally (optional):
   ```
   yarn link
   ```

## Setup

Run the initialization command to configure your AI provider:

```
ai init
# or
npx ai init
```

This will guide you through setting up your preferred AI provider and API key. The configuration will be stored in `~/.terminal-ai.yaml`.

## Using the Command

### Basic Mode

In basic mode, the AI converts your natural language request into a single terminal command and executes it. The response is streamed in real-time for instant feedback:

```
ai "your command in natural language"
# or
npx ai "your command in natural language"
```

You can also pipe output from other commands to provide context:

```
ls -la | ai "find all JavaScript files in this list"
cat error.log | ai "explain this error and suggest a fix"
git status | ai "which files were modified today"
```

The AI will use the piped input as context when generating the appropriate command.

#### Examples

```
ai "list all files in the current directory"
ai "delete all files in current folder"
```

When using a potentially destructive command, the application will ask for confirmation before executing.

### Agent Mode

In agent mode, the AI maintains a continuous conversation, suggesting and executing commands with your permission. All responses are streamed in real-time:

```
ai --agent "your task description"
# or
npx ai --agent "your task description"
```

Or use the shorthand:

```
ai -a "your task description"
```

The agent will:
- Analyze your request and suggest appropriate commands in real-time
- Provide reasoning for each suggested command
- Ask for confirmation before executing potentially dangerous commands
- Return command output to the AI for further analysis
- Maintain conversation context for multi-step tasks

To exit agent mode, type `exit` or `quit`.

#### Examples

```
ai -a "help me find large files on my system"
ai -a "set up a basic Node.js project"
```

### Advanced Usage

#### Using with Pipes

The AI CLI can process input from other commands via pipes:

```bash
# Process file contents
cat config.json | ai "validate this JSON file"

# Filter command output
ps aux | ai "find all Node.js processes"

# Analyze logs
tail -n 100 server.log | ai "what errors occurred in the last 100 lines"
```

#### Environment Variables

You can override configuration settings using environment variables:

```bash
# Set API key
export AI_API_KEY=your_api_key
ai "list files"

# Change model
export AI_MODEL=gpt-4
ai "analyze this code"

# Set provider
export AI_PROVIDER=claude
ai "help me with this task"
```

#### Configuration File

The configuration is stored in `~/.terminal-ai.yaml`. You can manually edit this file to change settings:

```yaml
provider: openai
apiKey: sk-...
model: gpt-4
apiEndpoint: https://api.openai.com/v1
```

## Cost Tracking

AI CLI includes built-in cost tracking for all API-based providers:

- Shows token usage after each request
- Displays the estimated cost based on provider pricing
- Tracks cumulative usage during agent sessions
- Supports accurate token counting using tiktoken

## Development

- `yarn dev`: Run the application in development mode
- `yarn build`: Build the application
- `yarn start`: Run the built application

## Contributing to the Project

We welcome contributions to AI CLI! Here's how you can help:

### Setting Up for Development

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/ai.git`
3. Install dependencies: `yarn install`
4. Create a branch for your changes: `git checkout -b feature/your-feature-name`

### Making Changes

- Follow the existing code style and patterns
- Add tests for new functionality
- Update documentation as needed
- Make sure all tests pass: `yarn test`
- Build the project: `yarn build`

### Submitting a Pull Request

1. Push your changes to your fork: `git push origin feature/your-feature-name`
2. Create a pull request from your fork to the main repository
3. Provide a clear description of the changes and why they're needed
4. Reference any related issues

### Adding a New AI Provider

To add support for a new AI provider:

1. Create a new file in `src/llm/providers/` (e.g., `new-provider.ts`)
2. Implement the `LLMProvider` interface
3. Add the provider type to the `LLMProviderType` enum in `src/llm/index.ts`
4. Update the `createLLMProvider` function to handle the new provider
5. Add token counting support in `src/utils/token-counter.ts`
6. Update documentation and tests

### Code Style

- Use TypeScript for all new code
- Follow the existing code style
- Use meaningful variable and function names
- Add JSDoc comments for public functions and interfaces
- Keep functions focused and small

## Continuous Integration

This project uses GitHub Actions for continuous integration and deployment:

- **CI Workflow**: Runs on pull requests and pushes to the main branch to verify the build and tests pass.
- **Publish Workflow**: Automatically publishes to npm when a new GitHub release is created.

### Publishing a New Release

1. Create a new release on GitHub with a tag following semver (e.g., `v1.2.0`)
2. The GitHub Action will automatically:
   - Extract the version from the release tag
   - Update the version in `package.json`
   - Build the package
   - Publish to npm

### Setting Up NPM_TOKEN

To enable automatic publishing, you need to add your NPM token to your GitHub repository:

1. Generate an NPM access token with publish permissions
2. Add it as a secret named `NPM_TOKEN` in your GitHub repository settings

## License

MIT