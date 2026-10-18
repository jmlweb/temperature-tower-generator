---
id: TSK-006
title: Correct towers for all common PrusaSlicer profile variants
status: pending
priority: P3
tags: [core, fixtures]
created: 2026-10-18
source: kickstart
depends-on: [TSK-001, TSK-002]
---

# Correct towers for all common PrusaSlicer profile variants

## Description

**Outcome:** users whose PrusaSlicer profile uses Z-hop, relative extrusion or 0.15 mm layers get correct tier boundaries.
**Validates:** none
**Implements:** ADR-0002, ADR-0003

## Acceptance Criteria

- [ ] 8 PrusaSlicer fixtures covering Z-hop on and off, absolute and relative E, 0.2 and 0.15 mm have golden outputs and report snapshots
- [ ] Slicer marker and motion mismatch emits a warning
- [ ] G2 or G3 arc input produces an error

## Notes

## Learnings

## Progress Log

- [2026-10-18] Created