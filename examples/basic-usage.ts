import { inspect } from "util";
import { z } from "zod";
import { createTools, t } from "../src";

const fullPrint = (msg: any) => console.log(inspect(msg, false, null, true));

const { tools, processAssistantActions } = createTools({
  getWeather: t
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

  exponential: t
    .input(z.object({ n: z.number() }))
    .describe("Exponentiates a number")
    .run(async ({ n }) => Math.exp(n)),

  helloWorld: t.run(() => "Hello, world!"),
});

fullPrint(tools);

console.log("--------");

const resp = await processAssistantActions([
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
