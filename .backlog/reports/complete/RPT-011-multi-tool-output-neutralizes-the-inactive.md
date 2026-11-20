---
id: RPT-011
title: Multi-tool output neutralizes the inactive tool's heat command, so it prints cold while the warning says only the active tool changes
type: bug
severity: low
status: triaged
created: 2026-11-20
triaged: 2026-11-20
task-id: TSK-018
---

## Summary

The `multi-tool` warning (ADR-0004) tells the user that "only the active tool's temperature is changed". The transform does more than that. It neutralizes every `M104`/`M109` after the tier 0 command, whatever its `T` word. That includes the heat command of a tool that is not active yet. The tier commands carry no `T` word, so they only reach the tool that is active at each tier start. A tool selected mid-print can therefore extrude before anything heats it, and the download is still offered because `multi-tool` is only a warning.

## Where

- `packages/core/src/transform.ts:140-143` — the neutralize loop ignores `temperatureLine.tool`; any non-turn-off line after the tier 0 line is neutralized.
- `packages/core/src/transform.ts:94` — tier commands are `M109 R<t>` / `M104 S<t>` with no `T`, so they target the active tool only.
- `packages/core/src/validation.ts:173` — warning text: `only the active tool's temperature is changed`.
- `docs/adr/0004-validation-gate-and-change-report.md:11` — "multi-tool G-code (only the active tool is changed)".
- `fixtures/prusaslicer/multi-tool.golden.gcode:7-8,290-301` — committed golden output showing the effect.

## Observed output

`fixtures/prusaslicer/multi-tool.golden.gcode` (written by `pnpm fixture`, passes `pnpm test`):

```
7:   M104 S215 ; set extruder temp          <- start G-code heats the active tool (T0) only
8:   M109 S215 ; wait for extruder temp
16:  T0
18:  M109 R230 ; [temptower] tier 0
...
290: T1
291: ; [temptower] neutralized: M104 S230 T1   <- T1's only heat command is removed
292: G1 X100 Y100 F9000
293: G1 X120 Y100 E1 F1200                    <- T1 extrudes the whole Z7 layer unheated
...
301: M104 S225 ; [temptower] tier 1           <- first temperature T1 receives, one layer later
```

The report for this fixture (`multi-tool.report.json`) has only the `multi-tool` warning, and `canDownload` is true. On Marlin and Prusa firmware, cold-extrusion protection blocks or skips the T1 moves. The user was told that only the active tool would be changed.

## Impact

Low. Multi-tool towers are uncommon in Phase 1, and the fixture is synthetic. Real Prusa XL start G-code usually heats every used tool before tier 0, and those lines are kept. But any tool heated after tier 0 (a later tool change, or a standby/preheat `M104 T<n>` before a tool change) loses that command. The warning text does not tell the user this happens.

## Suggested fix

Pick one of these:
- Keep `M104`/`M109` lines whose `T` word names a tool other than the active one. This needs a new ADR, because ADR-0002 lists tool-indexed variants as neutralized.
- Reword the `multi-tool` warning, and ADR-0004's description of it, to say that every tool's temperature commands after tier 0 are neutralized and that tiers reach only the active tool.
