import { ZodTypeAny } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import {
  FunctionCallResult,
  FunctionDefinition,
  FunctionHandler,
} from "../llm/interface";

import { LLMFunction } from "./types";
function getFunctionDefinition<T extends ZodTypeAny>(
  functionDefinition: LLMFunction<T>,
): FunctionDefinition {
  return {
    name: functionDefinition.name,
    description: functionDefinition.description,
    parameters:
      zodToJsonSchema(functionDefinition.args, "arguments")["definitions"]?.[
        "arguments"
      ] || {},
  };
}

export class FunctionManager {
  private functions: FunctionDefinition[] = [];
  private functionHandlers: Map<string, FunctionHandler> = new Map();

  constructor() {
    this.functionHandlers = new Map();
    this.functions = [];
  }

  registerFunction<T extends ZodTypeAny>(definition: LLMFunction<T>): void {
    this.functions.push(getFunctionDefinition(definition));
    this.functionHandlers.set(definition.name, definition.handler);
  }

  getFunctions(): FunctionDefinition[] {
    return this.functions;
  }

  async handleFunctionCall(functionCall: FunctionCallResult) {
    const handler = this.functionHandlers.get(functionCall.name);

    if (!handler) {
      throw new Error(
        `No handler registered for function: ${functionCall.name}`,
      );
    }

    try {
      const result = await handler(functionCall.arguments);
      return {
        name: functionCall.name,
        result:
          typeof result === "object" ? JSON.stringify(result) : String(result),
        callId: functionCall.callId,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error(
          `Error executing function ${functionCall.name}:`,
          error.message,
        );
        return {
          name: functionCall.name,
          error: error.message,
          callId: functionCall.callId,
        };
      } else {
        console.error(
          `Error executing function ${functionCall.name}:`,
          String(error),
        );
        return {
          name: functionCall.name,
          error: String(error),
          callId: functionCall.callId,
        };
      }
    }
  }
}
