# zod-to-openai-tool

Create tools from zod schemas to use with OpenAI Assistants

## Usage

```ts
import { tool, createTools } from 'zod-to-openai-tool';

const { tools, processActions } = createTools({
  getWeather: tool()
    .input(z.object({ city }))
    .describe('Get the weather in a city')
    .run(({ city }) => `The weather in ${city} is sunny`),
});

const assistant = await openai.beta.assistants.create({
  tools,
  // ...
});

// Then, when the assistant uses the tools and responds with `requires_action`:
const actions = run.required_action.submit_tool_outputs.tool_calls;
const tool_outputs = processActions(actions);
await openai.beta.threads.runs.submitToolOutputs(thread.id, run.id, { tool_outputs });
```

See the JSDoc for more information and usage. This package exports the following functions:
 - `tool()`
 - `createTools(tools)`

## Installation

`npm install zod-to-openai-tool`

## Tools

A tool is created using the tool() function. They can then have the following properties added:
 - `input` - The input to the function (optional). This needs to be an object (`z.object({})`)
 - `describe` - A description of the function (optional)
 - `run` - The function to run using the input

You'll need to define the input first in order for it to be inferred all the way when using the function.
