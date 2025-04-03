# Terminal AI

A CLI application that uses AI to process natural language commands and execute them in the terminal.

## Features

- Convert natural language to terminal commands
- Special handling for potentially dangerous commands
- Automatic sudo escalation when required
- Configurable AI provider support

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

```
ai "your command in natural language"
```

### Examples

```
ai "list all files in the current directory"
ai "delete all files in current folder"
```

When using a potentially destructive command, the application will ask for confirmation before executing.

## Development

- `yarn dev`: Run the application in development mode
- `yarn build`: Build the application
- `yarn start`: Run the built application

## License

MIT 