import { ZodTypeAny } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import {
  ToolDefinition,
  ToolHandler,
  ToolUIRender,
} from "../llm/interface";

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
export class ToolGroup {
  private tools: ToolDefinition[] = [];
  toolHandlers: Record<string, ToolHandler> = {};
  toolUIRenders: Record<string, ToolUIRender> = {};
  toolPrompts: Record<string, string> = {};

  constructor() {
    this.toolHandlers = {};
    this.toolUIRenders = {};
    this.toolPrompts = {};
    this.tools = [];
  }

  registerTool<T extends ZodTypeAny>(definition: LLMTool<T>): void {
    this.tools.push(getToolDefinition(definition));
    this.toolHandlers[definition.name] = definition.handler;
    this.toolUIRenders[definition.name] = definition.render;
    this.toolPrompts[definition.name] = definition.prompt;
  }

  getToolPrompt(): string {
    return Object.entries(this.toolPrompts)
      .map(([name, prompt]) => `Here is how to use the ${name} tool: ${prompt}`)
      .join("\n");
  }

  getTools(): ToolDefinition[] {
    return this.tools;
  }
}