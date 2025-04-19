import { encoding_for_model, get_encoding, type TiktokenModel } from "tiktoken";

function getEncodingForModel(model: string) {
  try {
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

    if (model.includes("gpt-4")) {
      return encoding_for_model("gpt-4" as TiktokenModel);
    } else if (model.includes("gpt-3.5")) {
      return encoding_for_model("gpt-3.5-turbo" as TiktokenModel);
    } else {
      return get_encoding("cl100k_base");
    }
  } catch {
    console.warn(
      `Tiktoken encoding not available for model ${model}, using cl100k_base`,
    );
    return get_encoding("cl100k_base");
  }
}

export function countTokens(text: string, model: string): number {
  if (!text) return 0;

  try {
    const enc = getEncodingForModel(model);
    const tokens = enc.encode(text);
    return tokens.length;
  } catch (error) {
    console.warn(`Error counting tokens with tiktoken: ${error}`);
    return estimateTokenCount(text);
  }
}

export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function countPromptTokens(
  text: string,
  model: string,
): number {
  if (!text) return 0;

  return countTokens(text, model);
}

export class TokenUsageTracker {
  private inputTokens: number = 0;
  private outputTokens: number = 0;
  private model: string;

  constructor(model: string) {
    this.model = model;
  }

  addInputTokens(text: string): void {
    this.inputTokens += countPromptTokens(text, this.model);
  }

  addOutputTokens(text: string): void {
    this.outputTokens += countTokens(text, this.model);
  }

  getUsage(): { inputTokens: number; outputTokens: number; model: string } {
    return {
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      model: this.model,
    };
  }

  reset(): void {
    this.inputTokens = 0;
    this.outputTokens = 0;
  }
}
