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

## Advanced Usage

### Using with Pipes

The AI CLI can process input from other commands via pipes:

```bash
# Process file contents
cat config.json | ai "validate this JSON file"

# Filter command output
ps aux | ai "find all Node.js processes"

# Analyze logs
tail -n 100 server.log | ai "what errors occurred in the last 100 lines"
```

### Environment Variables

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

### Configuration File

The configuration is stored in `~/.terminal-ai.yaml`. You can manually edit this file to change settings:

```yaml
profiles:
  - name: default
    provider: openai
    apiKey: sk-...
    model: gpt-4
activeProfile: default
```

## Thread Management

Threads allow you to maintain conversational context across multiple interactions with the AI. This is especially useful for complex tasks that require multiple steps or when you want to continue a conversation later.

### Thread Basics

Each thread maintains its conversation history, allowing the AI to reference previous commands and responses. This provides continuity and context awareness for ongoing tasks.

### Managing Threads

#### Listing Threads

To view all available threads:

```bash
ai thread list
```

You can filter threads by name:

```bash
ai thread list --filter "project"
```

After listing threads, you can select one interactively to continue the conversation.

#### Attaching to a Thread

To continue a conversation in an existing thread:

```bash
ai thread attach <thread-id>
```

This will resume the conversation where you left off, with all previous context intact.

#### Using a Thread for a Single Command

To use a specific thread for a one-time command without entering agent mode:

```bash
ai --thread <thread-id> "your command"
```

#### Renaming Threads

To give a thread a more descriptive name:

```bash
ai thread rename <thread-id> "New descriptive name"
```

#### Deleting Threads

When you're done with a thread, you can delete it:

```bash
ai thread delete <thread-id>
```

### Thread Workflow Example

1. Start a new task in agent mode:
   ```bash
   ai -a "set up a React project"
   ```
   
   This creates a new thread automatically.

2. Later, list your threads to find the React project:
   ```bash
   ai thread list
   ```

3. Attach to the thread to continue the setup:
   ```bash
   ai thread attach <thread-id>
   ```

4. After completing the task, rename the thread for future reference:
   ```bash
   ai thread rename <thread-id> "React project setup"
   ```

## Cost Tracking

## License

MIT 