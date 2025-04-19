import chalk from "chalk";
import ora from "ora";

import { getModelByValue, ModelLimits } from "../config/model-config";
import {
  LLMProvider,
  Message,
  MessageRole,
  CompletionOptions,
} from "../llm/interface";
import { ToolManager } from "../tools/manager";
import { isTTY, showAssistantMessagePrefix } from "../ui/output";
import { getCostTracker } from "../utils/context-vars";

const DEFAULT_TERMINAL_SYSTEM_PROMPT =
  "You are a helpful terminal assistant. Convert natural language requests into terminal commands. " +
  "Respond with ONLY the terminal command, nothing else.";


function _truncateConversationHistory(conversationHistory: Message<MessageRole>[], limits: ModelLimits) {
  let i = conversationHistory.length - 1;
  let lastMessageIndex = i;
  let totalTokens = 0;
  while (i >= 0) {
    const message = conversationHistory[i];
    const messageTokens = message.content.length;
    totalTokens += messageTokens;
    if (totalTokens > limits.max_input_tokens) {
      break;
    }
    lastMessageIndex = i;
    i--;
  }
  return conversationHistory.slice(lastMessageIndex);
}

export class LLM {
  private llmProvider: LLMProvider;
  private systemPrompt: string;
  private toolManager: ToolManager;

  constructor({
    llmProvider,
    systemPrompt = DEFAULT_TERMINAL_SYSTEM_PROMPT,
    toolManager = new ToolManager(),
  }: {
    llmProvider: LLMProvider;
    systemPrompt?: string;
    toolManager?: ToolManager;
  }) {
    this.llmProvider = llmProvider;
    this.systemPrompt = systemPrompt;
    this.toolManager = toolManager;
  }

  getTokenLimits() {
    const model = getModelByValue(this.llmProvider.getModel());
    return model?.limits!;
  }

  async runAgenticCompletion({
    onToken,
    conversationHistory,
  }: {
    onToken: (token: string) => void;
    conversationHistory: Message<MessageRole>[];
  }): Promise<{
    history: Message<MessageRole>[];
  }> {
    const history = [...conversationHistory];

    const messages: Message<MessageRole>[] = [
      { role: "system", content: this.systemPrompt },
      ...history,
    ];

    const options: CompletionOptions = {};
    if (this.toolManager.getTools().length > 0) {
      options.tools = this.toolManager.getTools();
      options.tool_call = "auto";
    }

    const spinner = ora({
      text: chalk.yellow("AI Assistant is thinking..."),
      spinner: "dots",
    });
    if (isTTY()) {
      spinner.start();
    }
    const onStreamToken = (token: string) => {
      if (spinner.isSpinning) {
        spinner.stop();
        showAssistantMessagePrefix();
      }
      onToken(token);
    };
    const completion = await this.llmProvider.generateStreamingCompletion(
      _truncateConversationHistory(messages, this.getTokenLimits()),
      onStreamToken,
      options,
    );

    if (spinner.isSpinning) {
      spinner.stop();
    }

    if (completion.toolCalls && completion.toolCalls.length > 0) {
      history.push({
        role: "tool_call",
        content: completion.toolCalls,
      });

      for (const toolCall of completion.toolCalls) {
        this.toolManager.handleToolCallRender(toolCall);
      }

      const results = await Promise.all(
        completion.toolCalls.map(
          this.toolManager.handleToolCall.bind(this.toolManager),
        ),
      );

      history.push({
        role: "tool",
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
    if (completion.usage) {
      getCostTracker()?.addUsage(completion.usage);
    }

    if (completion.toolCalls) {
      const result = await this.runAgenticCompletion({
        onToken: (token: string) => {
          onToken(token);
        },
        conversationHistory: history,
      });
      return {
        history: result.history,
      };
    }
    return {
      history,
    };
  }
}
