import { TokenUsage } from "../llm/interface";
import { calculateCost } from "./model-config";
import chalk from "chalk";

/**
 * Format a cost amount in USD
 * @param cost The cost in USD
 * @returns Formatted cost string
 */
function formatCost(cost: number): string {
  // Format to max 6 decimal places, but only show necessary decimal places
  return "$" + cost.toFixed(6).replace(/\.?0+$/, "");
}

/**
 * Display cost information to the user based on token usage
 * @param usage Token usage information
 */
export function displayCostInfo(usage: TokenUsage): void {
  if (!usage) return;

  const cost = calculateCost(
    usage.model,
    usage.inputTokens,
    usage.outputTokens,
  );

  console.log(chalk.cyan("\n💰 Usage for this request:"));
  console.log(chalk.gray(`  Model: ${usage.model}`));
  console.log(
    chalk.gray(`  Input tokens: ${usage.inputTokens.toLocaleString()}`),
  );
  console.log(
    chalk.gray(`  Output tokens: ${usage.outputTokens.toLocaleString()}`),
  );
  console.log(chalk.gray(`  Total cost: ${formatCost(cost)}`));
}

/**
 * Track cumulative usage across multiple requests
 */
export class CumulativeCostTracker {
  private totalCost: number = 0;
  private totalInputTokens: number = 0;
  private totalOutputTokens: number = 0;
  private requests: number = 0;

  /**
   * Add usage from a request to the tracker
   * @param usage Token usage from a request
   */
  addUsage(usage: TokenUsage): void {
    if (!usage) return;

    this.totalInputTokens += usage.inputTokens;
    this.totalOutputTokens += usage.outputTokens;
    this.totalCost += calculateCost(
      usage.model,
      usage.inputTokens,
      usage.outputTokens,
    );
    this.requests++;
  }

  /**
   * Display cumulative cost information
   */
  displayTotalCost(): void {
    if (this.requests === 0) return;

    console.log(chalk.cyan("\n💰 Total usage for this session:"));
    console.log(chalk.gray(`  Requests: ${this.requests}`));
    console.log(
      chalk.gray(
        `  Total input tokens: ${this.totalInputTokens.toLocaleString()}`,
      ),
    );
    console.log(
      chalk.gray(
        `  Total output tokens: ${this.totalOutputTokens.toLocaleString()}`,
      ),
    );
    console.log(chalk.gray(`  Total cost: ${formatCost(this.totalCost)}`));
  }

  /**
   * Reset the cumulative tracker
   */
  reset(): void {
    this.totalCost = 0;
    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;
    this.requests = 0;
  }
}
