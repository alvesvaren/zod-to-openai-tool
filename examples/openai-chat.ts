/* 
This is a simple example that uses the OpenAI Chat completions API to create a simple chatbot.

It uses the new tools api (instead of the old function calling api), so all models might not work.
*/

import OpenAI from "openai";
import { createInterface } from "readline";
import { createTools, tool } from "../src";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const { tools, processChatActions } = createTools({
  getRandomNumber: tool().run(() => Math.floor(Math.random() * 100)),
});

const messages: OpenAI.ChatCompletionMessageParam[] = [];
for await (const content of createInterface({ input: process.stdin })) {
  messages.push({
    role: "user",
    content,
  });

  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo-1106",
    messages,
    tools,
  });
  const message = completion.choices[0].message;
  messages.push(message);
  if (message.tool_calls) {
    const tool_outputs = await processChatActions(message.tool_calls);
    messages.push(...tool_outputs);
    const completion2 = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-1106",
      messages,
      tools,
    });
    messages.push(completion2.choices[0].message);
  }
  console.log(messages[messages.length - 1].content);
}
