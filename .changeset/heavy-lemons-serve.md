---
"zod-to-openai-tool": minor
---

Possibly Breaking Change: No longer removes additionalProperties from the schema, as that is handled correctly in the openai api itself now and doesn't seem to affect token counts anymore
