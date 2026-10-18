---
id: TSK-003
title: User downloads a labelled tower STL that matches the config
status: pending
priority: P2
tags: [geometry, web]
created: 2026-10-18
source: kickstart
depends-on: [TSK-001]
---

# User downloads a labelled tower STL that matches the config

## Description

**Outcome:** a user picks a material preset (PLA or PETG) and a range, and downloads an STL whose labels match the tiers, with the config encoded in the filename.
**Validates:** none
**Implements:** ADR-0005, ADR-0006

## Acceptance Criteria

- [ ] Generated mesh is manifold and its height is b + n·h
- [ ] Each tier label shows that tier temperature
- [ ] Filename config encode and decode round-trip is lossless
- [ ] Geometry and transform share one tier-boundary function

## Notes

## Learnings

## Progress Log

- [2026-10-18] Created