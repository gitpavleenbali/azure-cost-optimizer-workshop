---
name: "Test ACO Workshop"
description: "Run the participant workshop validation and focused runtime checks without Azure writes or model calls by default."
agent: "ACO Workshop Builder"
---
Run `npm run validate`. Summarize sanitization, contract parity, backend, frontend, Playwright, and Bicep results. If a runtime URL is provided, run read-only smoke checks. Do not refresh evidence or invoke a model unless I approve that exact action.
