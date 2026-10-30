---
id: TSK-010
title: Fix: No warning when Custom tiers fall below the cold-extrusion limit
status: pending
priority: P4
tags: []
created: 2026-10-30
source: report/RPT-003
depends-on: []
---

# Fix: No warning when Custom tiers fall below the cold-extrusion limit

## Description

A Custom tower such as 160 to 100 °C passes `validateTowerConfig` with no warning, because `temperaturesOutsidePreset` skips Custom and only an upper limit exists (ADR-0011). Tiers below the firmware's minimum extrusion temperature (Klipper default 170 °C) stop the print. Evidence and reproduction: RPT-003.

## Acceptance Criteria

- [ ] A new ADR amends the ADR-0004 warning list with a check for tiers below the cold-extrusion limit, and names the limit value and its source
- [ ] Validation emits that warning with the offending temperatures, and the download stays reachable
- [ ] The config form preview shows the same warning
- [ ] A fixture triggers the new warning

## Notes

## Learnings

## Progress Log

- [2026-10-30] Created