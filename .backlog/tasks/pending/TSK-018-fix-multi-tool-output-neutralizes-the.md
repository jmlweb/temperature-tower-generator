---
id: TSK-018
title: Fix: Multi-tool output neutralizes the inactive tool's heat command, so it prints cold while the warning says only the active tool changes
status: pending
priority: P4
tags: []
created: 2026-11-20
source: report/RPT-011
depends-on: []
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

- [ ] A decision is recorded: either inactive-tool M104/M109 T<n> lines after tier 0 are kept (new ADR amending ADR-0002) or the multi-tool warning and ADR-0004 text describe that all tools are neutralized
- [ ] The multi-tool warning text in packages/core/src/validation.ts matches what the transform does
- [ ] The multi-tool fixture golden no longer shows a tool extruding before any heat command reaches it, or its report states that this can happen
- [ ] pnpm test and pnpm typecheck pass

## Notes

## Learnings

## Progress Log

- [2026-11-20] Created