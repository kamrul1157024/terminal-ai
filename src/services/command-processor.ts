import {
  LLMProvider,
  Message,
  MessageRole,
  CompletionOptions,
  FunctionCallResponse,
  TokenUsage,
} from "../llm/interface";
import { FunctionCallProcessor } from "./functioncall-processor";

const DEFAULT_TERMINAL_SYSTEM_PROMPT =
  "You are a helpful terminal assistant. Convert natural language requests into terminal commands. " +
  "Respond with ONLY the terminal command, nothing else.";

export type FunctionHandler = (args: Record<string, any>) => Promise<string>;

export class CommandProcessor {
  private llmProvider: LLMProvider;
  private systemPrompt: string;
  private functionCallProcessor: FunctionCallProcessor;

  constructor({
    llmProvider,
    systemPrompt = DEFAULT_TERMINAL_SYSTEM_PROMPT,
    functionCallProcessor = new FunctionCallProcessor(),
  }: {
    llmProvider: LLMProvider;
    systemPrompt?: string;
    functionCallProcessor?: FunctionCallProcessor;
  }) {
    this.llmProvider = llmProvider;
    this.systemPrompt = systemPrompt;
    this.functionCallProcessor = functionCallProcessor;
  }

  async processCommand({
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
    if (this.functionCallProcessor.getFunctions().length > 0) {
      options.functions = this.functionCallProcessor.getFunctions();
      options.function_call = "auto";
    }

    const completion = await this.llmProvider.generateStreamingCompletion(
      messages,
      onToken,
      options,
    );

    if (completion.functionCalls && completion.functionCalls.length > 0) {
      history.push({
        role: "function_call",
        content: completion.functionCalls,
      });

      const results = await Promise.all(
        completion.functionCalls.map(
          this.functionCallProcessor.handleFunctionCall.bind(
            this.functionCallProcessor,
          ),
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
