---
id: TSK-002
title: User transforms PrusaSlicer G-code with a manually entered config
status: pending
priority: P2
tags: [core, web, skeleton]
created: 2026-10-18
source: kickstart
depends-on: [TSK-001]
---

# User transforms PrusaSlicer G-code with a manually entered config

## Description

**Outcome:** walking skeleton: a user uploads PrusaSlicer G-code, enters the tower config by hand, and downloads `_temptower` G-code with per-tier temperatures.
**Validates:** none
**Implements:** ADR-0001, ADR-0002, ADR-0003

## Acceptance Criteria

- [ ] pnpm workspace, build, test and fixture commands defined in AGENTS.md
- [ ] Parsing and transform run in a Web Worker and packages/core imports no DOM API
- [ ] Tier M104 commands inserted at the first layer of each tier and conflicting M104 or M109 lines neutralized
- [ ] Property test proves untouched input lines are byte-identical in the output

## Notes

## Learnings

## Progress Log

- [2026-10-18] Created