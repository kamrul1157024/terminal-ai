import { TokenUsage } from "../llm/interface";
import { calculateCost } from "./model-config";
import chalk from "chalk";
import { logger } from "../logger";

function formatCost(cost: number): string {
  return "$" + cost.toFixed(6).replace(/\.?0+$/, "");
}

export function displayCostInfo(usage: TokenUsage): void {
  if (!usage) return;

  const cost = calculateCost(
    usage.model,
    usage.inputTokens,
    usage.outputTokens,
  );

  logger.info(chalk.cyan("\n💰 Usage for this request:"));
  logger.info(chalk.gray(`  Model: ${usage.model}`));
  logger.info(
    chalk.gray(`  Input tokens: ${usage.inputTokens.toLocaleString()}`),
  );
  logger.info(
    chalk.gray(`  Output tokens: ${usage.outputTokens.toLocaleString()}`),
  );
  logger.info(chalk.gray(`  Total cost: ${formatCost(cost)}`));
}

export class CumulativeCostTracker {
  private totalCost: number = 0;
  private totalInputTokens: number = 0;
  private totalOutputTokens: number = 0;
  private requests: number = 0;

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

  displayTotalCost(): void {
    if (this.requests === 0) return;

    logger.info(chalk.cyan("\n💰 Total usage for this session:"));
    logger.info(chalk.gray(`  Requests: ${this.requests}`));
    logger.info(
      chalk.gray(
        `  Total input tokens: ${this.totalInputTokens.toLocaleString()}`,
      ),
    );
    logger.info(
      chalk.gray(
        `  Total output tokens: ${this.totalOutputTokens.toLocaleString()}`,
      ),
    );
    logger.info(chalk.gray(`  Total cost: ${formatCost(this.totalCost)}`));
  }

  reset(): void {
    this.totalCost = 0;
    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;
    this.requests = 0;
  }
}
