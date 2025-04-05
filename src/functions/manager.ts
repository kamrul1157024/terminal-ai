import {
  FunctionCallResult,
  FunctionDefinition,
  FunctionHandler,
} from "../llm/interface";

export class FunctionManager {
  private functions: FunctionDefinition[] = [];
  private functionHandlers: Map<string, FunctionHandler> = new Map();

  constructor() {
    this.functionHandlers = new Map();
    this.functions = [];
  }

  registerFunction(
    definition: FunctionDefinition,
    handler: FunctionHandler,
  ): void {
    this.functions.push(definition);
    this.functionHandlers.set(definition.name, handler);
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
