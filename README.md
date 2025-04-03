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

## Usage

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