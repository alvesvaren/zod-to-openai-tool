import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { OpenAI } from "openai";

interface Steps<T = void, Omitted extends string = never> {
  input<S extends z.ZodType<any, any>>(schema: S extends z.AnyZodObject ? S : never): Omit<Steps<z.infer<S>, Omitted | "input">, "input" | Omitted>;
  run(func: (input: T extends void ? never : T) => unknown): Omit<Steps<T, Omitted | "run">, "run" | "input" | Omitted> & CompletedTool;
  describe(description: string): Omit<Steps<T, Omitted | "describe">, Omitted | "describe">;
}

interface Data {
  func: (input: any) => unknown;
  schema: z.ZodType<any, any>;
  description: string | undefined;
}

interface CompletedTool {
  __data: Data;
}

export function tool<T = void>(): Steps<T> & CompletedTool {
  const data: Data = { schema: z.object({}), func: () => {}, description: undefined };

  return {
    input(s) {
      data.schema = s;
      return this;
    },
    run(f) {
      data.func = f;
      return this;
    },
    describe(d) {
      data.description = d;
      return this;
    },
    /** @internal */
    get __data() {
      return data;
    },
  };
}

export function createTools<T>(tools: { [K in keyof T]: CompletedTool }) {
  type Tool = (typeof tools)[keyof T];
  return {
    tools: Object.entries<Tool>(tools).map(([name, tool]) => {
      const { $schema, ...parameters } = zodToJsonSchema(tool.__data.schema);
      return {
        type: "function",
        function: { name, description: tool.__data.description, parameters },
      };
    }),
    async processActions(data: OpenAI.Beta.Threads.Runs.RequiredActionFunctionToolCall[] = []) {
      const results = await Promise.all(
        data.map(async ({ function: { arguments: args, name }, id }, i) => {
          const tool = tools[name as keyof T];

          const input = await tool.__data.schema.parseAsync(JSON.parse(args));
          const response = await tool.__data.func(input);

          return {
            tool_call_id: id,
            output: JSON.stringify(response),
          } satisfies OpenAI.Beta.Threads.Runs.RunSubmitToolOutputsParams.ToolOutput;
        })
      );

      return results;
    },
  };
}
