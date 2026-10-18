---
id: TSK-004
title: User reviews a change report before download
status: complete
priority: P2
tags: [validation, web]
created: 2026-10-18
completed: 2026-10-18
source: kickstart
depends-on: [TSK-001, TSK-002]
---

# User reviews a change report before download

## Description

**Outcome:** before downloading, a user sees the detected slicer, base temperature source, warnings, a temperature-vs-Z chart and every inserted and neutralized command; errors block the download.
**Validates:** none
**Implements:** ADR-0004

## Acceptance Criteria

- [x] Every ADR-0004 error and warning check has a fixture that triggers it
- [x] Error fixtures produce no output file and block the download
- [x] Download control appears only after the report renders, with temperature-vs-Z chart and inserted and neutralized commands
- [x] Output G-code starts with the temptower header block holding version, config and change summary

## Notes

Evidence per acceptance criterion:
- Fixtures per ADR-0004 code under `fixtures/prusaslicer/`: no-extrusion, variable-layer-height, multiple-objects, sequential-printing, binary-gcode, arc-moves, height-mismatch (errors); zhop-*_0.15 (height-off-by-one-layer), temperature-outside-preset, marker-mismatch, multi-tool (warnings).
- `fixtures/fixtures.test.ts` asserts error fixtures have `output === null`, `canDownload === false` and no golden file; the UI renders the download button only inside `showResult` after the report (`apps/web/src/main.ts`).
- Report view (`report-view.ts`, `chart.ts`) shows slicer, base temperature source, warnings, the SVG temperature-vs-Z chart and the inserted and neutralized lines.
- Every golden starts with the four-line `; [temptower]` header (version, encoded config, tiers, change summary); `fixtures.test.ts` asserts the prefix.

## Learnings

## Progress Log

- [2026-10-18] Created
- [2026-10-18] Implemented in the `worktree-mvp` branch as part of the MVP build; all suites green (`pnpm test`, `pnpm typecheck`, `pnpm build`).
