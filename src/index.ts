import type { OpenAI } from "openai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
interface Steps<T = void, Omitted extends string = never> {
  /**
   * Adds a schema for the tool. This will be used to validate the input and to infer the type of the input in the `run()` function.
   * @param s The schema for the input. Must be a `z.object({})`
   * @returns A tool with the input schema set.
   */
  input<S extends z.AnyZodObject>(
    schema: S,
  ): Omit<Steps<z.infer<S>, Omitted | "input">, "input" | Omitted> &
    InternalTool;
  /**
   * The function to run when the model calls the tool. This is the only required builder step.
   * @param args The arguments for the `run()` function.
   *   The type of the arguments will be inferred from the input schema. If there is no input schema, the type will be `void`.
   * @returns A tool with the `run()` function set.
   */
  run(
    func: (input: T extends void ? never : T) => unknown,
  ): Omit<Steps<T, Omitted | "run">, "run" | "input" | Omitted> & InternalTool;
  /**
   * Adds a description to the tool. This will be provided to the model to aid in understanding the tool.
   * @param d The description of the tool as a string.
   *   It is good to explain what data the tool returns and what it does here.
   * @returns A tool with the description set.
   */
  describe(
    description: string,
  ): Omit<Steps<T, Omitted | "describe">, Omitted | "describe"> & InternalTool;
}

type CheckHasSetRun<T> = T extends { run: any } ? never : T;

interface Data {
  func: (input: any) => unknown;
  schema: z.AnyZodObject;
  description: string | undefined;
}

interface InternalTool {
  _data: Data;
  _parameters: OpenAI.Beta.FunctionTool["function"]["parameters"];
}

type OpenAIBuiltInTool = OpenAI.Beta.Assistant["tools"][number];

export type Tool<T = void, O extends string = never> = Steps<T, O> &
  InternalTool;

function tool<T = void>(): Tool<T> {
  const data: Data = {
    schema: z.object({}),
    func: () => {},
    description: undefined,
  };

  return {
    input<S extends z.AnyZodObject>(s: S) {
      data.schema = s;
      return this as Tool<z.infer<S>, "input">;
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
      return parameters;
    },
  };
}

/**
 * Creates a tool for use with openai assistants
 * @example
 * ```ts
 * const getWeather = t
 *   .input(
 *     z.object({
 *       city: z.string(),
 *      }))
 *   .describe("Gets the weather")
 *   .run(async ({ city }) => ({
 *     weather: "sunny",
 *   }));
 * ```
 */
export const t: Steps<void> & {
  /**
   * Alias to the `file_search` tool
   * @see https://platform.openai.com/docs/assistants/tools/knowledge-retrieval
   */
  fileSearch: OpenAI.Beta.FileSearchTool;
  /**
   * Alias to the `code_interpreter` tool
   * @see https://platform.openai.com/docs/assistants/tools/code-interpreter
   */
  codeInterpreter: OpenAI.Beta.CodeInterpreterTool;
} = {
  input<S extends z.AnyZodObject>(s: S) {
    return tool().input<S>(s);
  },
  run(...args: Parameters<Tool["run"]>) {
    return tool().run(...args);
  },
  describe(d: string) {
    return tool().describe(d);
  },
  codeInterpreter: { type: "code_interpreter" },
  fileSearch: { type: "file_search" },
};

/**
 *
 * @param tools An object containing tools created with `t.run()`. Name them using the key.
 * @param onError A function that will be called when a tool throws an error. The error will be passed as the first argument.
 *  If this function returns a value, that value will be used as the output of the tool.
 *  If you do not provide a function, the error will be stringified and sent to the assistant.
 *  If the function returns `undefined` or `null`, the error will be sent to the assistant.
 * @returns An object containing the tools and a function to process actions.
 * @example
 * ```ts
 * const { t, processAssistantActions, processChatActions } = createTools({
 *   getWeather,  // These are created with `t.run()` and `t.input()`, see the example for `t`
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
export function createTools<T>(
  tools: { [K in keyof T]: InternalTool & CheckHasSetRun<T[K]> },
  onError?: (error: unknown) => any,
) {
  type _Tool = (typeof tools)[keyof T];

  function _processActions(
    data: (OpenAI.Beta.Threads.Runs.RequiredActionFunctionToolCall &
      OpenAI.Chat.ChatCompletionMessageToolCall)[],
  ) {
    const results = Promise.all(
      data.map(async ({ function: { arguments: args, name }, id }, i) => {
        const tool = tools[name as keyof T];
        let output;
        try {
          const input = await tool._data.schema.parseAsync(JSON.parse(args));
          output = await tool._data.func(input);
        } catch (error) {
          error = onError?.(error) ?? error;
          if (error instanceof Error) {
            error = error.message;
          }
          output = { error };
        }
        return { id, output: JSON.stringify(output) };
      }),
    );
    return results;
  }

  return {
    tools: Object.entries<_Tool>(tools).map(
      ([name, tool]): OpenAI.Beta.FunctionTool &
        OpenAI.Chat.Completions.ChatCompletionTool => {
        const parameters = tool._parameters;
        return {
          type: "function",
          function: { name, description: tool._data.description, parameters },
        };
      },
    ),
    /**
     * Process the actions from the chat completion.
     * @param data The tool calls generated from the chat completion. (`message.tool_calls`)
     * @returns The message which should be sent with the messages to generate the result based on the tool calls
     */
    async processChatActions(
      data: OpenAI.Chat.ChatCompletionMessageToolCall[] = [],
    ) {
      return (await _processActions(data)).map(
        ({ id, output }) =>
          ({
            tool_call_id: id,
            role: "tool",
            content: output,
          }) as OpenAI.Chat.Completions.ChatCompletionToolMessageParam,
      );
    },
    /**
     * Process the actions from the assistant run.
     * @param data The tool calls generated from the assistant run. (`run.required_action.submit_tool_outputs.tool_calls`)
     * @returns The tool outputs which should be sent to `runs.submitToolOutputs()` to continue the run.
     */
    async processAssistantActions(
      data: OpenAI.Beta.Threads.Runs.RequiredActionFunctionToolCall[] = [],
    ) {
      return (await _processActions(data)).map(
        ({ id, output }) =>
          ({
            tool_call_id: id,
            output,
          }) as OpenAI.Beta.Threads.Runs.RunSubmitToolOutputsParams.ToolOutput,
      );
    },
  };
}

type CreateToolsOutput = ReturnType<typeof createTools>;
type AnyTool = ReturnType<typeof createTools> | OpenAIBuiltInTool;

/**
 * Combine multiple tools into one object that can be used with an assistant.
 * @param tools All tools to combine. You can provide tools created with `createTools()` or built in tools from the OpenAI API (CodeInterpreter and Retrieval).
 * @returns The same object as `createTools()`, but with all tools combined.
 * @see https://platform.openai.com/docs/assistants/tools - for more information on the OpenAI API tools.
 * @example
 * ```ts
 * const { tools, processAssistantActions } = combineTools(
 *   createTools({
 *     getWeather,
 *     exponential,
 *   }),
 *   { type: "code_interpreter" },
 *   { type: "retrieval" },
 * );
 * ```
 */
export function combineTools(...tools: AnyTool[]): Omit<
  CreateToolsOutput,
  "tools"
> & {
  tools: OpenAIBuiltInTool[];
} {
  const customTools = tools.filter(
    (t): t is Exclude<typeof t, OpenAIBuiltInTool> => "tools" in t,
  );

  const combinedCustomTools = {
    tools: customTools.flatMap(t => t.tools),
    async processChatActions(
      data: OpenAI.Chat.ChatCompletionMessageToolCall[] = [],
    ) {
      return (
        await Promise.all(customTools.map(t => t.processChatActions(data)))
      ).flat();
    },
    async processAssistantActions(
      data: OpenAI.Beta.Threads.Runs.RequiredActionFunctionToolCall[] = [],
    ) {
      return (
        await Promise.all(customTools.map(t => t.processAssistantActions(data)))
      ).flat();
    },
  };
  const builtInTools = tools.filter((t): t is OpenAIBuiltInTool => "type" in t);

  return {
    tools: [...combinedCustomTools.tools, ...builtInTools],
    processChatActions: combinedCustomTools.processChatActions,
    processAssistantActions: combinedCustomTools.processAssistantActions,
  };
}
