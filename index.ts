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

export type Tool<T = void> = Steps<T> & CompletedTool;

/**
 * Creates a tool for use with openai assistants
 * @example
 * ```ts
 * const getWeather = tool()
 *   .input(
 *     z.object({
 *       city: z.string(),
 *      }))
 *   .describe("Gets the weather")
 *   .run(async ({ city }) => ({
 *     weather: "sunny",
 *   }));
 * ```
 * @returns A `Tool` that can be used with `createTools()`.
 */
export function tool<T = void>(): Tool<T> {
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

/**
 * 
 * @param tools An object containing tools created with `tool()`. Name them using the key.
 * @returns An object containing the tools and a function to process actions.
 * @example
 * ```ts
 * const { tools, processActions } = createTools({
 *   getWeather,  // These are created with `tool()`
 *   exponential,
 * });
 * 
 * // Then use them like this:
 * const assistant = await openai.beta.assistants.create({
 *   tools,
 *   //...
 * });
 * ```
 */
export function createTools<T>(tools: { [K in keyof T]: CompletedTool }) {
  type _Tool = (typeof tools)[keyof T];
  return {
    tools: Object.entries<_Tool>(tools).map(([name, tool]) => {
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
