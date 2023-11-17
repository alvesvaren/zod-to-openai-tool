import { it } from "vitest";
import { describe } from "vitest";
import { expect } from "vitest";
import { tool, createTools } from "./index";
import { z } from "zod";
import { expectTypeOf } from "vitest";

describe("tool()", () => {
  it("should return a valid empty json schema", () => {
    const emptySchema = tool()._parameters;
    expect(emptySchema).toEqual({
      type: "object",
      properties: {},
    });
  });
  it("should return a valid schema for a complex input", () => {
    const complexSchema = tool().input(
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

describe("tool() - types", () => {
  it("should only allow one input", () => {
    const toolWithInput = tool().input(z.object({ name: z.string() }));

    expectTypeOf(toolWithInput).not.toMatchTypeOf<{ input: any }>();
  });
  it("should only allow one run", () => {
    const toolWithRun = tool().run(() => {});

    expectTypeOf(toolWithRun).not.toMatchTypeOf<{ run: any }>();
  });
  it("should only allow one description", () => {
    const toolWithDescribe = tool().describe("hello");

    expectTypeOf(toolWithDescribe).not.toMatchTypeOf<{ describe: any }>();
  });
  it("should only allow input to be defined before run", () => {
    const toolWithRun = tool().run(() => {});

    const toolWithInputAndRun = tool()
      .input(z.object({ name: z.string() }))
      .run(() => {});

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
      test: tool()
        .run(() => {})
        .describe("hello"),
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
