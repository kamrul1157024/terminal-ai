import { ZodTypeAny } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import {
  ToolCallResult,
  ToolDefinition,
  ToolHandler,
  ToolUIRender,
} from "../llm/interface";
import { logger } from "../logger";

import { LLMTool } from "./types";
function getToolDefinition<T extends ZodTypeAny>(
  toolDefinition: LLMTool<T>,
): ToolDefinition {
  return {
    name: toolDefinition.name,
    description: toolDefinition.description,
    parameters:
      zodToJsonSchema(toolDefinition.args, "arguments")["definitions"]?.[
        "arguments"
      ] || {},
  };
}

export class ToolManager {
  private tools: ToolDefinition[] = [];
  private toolHandlers: Map<string, ToolHandler> = new Map();
  private toolUIRenders: Map<string, ToolUIRender> = new Map();
  private toolPrompts: Map<string, string> = new Map();

  constructor() {
    this.toolHandlers = new Map();
    this.tools = [];
  }

  registerTool<T extends ZodTypeAny>(definition: LLMTool<T>): void {
    this.tools.push(getToolDefinition(definition));
    this.toolHandlers.set(definition.name, definition.handler);
    this.toolUIRenders.set(definition.name, definition.render);
    this.toolPrompts.set(definition.name, definition.prompt);
  }

  getToolPrompt(): string {
    return Object.entries(this.toolPrompts)
      .map(([name, prompt]) => `Here is how to use the ${name} tool: ${prompt}`)
      .join("\n");
  }

  getTools(): ToolDefinition[] {
    return this.tools;
  }

  handleToolCallRender(toolCall: ToolCallResult) {
    const render = this.toolUIRenders.get(toolCall.name);

    if (!render) {
      logger.warn(`No render registered for tool: ${toolCall.name}`);
    }

    render?.(toolCall.arguments);
  }

  async handleToolCall(toolCall: ToolCallResult) {
    const handler = this.toolHandlers.get(toolCall.name);

    if (!handler) {
      throw new Error(`No handler registered for tool: ${toolCall.name}`);
    }

    try {
      const result = await handler(toolCall.arguments);
      return {
        name: toolCall.name,
        result:
          typeof result === "object" ? JSON.stringify(result) : String(result),
        callId: toolCall.callId,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        logger.error(`Error executing tool ${toolCall.name}: ${error.message}`);
        return {
          name: toolCall.name,
          error: error.message,
          callId: toolCall.callId,
        };
      } else {
        logger.error(`Error executing tool ${toolCall.name}: ${String(error)}`);
        return {
          name: toolCall.name,
          error: String(error),
          callId: toolCall.callId,
        };
      }
    }
  }
}
