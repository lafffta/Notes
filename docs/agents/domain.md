# Domain Docs

This file defines how engineering skills consume the repository's domain documentation while exploring the codebase.

## Before exploring, read these

- `CONTEXT.md` at the repository root.
- `CONTEXT-MAP.md` at the repository root if it exists; it points to the relevant context-specific `CONTEXT.md` files.
- ADRs under `docs/adr/` that affect the area being changed.

If these files do not exist, proceed silently. Do not create them pre-emptively. `/domain-modeling`, reached through flows such as `/grill-with-docs` and `/improve-codebase-architecture`, creates them lazily when terminology or decisions are resolved.

## File structure

This repository uses the single-context layout:

```text
/
├── CONTEXT.md
├── docs/
│   └── adr/
└── src/
```

## Use the glossary's vocabulary

When output names a domain concept—in an issue title, refactor proposal, hypothesis, or test name—use the term defined in `CONTEXT.md`. Do not drift to synonyms the glossary explicitly avoids.

If a needed concept is absent, reconsider whether the new term is necessary or note the genuine gap for `/domain-modeling`.

## Flag ADR conflicts

If proposed work contradicts an existing ADR, surface the conflict explicitly rather than silently overriding the recorded decision.
