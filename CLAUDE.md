# Claude Code Project Instructions

## CRITICAL: Token Conservation Rules

**DO NOT run more than 2 agents in parallel. EVER.**

- Prefer using direct tools (Grep, Glob, Read) over spawning agents for simple lookups.
- Only use the Agent tool when the task genuinely requires multi-step exploration that cannot be done with a single Grep/Glob/Read call.
- When agents ARE needed, run them **sequentially** unless there is a compelling reason to parallelize, and never exceed 2 concurrent agents.
- Use `model: "haiku"` for agents doing simple searches or lookups to save tokens.
- Keep agent prompts concise and focused — do not send large context dumps.
- Prefer the Explore subagent_type with "quick" thoroughness for codebase searches.

## General Guidelines

- This is a static HTML/CSS/JS web application (a middle school management tool / PWA).
- There is no build step, no bundler, no framework — just plain HTML files, CSS in `css/`, JS in `js/`, and data in `data/`.
- Changes should be made directly to the relevant HTML/JS/CSS files.
- Test changes by reviewing the code carefully; there is no test suite.
