import OpenAI from "openai";

import { countPromptTokens, countTokens } from "../../utils/token-counter";
import { LLMProviderType } from "../index";
import {
  LLMProvider,
  LLMProviderConfig,
  Message,
  MessageRole,
  CompletionOptions,
  CompletionResult,
  TokenUsage,
  FunctionCallResult,
  FunctionDefinition,
} from "../interface";

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;

  constructor(config: LLMProviderConfig) {
    if (!config.apiKey) {
      throw new Error(
        'OpenAI API key is required. Run "ai init" to configure.',
      );
    }

    this.client = new OpenAI({
      apiKey: config.apiKey,
    });
    this.model = config.model || "gpt-4o";
  }

  getModel(): string {
    return this.model;
  }

  mapToOpenAIMessages(
    messages: Message<MessageRole>[],
  ): OpenAI.ChatCompletionMessageParam[] {
    const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [];
    messages.forEach((msg) => {
      if (msg.role === "user") {
        openaiMessages.push({
          role: "user",
          content: msg.content,
        } satisfies OpenAI.ChatCompletionUserMessageParam);
      }

      if (msg.role === "assistant") {
        openaiMessages.push({
          role: "assistant",
          content: msg.content,
        } satisfies OpenAI.ChatCompletionAssistantMessageParam);
      }

      if (msg.role === "function_call") {
        openaiMessages.push({
          role: "assistant",
          tool_calls: msg.content.map((call) => ({
            id: call.callId,
            type: "function",
            function: {
              name: call.name,
              arguments:
                call.arguments && Object.keys(call.arguments).length > 0
                  ? JSON.stringify(call.arguments)
                  : "",
            },
          })),
        } satisfies OpenAI.ChatCompletionAssistantMessageParam);
      }
      if (msg.role === "system") {
        openaiMessages.push({
          role: "system",
          content: msg.content,
        } satisfies OpenAI.ChatCompletionSystemMessageParam);
      }

      if (msg.role === "function") {
        msg.content.forEach((call) => {
          openaiMessages.push({
            role: "tool",
            content: call.result + call.error,
            tool_call_id: call.callId,
          } satisfies OpenAI.ChatCompletionToolMessageParam);
        });
      }
    });

    return openaiMessages;
  }

  mapToOpenAITools(
    functions: FunctionDefinition[],
  ): OpenAI.ChatCompletionTool[] {
    return functions.map((func) => ({
      type: "function",
      function: {
        name: func.name,
        description: func.description,
        parameters: func.parameters,
      },
    }));
  }

  mapOpenAIToolsCallTOGenericFunctionCall(toolCall: {
    function: {
      name: string;
      arguments: string;
    };
    id: string;
  }): FunctionCallResult {
    return {
      name: toolCall.function.name,
      arguments: toolCall.function.arguments
        ? JSON.parse(toolCall.function.arguments)
        : {},
      callId: toolCall.id,
    };
  }

  async generateStreamingCompletion(
    messages: Message<MessageRole>[],
    onToken: (token: string) => void,
    options?: CompletionOptions,
  ): Promise<CompletionResult> {
    try {
      const openaiMessages = this.mapToOpenAIMessages(messages);
      const openaiTools = this.mapToOpenAITools(options?.functions || []);

      const requestParams = {
        model: this.model,
        messages: openaiMessages,
        tools: openaiTools,
        stream: true,
        tool_choice: openaiTools.length > 0 ? "auto" : "none",
      } satisfies OpenAI.ChatCompletionCreateParamsStreaming;

      let fullContent = "";
      const stream = await this.client.chat.completions.create(requestParams);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const toolCallMap: Record<string, any> = {};

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for await (const chunk of stream as any) {
        const content = chunk.choices[0]?.delta?.content || "";

        if (content) {
          onToken(content);
          fullContent += content;
        }

        const toolCalls = chunk.choices[0]?.delta?.tool_calls;
        if (toolCalls && toolCalls.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          toolCalls.forEach((toolCall: any) => {
            if (toolCall.function.name) {
              toolCallMap[toolCall.index] = toolCall;
            } else {
              toolCallMap[toolCall.index].function.arguments +=
                toolCall.function.arguments;
            }
          });
        }
      }

      const functionCalls = Object.values(toolCallMap).map(
        this.mapOpenAIToolsCallTOGenericFunctionCall,
      );
      const result: CompletionResult = { content: fullContent };

      if (functionCalls.length > 0) {
        result.functionCalls = functionCalls;
      }

      const usage: TokenUsage = {
        inputTokens: this.estimateInputTokens(messages),
        outputTokens: countTokens(fullContent, this.model),
        model: this.model,
      };

      result.usage = usage;

      return result;
    } catch {
      throw new Error("Failed to generate streaming completion with OpenAI");
    }
  }

  private estimateInputTokens(messages: Message<MessageRole>[]): number {
    let totalTokens = 0;

    for (const message of messages) {
      if (message.role === "function") {
        for (const call of message.content) {
          totalTokens += countPromptTokens(
            call.result + call.error,
            LLMProviderType.OPENAI,
            this.model,
          );
        }
      } else {
        if (typeof message.content === "string") {
          totalTokens += countTokens(message.content, this.model);
        } else {
          totalTokens += countTokens(
            JSON.stringify(message.content),
            this.model,
          );
        }
      }
    }

    return totalTokens;
  }
}
