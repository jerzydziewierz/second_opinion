---
name: grey-so
description: Use it when the user asks to "ask gemini" or "ask codex"
allowed-tools: Read, Glob, Grep, mcp__grey-so__get_advice
---

When consulting with external LLMs:

**1. Gather Context First**:

- Use Glob/Grep to find relevant files
- Read key files to understand their relevance
- Select files directly related to the question

**2. Determine Model**:

- **Codex**: Use if user says "ask codex" → use model "gpt-5.3-codex"
- **Gemini**: Default for "ask gemini" → use model "gemini-3-pro-preview"

**3. Call the MCP Tool**: Use `mcp__grey-so__get_advice` with:

- `model`: "gemini-3-pro-preview" or "gpt-5.3-codex"
- `prompt`: Clear, neutral question without suggesting solutions
- `files`: Array of relevant file paths

**4. Present Results**: Summarize key insights, recommendations, and
considerations from the response.

**Critical Rules**:

- ALWAYS gather file context before consulting
- Ask neutral, open-ended questions to avoid bias
- Provide focused, relevant files (quality over quantity)
