import { ZodTypeAny, z } from "zod";

export type LLMFunction<T extends ZodTypeAny> = {
  args: T;
  name: string;
  description: string;
  handler: (args: z.infer<T>) => Promise<{ data: string; error?: string }>;
  render: (args: z.infer<T>) => void;
};
