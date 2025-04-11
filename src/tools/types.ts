import { ZodTypeAny, z } from "zod";

export type LLMTool<T extends ZodTypeAny> = {
  args: T;
  name: string;
  description: string;
  prompt: string;
  handler: (args: z.infer<T>) => Promise<{ data: string; error?: string }>;
  render: (args: z.infer<T>) => void;
};
