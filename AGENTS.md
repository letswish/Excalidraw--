# Agent Instructions

## Scope

These instructions apply to the entire repository.

## Upstream Excalidraw Compatibility

- For every code change categorized as `feat` or `refactor`, evaluate whether the change can affect compatibility when the upstream `@excalidraw/excalidraw` package or main branch changes.
- Prefer integration approaches that are easy to compare against future upstream Excalidraw updates. Keep local customization boundaries explicit and avoid mixing unrelated upstream and local behavior in the same change.
- When changing code that wraps, imports, configures, patches, or depends on Excalidraw behavior, record the local change clearly enough that a future maintainer can quickly reapply or revise it after upgrading Excalidraw.
- Each recorded change should include:
  - The affected file or module.
  - The reason for the change.
  - The Excalidraw API, component, behavior, style, or data shape involved.
  - Any known compatibility risk with future Excalidraw versions.
  - The verification performed.
- If a task is specifically to adapt this repository to the latest Excalidraw update, first consult the existing local change records, then use them as the checklist for compatibility fixes.
- Do not remove or obscure historical compatibility notes unless the corresponding local customization has been deleted or fully replaced.

## Change Recording

- Record code-change notes in a stable, searchable location near the change when the context is local and concise.
- For cross-cutting or Excalidraw-specific compatibility notes, prefer a dedicated changelog or compatibility document if one exists; otherwise create or extend `docs/excalidraw-compatibility.md`.
- Keep records factual and compact. They should help answer: "What did we change from upstream Excalidraw, and what must be checked when Excalidraw updates?"

## Working Rules

- Preserve user changes already present in the working tree.
- Keep edits scoped to the requested task.
- Run the most relevant available checks after code changes, and record any checks that could not be run.
