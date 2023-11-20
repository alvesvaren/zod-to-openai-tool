import { z } from "zod";
import { tool, createTools } from "../src";
import { inspect } from "util";

const fullPrint = (msg: any) => console.log(inspect(msg, false, null, true));

const { tools, processActions } = createTools({
  getWeather: tool()
    .input(
      z.object({
        city: z.string(),
        date: z.coerce.date().default(() => new Date()),
      }),
    )
    .describe("Gets the weather")
    .run(async ({ city, date }) => ({
      city,
      date,
      weather: "sunny",
    })),

  exponential: tool()
    .input(z.object({ n: z.number() }))
    .describe("Exponentiates a number")
    .run(async ({ n }) => Math.exp(n)),

  helloWorld: tool().run(() => "Hello, world!"),
});

fullPrint(tools);

console.log("--------");

const resp = await processActions([
  {
    function: {
      arguments: JSON.stringify({ city: "San Francisco", date: "2021-01-01" }),
      name: "getWeather",
    },
    id: "1",
    type: "function",
  },
]);

console.log(resp);
