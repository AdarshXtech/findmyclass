# Repository Governance for Coding Agents

These rules apply to every coding session in this repository.

## Before changing code

1. Inspect the existing implementation and trace the real callers before editing.
2. Read `decisions.md` for relevant historical choices.
3. Read the relevant sections of `flow.md`; never assume an execution path that can be inspected.
4. Preserve unrelated local changes and avoid unnecessary dependencies.

## During implementation

1. Add a `decisions.md` entry for meaningful architecture, dependency, data-model, security, performance, deployment, API, or behavior decisions.
2. Explain why the chosen approach won and why alternatives were rejected.
3. Do not add decision entries for trivial formatting, spelling, comments, or obvious one-line fixes.
4. Mark replaced decisions as `Status: Superseded` and reference the replacement.
5. Update the affected execution and data flows in `flow.md` as soon as behavior changes.
6. Never put secrets, credentials, full phone numbers, or private student records in governance files.

## Before finishing

1. Add an entry to `## 6. AI Changes During Current Session` in `flow.md` for every coding session.
2. Record only files and functions the agent actually changed.
3. Record behavior changes, execution-flow changes, risks, tests run, and recommended manual tests.
4. Verify that documented paths, functions, and call chains exist in the current code.
5. For a significant change, conduct a 5-10 question developer knowledge check based only on that session's changes. Do not provide answers before the developer responds. The passing score is 80%; repeat missed concepts until the developer passes.

Documentation that no longer matches the code is a bug and must be fixed with the related change.
