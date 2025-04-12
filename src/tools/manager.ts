import { ZodTypeAny } from "zod";

import {
  ToolCallResult,
  ToolDefinition,
  ToolHandler,
  ToolUIRender,
} from "../llm/interface";
import { logger } from "../logger";

import { ToolGroup } from "./tool-group";
import { LLMTool } from "./types";



export class ToolManager {
  private toolGroups: ToolGroup[] = [];
  private _defaultToolGroup: ToolGroup;

  constructor() {
    this._defaultToolGroup = new ToolGroup();
    this.toolGroups = [this._defaultToolGroup];
  }

  registerTool<T extends ZodTypeAny>(definition: LLMTool<T>): void {
    this._defaultToolGroup.registerTool(definition);
  }

  registerToolGroup(group: ToolGroup): void {
    this.toolGroups.push(group);
  }

  getToolPrompt(): string {
    return this.toolGroups.map((group) => group.getToolPrompt()).join("\n");
  }

  getTools(): ToolDefinition[] {
    return this.toolGroups.flatMap((group) => group.getTools());
  }

  get toolUIRenders(): Record<string, ToolUIRender> {
    return this.toolGroups.reduce((acc, group) => {
      return { ...acc, ...group.toolUIRenders };
    }, {});
  }

  get toolHandlers(): Record<string, ToolHandler> {
    return this.toolGroups.reduce((acc, group) => {
      return { ...acc, ...group.toolHandlers };
    }, {});
  }

  handleToolCallRender(toolCall: ToolCallResult) {
    const render = this.toolUIRenders[toolCall.name];

    if (!render) {
      logger.warn(`No render registered for tool: ${toolCall.name}`);
    }

    render?.(toolCall.arguments);
  }

  async handleToolCall(toolCall: ToolCallResult) {
    const handler = this.toolHandlers[toolCall.name];

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
