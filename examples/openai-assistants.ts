/* 
This is a more complex example that uses the OpenAI Assistants API (Beta) to create a chatbot.
It also enables the code_interpreter tool provided by OpenAI.
*/

import OpenAI from "openai";
import { createInterface } from "readline";
import { combineTools, createTools, tool } from "../src";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const { tools, processActions } = combineTools(
  createTools({
    getRandomNumber: tool().run(() => Math.floor(Math.random() * 100)),
  }),
  { type: "code_interpreter" },
);

const assistantData: OpenAI.Beta.AssistantUpdateParams &
  OpenAI.Beta.AssistantCreateParams = {
  model: "gpt-4-1106-preview",
  tools,
};

let assistant: OpenAI.Beta.Assistant;

if (process.env.OPENAI_ASSISTANT_ID) {
  assistant = await openai.beta.assistants.update(
    process.env.OPENAI_ASSISTANT_ID,
    assistantData,
  );
} else {
  assistant = await openai.beta.assistants.create(assistantData);
  console.log("Created a new assistant with id:", assistant.id);
  console.log(`Set the environment variable OPENAI_ASSISTANT_ID=${assistant.id} to reuse it.`);
}

async function processThread(run: OpenAI.Beta.Threads.Runs.Run) {
  switch (run.status) {
    case "completed":
      const messages = await openai.beta.threads.messages.list(run.thread_id);
      return messages;
    case "in_progress":
    case "queued":
      await new Promise(resolve => setTimeout(resolve, 1000));
      break;
    case "requires_action":
      const tool_outputs = await processActions(
        run.required_action?.submit_tool_outputs.tool_calls,
      );
      await openai.beta.threads.runs.submitToolOutputs(run.thread_id, run.id, {
        tool_outputs,
      });
  }
  return processThread(
    await openai.beta.threads.runs.retrieve(run.thread_id, run.id),
  );
}

const thread = await openai.beta.threads.create();
for await (const content of createInterface({ input: process.stdin })) {
  await openai.beta.threads.messages.create(thread.id, {
    role: "user",
    content,
  });

  const run = await openai.beta.threads.runs.create(thread.id, {
    assistant_id: assistant.id,
  });

  const messages = await processThread(run);
  const finalMessageContent = messages.data[0].content[0];
  if (finalMessageContent.type === "text") {
    console.log(finalMessageContent.text.value);
  } else {
    console.log(finalMessageContent.image_file.file_id);
  }
}
