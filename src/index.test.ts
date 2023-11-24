import { describe, expect, expectTypeOf, it } from "vitest";
import { ZodError, z } from "zod";
import { combineTools, createTools, t } from "./index.js";

describe("t", () => {
  it("should return a valid empty json schema", () => {
    const emptySchema = t.run(() => {})._parameters;
    expect(emptySchema).toEqual({
      type: "object",
      properties: {},
    });
  });
  it("should return a valid schema for a complex input", () => {
    const complexSchema = t.input(
      z.object({
        name: z.coerce.date().default(() => new Date()),
        address: z.object({
          street: z.string().optional(),
          city: z.string(),
        }),
      }),
    );

    expect(complexSchema._parameters).toEqual({
      type: "object",
      properties: {
        name: {
          type: "string",
          format: "date-time",
          default: expect.any(Object),
        },
        address: {
          type: "object",
          properties: {
            street: {
              type: "string",
            },
            city: {
              type: "string",
            },
          },
          required: ["city"],
        },
      },
      required: ["address"],
    });
  });
});

describe("t - types", () => {
  it("should only allow one input", () => {
    const toolWithInput = t.input(z.object({ name: z.string() }));
    expectTypeOf(toolWithInput).not.toMatchTypeOf<{ input: any }>();
  });
  it("should only allow one run", () => {
    const toolWithRun = t.run(() => {});
    expectTypeOf(toolWithRun).not.toMatchTypeOf<{ run: any }>();
  });
  it("should only allow one description", () => {
    const toolWithDescribe = t.describe("hello");
    expectTypeOf(toolWithDescribe).not.toMatchTypeOf<{ describe: any }>();
  });
  it("should only allow input to be defined before run", () => {
    const toolWithRun = t.run(() => {});

    const toolWithInputAndRun = t
      .input(z.object({ name: z.string() }))
      .run(({ name }) => ({ name }));

    expectTypeOf(toolWithRun).not.toMatchTypeOf<{ input: any }>();
    expectTypeOf(toolWithInputAndRun).not.toMatchTypeOf<{ input: any }>();
  });
});

describe("createTools()", () => {
  it("should return an empty array if no tools are passed", () => {
    const { tools } = createTools({});
    expect(tools).toEqual([]);
  });
  it("should return an array of tools if tools are passed", () => {
    const { tools } = createTools({
      test: t.run(() => {}).describe("hello"),
    });
    expect(tools).toEqual([
      {
        type: "function",
        function: {
          description: "hello",
          name: "test",
          parameters: {
            type: "object",
            properties: {},
          },
        },
      },
    ]);
  });
});

describe("createTools() - types", () => {
  it("should only allow tools to be created when a run function has been added", () => {
    createTools({
      // @ts-expect-error
      test: t.input(z.object({ name: z.string() })),
      testWithRun: t.input(z.object({ name: z.string() })).run(() => {}),
    });
  })
});

describe("combineTools()", () => {
  it("should return an empty array if no tools are passed", () => {
    const tools = combineTools();
    expect(tools).toEqual({
      processChatActions: expect.any(Function),
      processAssistantActions: expect.any(Function),
      tools: [],
    });
  });
  it("should combine tools if tools are passed", () => {
    const tools = combineTools(
      createTools({
        tool: t.run(() => {}).describe("hello"),
      }),
      createTools({
        anotherTool: t.run(() => {}).describe("world"),
      }),
    );
    expect(tools).toEqual({
      processChatActions: expect.any(Function),
      processAssistantActions: expect.any(Function),
      tools: [
        {
          type: "function",
          function: {
            description: "hello",
            name: "tool",
            parameters: {
              type: "object",
              properties: {},
            },
          },
        },
        {
          type: "function",
          function: {
            description: "world",
            name: "anotherTool",
            parameters: {
              type: "object",
              properties: {},
            },
          },
        },
      ],
    });
  });
  it("should combine openai tools correctly too", () => {
    const combinedTools = combineTools(
      { type: "code_interpreter" },
      { type: "retrieval" },
    );
    expect(combinedTools).toEqual({
      processChatActions: expect.any(Function),
      processAssistantActions: expect.any(Function),
      tools: [
        {
          type: "code_interpreter",
        },
        {
          type: "retrieval",
        },
      ],
    });
  });
});

describe("processChatActions()", () => {
  it("should return an empty array if no tools are passed", async () => {
    const { processChatActions } = combineTools();
    const results = await processChatActions();
    expect(results).toEqual([]);
  });
  it("should return a valid chat tool message for a simple tool", async () => {
    const { processChatActions } = createTools({
      example: t
        .input(z.object({ text: z.string() }))
        .run(({ text }) => `Hello ${text}`),
    });
    const response = await processChatActions([
      {
        id: "test",
        function: {
          arguments: '{"text": "world"}',
          name: "example",
        },
        type: "function",
      },
    ]);
    expect(response).toEqual([
      {
        // Because it's stringified, it's a nested string
        content: '"Hello world"',
        role: "tool",
        tool_call_id: "test",
      },
    ]);
  });
  it("should work for an async tool", async () => {
    const { processChatActions } = createTools({
      example: t
        .input(z.object({ text: z.string() }))
        .run(({ text }) => Promise.resolve(`Hello ${text}`)),
    });
    const response = await processChatActions([
      {
        id: "test",
        function: {
          arguments: '{"text": "world"}',
          name: "example",
        },
        type: "function",
      },
    ]);
    expect(response).toEqual([
      {
        // Because it's stringified, it's a nested string
        content: '"Hello world"',
        role: "tool",
        tool_call_id: "test",
      },
    ]);
  });
  it("should pass the error back if the tool fails", async () => {
    const { processChatActions } = createTools({
      example: t.input(z.object({ text: z.string() })).run(({ text }) => {
        throw new Error(`Hello ${text}`);
      }),
    });
    const response = await processChatActions([
      {
        id: "test",
        function: {
          arguments: '{"text": "world"}',
          name: "example",
        },
        type: "function",
      },
    ]);
    expect(response).toEqual([
      {
        content: '{"error":"Hello world"}',
        role: "tool",
        tool_call_id: "test",
      },
    ]);
  });
  it("should pass the error to the onError handler if one is passed", async () => {
    const { processChatActions } = createTools(
      {
        example: t.input(z.object({ text: z.string() })).run(({ text }) => {
          throw new Error(`Hello ${text}`);
        }),
      },
      error => {
        expect(error).toBeInstanceOf(Error);
        if (!(error instanceof Error)) throw new Error("Expected error");
        return { moreData: `Hello ${error.message}` };
      },
    );
    const response = await processChatActions([
      {
        id: "test",
        function: {
          arguments: '{"text": "world"}',
          name: "example",
        },
        type: "function",
      },
    ]);
    expect(response).toEqual([
      {
        content: '{"error":{"moreData":"Hello Hello world"}}',
        role: "tool",
        tool_call_id: "test",
      },
    ]);
  });
  it("should pass zod validation errors to the onError handler if one is passed", async () => {
    const { processChatActions } = createTools(
      {
        example: t.input(z.object({ text: z.string() })).run(({ text }) => {
          throw new Error(`Hello ${text}`);
        }),
      },
      error => {
        expect(error).toBeInstanceOf(ZodError);
        return undefined;
      },
    );
    const response = await processChatActions([
      {
        id: "test",
        function: {
          arguments: '{"text": 123}',
          name: "example",
        },
        type: "function",
      },
    ]);
    expect(response).toEqual([
      {
        content: expect.stringContaining("Expected string, received number"),
        role: "tool",
        tool_call_id: "test",
      },
    ]);
  });
});

// Mostly uses the same code as processChatActions, so we don't need to test everything again
describe("processAssistantActions()", () => {
  it("should return an empty array if no tools are passed", async () => {
    const { processAssistantActions } = combineTools();
    const results = await processAssistantActions();
    expect(results).toEqual([]);
  });
  it("should return a valid assistant tool message for a simple tool", async () => {
    const { processAssistantActions } = createTools({
      example: t
        .input(z.object({ text: z.string() }))
        .run(({ text }) => `Hello ${text}`),
    });
    const response = await processAssistantActions([
      {
        id: "test",
        function: {
          arguments: '{"text": "world"}',
          name: "example",
        },
        type: "function",
      },
    ]);
    expect(response).toEqual([
      {
        output: '"Hello world"',
        tool_call_id: "test",
      },
    ]);
  });
});
