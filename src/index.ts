import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { OpenAI } from "openai";
import { deepRemoveKey } from "./utils.js";
interface Steps<T = void, Omitted extends string = never> {
  input<S extends z.ZodType<any, any>>(
    schema: S extends z.AnyZodObject ? S : never,
  ): Omit<Steps<z.infer<S>, Omitted | "input">, "input" | Omitted> &
    InternalTool;
  run(
    func: (input: T extends void ? never : T) => unknown,
  ): Omit<Steps<T, Omitted | "run">, "run" | "input" | Omitted> & InternalTool;
  describe(
    description: string,
  ): Omit<Steps<T, Omitted | "describe">, Omitted | "describe"> & InternalTool;
}

interface Data {
  func: (input: any) => unknown;
  schema: z.ZodType<any, any>;
  description: string | undefined;
}

interface InternalTool {
  _data: Data;
  _parameters: OpenAI.Beta.AssistantCreateParams.AssistantToolsFunction["function"]["parameters"];
}

type OpenAIBuiltInTool = OpenAI.Beta.Assistant["tools"][number];

export type Tool<T = void> = Steps<T> & InternalTool;

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
  const data: Data = {
    schema: z.object({}),
    func: () => {},
    description: undefined,
  };

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
    get _data() {
      return data;
    },
    /** @internal */
    get _parameters() {
      const { $schema, ...parameters } = zodToJsonSchema(data.schema);
      return deepRemoveKey(parameters, "additionalProperties");
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
export function createTools<T>(tools: { [K in keyof T]: InternalTool }) {
  type _Tool = (typeof tools)[keyof T];
  return {
    tools: Object.entries<_Tool>(tools).map(
      ([
        name,
        tool,
      ]): OpenAI.Beta.AssistantCreateParams.AssistantToolsFunction => {
        const parameters = tool._parameters;
        return {
          type: "function",
          function: { name, description: tool._data.description, parameters },
        };
      },
    ),
    async processActions(
      data: OpenAI.Beta.Threads.Runs.RequiredActionFunctionToolCall[] = [],
    ) {
      const results = await Promise.all(
        data.map(async ({ function: { arguments: args, name }, id }, i) => {
          const tool = tools[name as keyof T];

          const input = await tool._data.schema.parseAsync(JSON.parse(args));
          const response = await tool._data.func(input);

          return {
            tool_call_id: id,
            output: JSON.stringify(response),
          } satisfies OpenAI.Beta.Threads.Runs.RunSubmitToolOutputsParams.ToolOutput;
        }),
      );

      return results;
    },
  };
}

/**
 * Combine multiple tools into one object that can be used with an assistant.
 * @param tools All tools to combine. You can provide tools created with `createTools()` or built in tools from the OpenAI API (CodeInterpreter and Retrieval).
 * @returns The same object as `createTools()`, but with all tools combined.
 * @see https://platform.openai.com/docs/assistants/tools - for more information on the OpenAI API tools.
 * @example
 * ```ts
 * const tools = combineTools(
 *   createTools({
 *     getWeather,
 *     exponential,
 *   }),
 *   { type: "code_interpreter" },
 *   { type: "retrieval" },
 * );
 * ```
 */
export function combineTools(
  ...tools: (ReturnType<typeof createTools> | OpenAIBuiltInTool)[]
) {
  const customTools = tools.filter(
    (t): t is Exclude<typeof t, OpenAIBuiltInTool> => "tools" in t,
  );
  const combinedCustomTools = {
    tools: customTools.flatMap(t => t.tools),
    async processActions(
      data: OpenAI.Beta.Threads.Runs.RequiredActionFunctionToolCall[] = [],
    ) {
      const results = await Promise.all(
        customTools.map(t => t.processActions(data)),
      );

      return results.flat();
    },
  };
  const builtInTools = tools.filter((t): t is OpenAIBuiltInTool => "type" in t);

  return {
    tools: [...combinedCustomTools.tools, ...builtInTools],
    processActions: combinedCustomTools.processActions,
  };
}
