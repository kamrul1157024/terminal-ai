# AI CLI

A CLI application that uses AI to process natural language commands and execute them in the terminal.

## Features

- Convert natural language to terminal commands
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

In basic mode, the AI converts your natural language request into a single terminal command and executes it:

```
ai "your command in natural language"
# or
npx ai "your command in natural language"
```

#### Examples

```
ai "list all files in the current directory"
ai "delete all files in current folder"
```

When using a potentially destructive command, the application will ask for confirmation before executing.

### Agent Mode

In agent mode, the AI maintains a continuous conversation, suggesting and executing commands with your permission:

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
- Analyze your request and suggest appropriate commands
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

## License

MIT 