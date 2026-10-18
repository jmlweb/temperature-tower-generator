---
id: TSK-002
title: User transforms PrusaSlicer G-code with a manually entered config
status: complete
priority: P2
tags: [core, web, skeleton]
created: 2026-10-18
completed: 2026-10-18
source: kickstart
depends-on: [TSK-001]
---

# User transforms PrusaSlicer G-code with a manually entered config

## Description

**Outcome:** walking skeleton: a user uploads PrusaSlicer G-code, enters the tower config by hand, and downloads `_temptower` G-code with per-tier temperatures.
**Validates:** none
**Implements:** ADR-0001, ADR-0002, ADR-0003

## Acceptance Criteria

- [x] pnpm workspace, build, test and fixture commands defined in AGENTS.md
- [x] Parsing and transform run in a Web Worker and packages/core imports no DOM API
- [x] Tier M104 commands inserted at the first layer of each tier and conflicting M104 or M109 lines neutralized
- [x] Property test proves untouched input lines are byte-identical in the output

## Notes

Evidence per acceptance criterion:
- pnpm workspace with `dev`, `build`, `test`, `typecheck`, `fixture` and `slice-fixtures` commands documented in AGENTS.md Commands.
- `apps/web/src/workers/gcode.worker.ts` runs parse and transform; `packages/core/test/no-dom.test.ts` and `packages/core/tsconfig.json` (lib ES2022 only) keep core DOM-free.
- `packages/core/src/transform.ts` inserts `M104 S<t> ; [temptower] tier <i>` before the first extruding move of each tier layer and prefixes conflicting M104/M109 lines (`transform.test.ts`, `multi-tool.golden.gcode`).
- Property test in `packages/core/src/transform.test.ts` (fast-check) recovers the input byte-for-byte from the output after removing the three change kinds.

## Learnings

## Progress Log

- [2026-10-18] Created
- [2026-10-18] Implemented in the `worktree-mvp` branch as part of the MVP build; all suites green (`pnpm test`, `pnpm typecheck`, `pnpm build`).
