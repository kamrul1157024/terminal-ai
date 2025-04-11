export type MessageRole =
  | "system"
  | "user"
  | "assistant"
  | "tool"
  | "tool_call";

export type ToolCallResponse = {
  name: string;
  result: string;
  error?: string;
  callId: string;
};

export type ToolCallResult = {
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  arguments: Record<string, any>;
  callId: string;
};

export type Message<T extends MessageRole> = T extends "tool"
  ? {
      role: T;
      content: ToolCallResponse[];
    }
  : T extends "tool_call"
    ? {
        role: T;
        content: ToolCallResult[];
      }
    : {
        role: T;
        content: string;
      };

export type ToolParameter = {
  type: string;
  description?: string;
  enum?: string[];
  items?: {
    type: string;
  };
};

export type ToolDefinition = {
  name: string;
  description: string;
  parameters:
    | {
        type: "object";
        properties: Record<string, ToolParameter>;
        required?: string[];
      }
    | {};
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ToolHandler = (args: any) => any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ToolUIRender = (args: any) => void;

export type CompletionOptions = {
  tools?: ToolDefinition[];
  tool_call?: "auto" | "none" | { name: string };
};

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  model: string;
};

export type CompletionResult = {
  content: string;
  toolCalls?: ToolCallResult[];
  usage?: TokenUsage;
};

export type LLMProvider = {
  generateStreamingCompletion(
    messages: Message<MessageRole>[],
    onToken: (token: string) => void,
    options?: CompletionOptions,
  ): Promise<CompletionResult>;

  getModel(): string;
};

export type LLMProviderConfig = {
  apiKey?: string;
  model?: string;
  apiEndpoint?: string;
};
