import { FunctionDefinition, FunctionHandler } from "../llm/interface";
import { getSystemInfoFunction, getSystemInfoHandler } from "./system-info";
import {
  executeCommandFunction,
  executeCommandHandler,
} from "./execute-command";

/**
 * All available functions with their handlers
 */
export interface FunctionMap {
  definition: FunctionDefinition;
  handler: FunctionHandler;
}

/**
 * Collection of all available functions
 */
export const availableFunctions: Record<string, FunctionMap> = {
  getSystemInfo: {
    definition: getSystemInfoFunction,
    handler: getSystemInfoHandler,
  },
  executeCommand: {
    definition: executeCommandFunction,
    handler: executeCommandHandler,
  },
};

/**
 * Get all function definitions
 */
export function getAllFunctionDefinitions(): FunctionDefinition[] {
  return Object.values(availableFunctions).map((f) => f.definition);
}

/**
 * Get a function handler by name
 */
export function getFunctionHandler(name: string): FunctionHandler | undefined {
  const funcEntry = Object.values(availableFunctions).find(
    (f) => f.definition.name === name,
  );
  return funcEntry?.handler;
}

// Re-export all functions
export { getSystemInfoFunction, getSystemInfoHandler } from "./system-info";
export {
  executeCommandFunction,
  executeCommandHandler,
} from "./execute-command";
