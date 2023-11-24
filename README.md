# zod-to-openai-tool

![npm](https://img.shields.io/npm/v/zod-to-openai-tool)
![npm](https://img.shields.io/npm/dw/zod-to-openai-tool)


Easily create tools from zod schemas to use with OpenAI Assistants and Chat Completions.

## Usage

```ts
import { t, createTools } from "zod-to-openai-tool";

const { t, processAssistantActions } = createTools({
  getWeather: t
    .input(z.object({ city: z.string() }))
    .describe("Get the weather in a city")
    .run(({ city }) => `The weather in ${city} is sunny`),
});

const assistant = await openai.beta.assistants.create({
  tools,
  // ...
});

// Then, when the assistant uses the tools and responds with `requires_action`:
const actions = run.required_action.submit_tool_outputs.tool_calls;
const tool_outputs = processAssistantActions(actions);
await openai.beta.threads.runs.submitToolOutputs(thread.id, run.id, {
  tool_outputs,
});
```

> See the examples folder and the JSDocs for more examples and information. 

This package exports the following functions:

- `t` - Used to create a new tool
- `createTools(tools)` - Used to convert tools to the openai format (and give them a name)
- `combineTools(...tools)` - Used to combine multiple tools into one (including Code Interpreter and Retrieval)

## Installation

`npm install zod-to-openai-tool`

## Tools

A tool is created using the t object. They can then have the following properties added:

- `input` - The input to the function (optional). This needs to be an object (`z.object({})`)
- `describe` - A description of the function (optional)
- `run` - The function to run using the input (required)

You'll need to define the input first in order for it to be inferred all the way when using the function.
