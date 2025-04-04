import { LLMProviderType } from "../llm";
import { encoding_for_model, get_encoding, type TiktokenModel } from "tiktoken";

/**
 * Get the appropriate tiktoken encoding for a model
 * @param model Model name/identifier
 * @returns Tiktoken encoding
 */
function getEncodingForModel(model: string): any {
  try {
    // For models explicitly supported by tiktoken
    if (
      [
        "gpt-4",
        "gpt-4-0314",
        "gpt-4-32k",
        "gpt-4-32k-0314",
        "gpt-3.5-turbo",
        "gpt-3.5-turbo-0301",
        "text-davinci-003",
        "text-davinci-002",
        "text-davinci-001",
        "text-curie-001",
        "text-babbage-001",
        "text-ada-001",
        "davinci",
        "curie",
        "babbage",
        "ada",
        "gpt-4o",
        "gpt-4-turbo",
        "gpt-3.5-turbo-16k",
      ].includes(model)
    ) {
      return encoding_for_model(model as TiktokenModel);
    }

    // Use appropriate base encoding based on model name patterns
    if (model.includes("gpt-4")) {
      return encoding_for_model("gpt-4" as TiktokenModel);
    } else if (model.includes("gpt-3.5")) {
      return encoding_for_model("gpt-3.5-turbo" as TiktokenModel);
    } else {
      // For other models, use cl100k_base (most modern encoding)
      return get_encoding("cl100k_base");
    }
  } catch (error) {
    console.warn(
      `Tiktoken encoding not available for model ${model}, using cl100k_base`,
    );
    // Default fallback
    return get_encoding("cl100k_base");
  }
}

/**
 * Count tokens in text using tiktoken
 * @param text The text to count tokens for
 * @param model Model name or identifier
 * @returns Accurate token count
 */
export function countTokens(text: string, model: string): number {
  if (!text) return 0;

  try {
    const enc = getEncodingForModel(model);
    const tokens = enc.encode(text);
    return tokens.length;
  } catch (error) {
    console.warn(`Error counting tokens with tiktoken: ${error}`);
    // Fallback to simple approximation if tiktoken fails
    return estimateTokenCount(text);
  }
}

/**
 * Roughly estimate the number of tokens in a text (fallback method)
 * This is a simple approximation - about 4 chars per token for English text
 * @param text The text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  // Simple approximation: ~4 characters per token for English text
  return Math.ceil(text.length / 4);
}

/**
 * Count tokens for a prompt based on provider and model
 * @param text Text to count tokens for
 * @param provider Provider type
 * @param model Model name
 * @returns Token count
 */
export function countPromptTokens(
  text: string,
  provider: LLMProviderType,
  model: string,
): number {
  if (!text) return 0;

  // Use tiktoken for accurate counting
  return countTokens(text, model);
}

/**
 * A class to track token usage during a session
 */
export class TokenUsageTracker {
  private inputTokens: number = 0;
  private outputTokens: number = 0;
  private provider: LLMProviderType;
  private model: string;

  constructor(provider: LLMProviderType, model: string) {
    this.provider = provider;
    this.model = model;
  }

  /**
   * Add input tokens to the tracker
   * @param text Input text
   */
  addInputTokens(text: string): void {
    this.inputTokens += countPromptTokens(text, this.provider, this.model);
  }

  /**
   * Add output tokens to the tracker
   * @param text Output text
   */
  addOutputTokens(text: string): void {
    this.outputTokens += countTokens(text, this.model);
  }

  /**
   * Get the current token usage
   * @returns Object containing input and output token counts
   */
  getUsage(): { inputTokens: number; outputTokens: number; model: string } {
    return {
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      model: this.model,
    };
  }

  /**
   * Reset token counters
   */
  reset(): void {
    this.inputTokens = 0;
    this.outputTokens = 0;
  }
}
