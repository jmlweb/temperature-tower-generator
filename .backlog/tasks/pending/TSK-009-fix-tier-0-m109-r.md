---
id: TSK-009
title: Fix: Tier 0 M109 R turns the hotend off on Klipper firmware
status: pending
priority: P2
tags: []
created: 2026-10-30
source: report/RPT-002
depends-on: []
---

# Fix: Tier 0 M109 R turns the hotend off on Klipper firmware

## Description

On stock Klipper, `M109 R<t>` sets the hotend target to 0 °C and does not wait, because Klipper reads only `S` (default 0). Tier 0 always uses `M109 R`, so every transformed file turns the heater off before the first layer. Klipper then stops with "Extrude below minimum temp". The UI and docs claim Klipper support. Evidence and citations: RPT-002.

## Acceptance Criteria

- [ ] A new ADR supersedes the Klipper line of ADR-0010 before any code change
- [ ] Output for Klipper firmware never sends a temperature command that the Klipper source reads as target 0 (tier 0 and waiting tiers)
- [ ] Marlin and Prusa output still waits for cooling at waiting tiers, as ADR-0010 requires
- [ ] A fixture with gcode_flavor klipper has a golden output that shows the Klipper-safe tier commands
- [ ] The firmware support claims in apps/web/src/main.ts, README.md and docs/overview.md match the new behaviour

## Notes

## Learnings

## Progress Log

- [2026-10-30] Created