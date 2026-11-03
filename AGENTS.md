# Agent Instructions

## Required Reading
- Read `docs/agent-handoff.md` before touching source files.
- Follow `docs/glyph-thread-implementation-spec.md` for the active typography-thread task.
- Follow `docs/visual-qa-playbook.md` before claiming visual completion.
- Treat `src/data/portfolio.ts` as the source of truth for professional facts.

## Package Manager
Use **npm** with the committed `package-lock.json`.

```bash
npm install
npm run dev
npm run check
npm run build
npm run test:e2e
```

## File-Scoped Commands
| Task | Command |
|---|---|
| Astro/type validation | `npm run check` |
| One Playwright test | `npx playwright test tests/portfolio.spec.ts -g "<test name>"` |
| One browser project | `npx playwright test tests/portfolio.spec.ts --project=desktop` |
| Inspect changed files | `git diff -- <path>` |

## Active Design Constraints
- Preserve Concept 03 / Spatial Aperture composition and verified portfolio copy.
- Use only `HerokeyVN` as the public identity.
- Keep the center Hero aperture empty for a future Three.js model; do not add Three.js now.
- Preserve semantic/selectable heading text; SVG glyph contours are decorative and `aria-hidden`.
- The red thread must trace every outlined glyph in `USERS DON'T SEE.`, not only `E`.
- Never route the thread over body copy, navigation, links, buttons, or project content.
- Preserve native scrolling, reduced-motion behavior, and no-JavaScript content.

## Implementation Boundaries
- Do not redesign unrelated sections while fixing the glyph thread.
- Do not replace manual art direction with a generic routing algorithm.
- Do not weaken visual or geometry tests to hide a production defect.
- Do not modify professional facts, add invented metrics, push, deploy, or change Pages settings.
- Preserve unrelated user changes in the dirty worktree.

## Definition of Done
- `npm run check`, `npm run build`, and desktop/mobile Playwright tests pass.
- Visual review covers 1440×900 and 390×844 at before/entry/mid/exit/after states.
- Reverse scroll, direct anchor navigation, resize, and reduced motion are verified.
- Update the handoff and screenshot README with evidence and remaining risks.

## Commit Attribution
AI commits DON'T and NEVER include:

```text
Co-Authored-By: (the agent model's name and attribution byline)
```
