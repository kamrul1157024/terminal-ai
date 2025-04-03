# Terminal AI

A CLI application that uses AI to process natural language commands and execute them in the terminal.

## Features

- Convert natural language to terminal commands
- Special handling for potentially dangerous commands
- Automatic sudo escalation when required
- Configurable AI provider support
- Interactive agent mode with conversational interface

## Installation

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
```

This will guide you through setting up your preferred AI provider and API key. The configuration will be stored in `~/.terminal-ai.yaml`.

## Usage

### Basic Mode

In basic mode, the AI converts your natural language request into a single terminal command and executes it:

```
ai "your command in natural language"
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

## Development

- `yarn dev`: Run the application in development mode
- `yarn build`: Build the application
- `yarn start`: Run the built application

## License

MIT 