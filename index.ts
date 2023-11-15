import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { OpenAI } from "openai";

interface Steps<T = void, Omitted extends string = never> {
  input<S extends z.ZodType<any, any>>(schema: S): Omit<Steps<z.infer<S>, Omitted | "input">, "input" | Omitted>;
  run(func: (input: T extends void ? never : T) => unknown): Omit<Steps<T, Omitted | "run">, "run" | "input" | Omitted> & CompletedTool;
  describe(description: string): Omit<Steps<T, Omitted | "describe">, Omitted | "describe">;
}


interface Data {
  func: (input: any) => unknown;
  schema: z.ZodType<any, any>;
  description: string | undefined;
}

interface CompletedTool {
  __getData(): Data;
}

function tool<T = void>(): Steps<T> & CompletedTool {
  let schema: z.ZodType<any, any>;
  let description: string | undefined;
  let func: (input: T extends void ? never : T) => unknown;

  return {
    input(s) {
      schema = s;
      return this;
    },
    run(f) {
      func = f;
      return this;
    },
    describe(d) {
      description = d;
      return this;
    },
    /** @internal */
    __getData() {
      return { schema, func, description };
    },
  };
}

export function tools<T>(t: { [K in keyof T]: CompletedTool }) {
  type Tool = (typeof t)[keyof T];
  return Object.entries<Tool>(t).map(([name, tool]) => {
    const jsonSchema = zodToJsonSchema(tool.__getData().schema);
    return { name, description: tool.__getData().description, parameters: jsonSchema };
  });
}

const thing = tool()
  .input(z.string())
  .describe("Converts input to uppercase")
  .run(input => input.toUpperCase());

console.log(
  tools({
    getWeather: tool()
      .input(z.string())
      .describe("Gets the weather")
      .run(async city => {
        return {
          weather: "sunny",
          city,
        };
      }),
  })
);
