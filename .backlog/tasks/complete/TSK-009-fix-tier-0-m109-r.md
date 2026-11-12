---
id: TSK-009
title: Fix: Tier 0 M109 R turns the hotend off on Klipper firmware
status: complete
priority: P2
tags: []
created: 2026-10-30
source: report/RPT-002
depends-on: []
completed: 2026-11-12
started: 2026-11-12
---

# Fix: Tier 0 M109 R turns the hotend off on Klipper firmware

## Description

On stock Klipper, `M109 R<t>` sets the hotend target to 0 °C and does not wait, because Klipper reads only `S` (default 0). Tier 0 always uses `M109 R`, so every transformed file turns the heater off before the first layer. Klipper then stops with "Extrude below minimum temp". The UI and docs claim Klipper support. Evidence and citations: RPT-002.

## Acceptance Criteria

- [x] A new ADR supersedes the Klipper line of ADR-0010 before any code change — evidence: docs/adr/0012-klipper-waits-with-m109-s.md supersedes the Klipper line of ADR-0010, verified against Klipper heaters.py/extruder.py at 0cee841e (2026-11-12)
- [x] Output for Klipper firmware never sends a temperature command that the Klipper source reads as target 0 (tier 0 and waiting tiers) — evidence: gcode_flavor=klipper selects M109 S for every waiting tier, M104 S otherwise; property tests assert no R under Klipper; processGcode tests for plain and binary metadata (2026-11-12)
- [x] Marlin and Prusa output still waits for cooling at waiting tiers, as ADR-0010 requires — evidence: Marlin dialect unchanged; all non-Klipper goldens byte-identical (2026-11-12)
- [x] A fixture with gcode_flavor klipper has a golden output that shows the Klipper-safe tier commands — evidence: fixtures/prusaslicer/klipper-labels.golden.gcode: M109 S230 ; [temptower] tier 0 (2026-11-12)
- [x] The firmware support claims in apps/web/src/main.ts, README.md and docs/overview.md match the new behaviour — evidence: main.ts support note, README.md status, docs/overview.md scope and compatibility updated (2026-11-12)

## Notes

## Learnings

## Progress Log

- [2026-10-30] Created
- [2026-11-12] ADR-0012: temperature dialect from gcode_flavor; Klipper waits with M109 S. Residual risk: Klipper printers with a Marlin flavor still get M109 R; UI tells users to set the flavor
- [2026-11-12] Completed