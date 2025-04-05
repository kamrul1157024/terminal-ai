import ora from "ora";
import {
  LLMProvider,
  Message,
  MessageRole,
  CompletionOptions,
  FunctionCallResponse,
  TokenUsage,
} from "../llm/interface";
import { FunctionManager } from "../functions/manager";
import chalk from "chalk";

const DEFAULT_TERMINAL_SYSTEM_PROMPT =
  "You are a helpful terminal assistant. Convert natural language requests into terminal commands. " +
  "Respond with ONLY the terminal command, nothing else.";

export type FunctionHandler = (args: Record<string, any>) => Promise<string>;

export class LLM {
  private llmProvider: LLMProvider;
  private systemPrompt: string;
  private functionManager: FunctionManager;

  constructor({
    llmProvider,
    systemPrompt = DEFAULT_TERMINAL_SYSTEM_PROMPT,
    functionManager = new FunctionManager(),
  }: {
    llmProvider: LLMProvider;
    systemPrompt?: string;
    functionManager?: FunctionManager;
  }) {
    this.llmProvider = llmProvider;
    this.systemPrompt = systemPrompt;
    this.functionManager = functionManager;
  }

  async generateStreamingCompletion({
    input,
    onToken,
    conversationHistory,
  }: {
    input: string;
    onToken: (token: string) => void;
    conversationHistory: Message<MessageRole>[];
  }): Promise<{
    history: Message<MessageRole>[];
    usage: TokenUsage;
  }> {
    const history = [...conversationHistory];

    const messages: Message<MessageRole>[] = [
      { role: "system", content: this.systemPrompt },
      ...history,
      { role: "user", content: input },
    ];

    const options: CompletionOptions = {};
    if (this.functionManager.getFunctions().length > 0) {
      options.functions = this.functionManager.getFunctions();
      options.function_call = "auto";
    }

    const spinner = ora({
      text: chalk.yellow("AI Assistant is thinking..."),
      spinner: "dots",
    }).start();

    const onStreamToken = (token: string) => {
      spinner.stop();
      onToken(token);
    };
    const completion = await this.llmProvider.generateStreamingCompletion(
      messages,
      onStreamToken,
      options,
    );

    if (spinner.isSpinning) {
      spinner.stop();
    }

    if (completion.functionCalls && completion.functionCalls.length > 0) {
      history.push({
        role: "function_call",
        content: completion.functionCalls,
      });

      const results = await Promise.all(
        completion.functionCalls.map(
          this.functionManager.handleFunctionCall.bind(this.functionManager),
        ),
      );

      history.push({
        role: "function",
        content: results.map((result) => ({
          name: result.name,
          result: String(result.result),
          error: String(result.error),
          callId: result.callId,
        })),
      });
    } else {
      history.push({
        role: "assistant",
        content: completion.content,
      });
    }
    return {
      history,
      usage: completion.usage || {
        inputTokens: 0,
        outputTokens: 0,
        model: this.llmProvider.getModel(),
      },
    };
  }
}
