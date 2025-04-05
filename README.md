# Terminal AI

A CLI application that uses AI to process natural language commands and execute them in the terminal.

It supports openAI gpt-4o, gpt-4o-mini and llama3.2 through ollama. It will support claude and gemini soon.


## Installation

```
npm install -g terminal-ai-tool
```

## Setup

If you are using ollama, make sure the server is running and the llama3.2 model is downloaded.

Run the initialization command to configure your AI provider:

```
ai setup
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
ai thread rename <thread-id> "React project setup"
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

## Profile Management

Profiles allow you to manage multiple AI provider configurations, making it easy to switch between different providers or models without reconfiguring your settings each time.

### Profile Basics

Each profile contains:
- A unique name
- An AI provider (OpenAI, Claude, Gemini, or Ollama)
- An API key
- A selected model

The active profile determines which AI provider and model is used for processing your commands.

### Managing Profiles

#### Listing Profiles

To view all configured profiles:

```bash
ai profile list
```

This shows all profiles with their provider, model, and pricing information. The active profile is marked.

#### Setting the Active Profile

To switch to a different profile:

```bash
ai profile set <profile-name>
```

All subsequent commands will use this profile until you change it again.

#### Deleting a Profile

To remove a profile you no longer need:

```bash
ai profile delete <profile-name>
```

If you delete the active profile, another profile will automatically be set as active.

#### Viewing Available Models

To see all available models with their pricing information:

```bash
ai profile models
```

You can filter models by provider:

```bash
ai profile models --provider openai
```

### Using a Specific Profile for a Command

You can temporarily use a different profile for a single command:

```bash
ai --profile <profile-name> "your command"
```

Or use the shorthand:

```bash
ai -p <profile-name> "your command"
```

### Profile Setup Example

1. Run the setup wizard to create your first profile:
   ```bash
   ai setup
   ```

2. Create additional profiles for different providers:
   ```bash
   # The setup command will guide you through creating a new profile
   ai setup
   ```

3. Switch between profiles as needed:
   ```bash
   ai profile set work-openai
   ai profile set personal-claude
   ```

4. Use a specific profile without switching:
   ```bash
   ai -p work-openai "analyze this log file"
   ```

## Cost Tracking

Cost Tracking is not completly correct but it will give you an idea of the cost of your commands.
