---
id: TSK-010
title: Fix: No warning when Custom tiers fall below the cold-extrusion limit
status: complete
priority: P4
tags: []
created: 2026-10-30
source: report/RPT-003
depends-on: []
completed: 2026-11-12
started: 2026-11-12
---

# Fix: No warning when Custom tiers fall below the cold-extrusion limit

## Description

A Custom tower such as 160 to 100 °C passes `validateTowerConfig` with no warning, because `temperaturesOutsidePreset` skips Custom and only an upper limit exists (ADR-0011). Tiers below the firmware's minimum extrusion temperature (Klipper default 170 °C) stop the print. Evidence and reproduction: RPT-003.

## Acceptance Criteria

- [x] A new ADR amends the ADR-0004 warning list with a check for tiers below the cold-extrusion limit, and names the limit value and its source — evidence: docs/adr/0014-warn-below-cold-extrusion-limit.md: 175 °C, highest stock default (Prusa MK3S fw 3.14.1 EXTRUDE_MINTEMP 175; Klipper, Marlin 2.1.2.5, Buddy MK4 170) (2026-11-12)
- [x] Validation emits that warning with the offending temperatures, and the download stays reachable — evidence: validation emits temperature-below-cold-extrusion-limit warning with the temperatures; canDownload true (2026-11-12)
- [x] The config form preview shows the same warning — evidence: config-form preview warning tooCold (2026-11-12)
- [x] A fixture triggers the new warning — evidence: fixtures/prusaslicer/temperature-below-cold-extrusion-limit (2026-11-12)

## Notes

## Learnings

## Progress Log

- [2026-10-30] Created
- [2026-11-12] ADR-0014 cold-extrusion warning at 175 °C
- [2026-11-12] Completed