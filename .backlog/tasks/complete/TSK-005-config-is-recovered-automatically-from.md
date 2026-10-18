---
id: TSK-005
title: Config is recovered automatically from the uploaded G-code
status: complete
priority: P3
tags: [core, ux]
created: 2026-10-18
completed: 2026-10-18
source: kickstart
depends-on: [TSK-001, TSK-002, TSK-003]
---

# Config is recovered automatically from the uploaded G-code

## Description

**Outcome:** a user who slices the generated STL uploads the G-code and skips manual config entry.
**Validates:** none
**Implements:** ADR-0005

## Acceptance Criteria

- [x] Config read from the G-code filename when it keeps the STL base name
- [x] Fallback reads the config from the object-label comment name
- [x] Manual entry offered when both fail
- [x] All three recovery cases covered by tests

## Notes

Evidence per acceptance criterion:
- `recoverTowerConfig` in `packages/core/src/recover-config.ts` decodes the file name first (`recover-config.test.ts`).
- Falls back to object labels from `M486 A…`, `; printing object …` and `EXCLUDE_OBJECT_DEFINE NAME=…` (`slicers/prusaslicer.ts`).
- Returns null otherwise; `main.ts` then tells the user to check the form and keeps manual entry as the path.
- `packages/core/src/recover-config.test.ts` covers file name, object label (three marker styles) and neither.

## Learnings

## Progress Log

- [2026-10-18] Created
- [2026-10-18] Implemented in the `worktree-mvp` branch as part of the MVP build; all suites green (`pnpm test`, `pnpm typecheck`, `pnpm build`).
