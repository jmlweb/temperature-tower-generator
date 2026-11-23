---
id: TSK-018
title: Fix: Multi-tool output neutralizes the inactive tool's heat command, so it prints cold while the warning says only the active tool changes
status: complete
priority: P4
tags: []
created: 2026-11-20
source: report/RPT-011
depends-on: []
started: 2026-11-23
completed: 2026-11-23
---

# Fix: Multi-tool output neutralizes the inactive tool's heat command, so it prints cold while the warning says only the active tool changes

## Description

### Context

From RPT-011. The transform neutralizes every `M104`/`M109` after tier 0, including the heat command of a tool that is not active yet (`packages/core/src/transform.ts:140-143`). Tier commands carry no `T` word. In `fixtures/prusaslicer/multi-tool.golden.gcode:290-301`, T1 extrudes a full layer after its only heat command was neutralized. Meanwhile the warning (`packages/core/src/validation.ts:173`) says only the active tool's temperature is changed.

### Approach

1. Decide whether to keep tool-indexed lines for non-active tools. That needs a new ADR, because ADR-0002 neutralizes tool-indexed variants. The alternative is to reword the warning and ADR-0004.
2. Change the transform or the warning to match the decision.
3. Run `pnpm fixture` and review the multi-tool golden and report diff by hand.

## Acceptance Criteria

- [x] A decision is recorded: either inactive-tool M104/M109 T<n> lines after tier 0 are kept (new ADR amending ADR-0002) or the multi-tool warning and ADR-0004 text describe that all tools are neutralized
- [x] The multi-tool warning text in packages/core/src/validation.ts matches what the transform does
- [x] The multi-tool fixture golden no longer shows a tool extruding before any heat command reaches it, or its report states that this can happen
- [x] pnpm test and pnpm typecheck pass

## Notes

## Learnings

- LRN-007: Multi-tool warning text is snapshotted in the fixture report, not the golden
## Progress Log

- [2026-11-20] Created
- [2026-11-23] Started
- [2026-11-23] criterion 1 — evidence: chose to reword; docs/adr/0004 warning list now says every tool's M104/M109 after tier 0 is neutralized and tiers reach only the active tool (2026-11-23)
- [2026-11-23] criterion 2 — evidence: pnpm vitest run packages/core/src/validation.test.ts → new TSK-018 test failed before the change, passes after (2026-11-23)
- [2026-11-23] criterion 3 — evidence: pnpm fixture → multi-tool.report.json warning now states a tool heated after tier 0 can print cold; golden unchanged (2026-11-23)
- [2026-11-23] criterion 4 — evidence: pnpm test → 138 passed, 5 skipped; pnpm typecheck → exit 0 (2026-11-23)
- [2026-11-23] Completed