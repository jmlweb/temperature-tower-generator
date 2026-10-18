---
id: TSK-005
title: Config is recovered automatically from the uploaded G-code
status: pending
priority: P3
tags: [core, ux]
created: 2026-10-18
source: kickstart
depends-on: [TSK-001, TSK-002, TSK-003]
---

# Config is recovered automatically from the uploaded G-code

## Description

**Outcome:** a user who slices the generated STL uploads the G-code and skips manual config entry.
**Validates:** none
**Implements:** ADR-0005

## Acceptance Criteria

- [ ] Config read from the G-code filename when it keeps the STL base name
- [ ] Fallback reads the config from the object-label comment name
- [ ] Manual entry offered when both fail
- [ ] All three recovery cases covered by tests

## Notes

## Learnings

## Progress Log

- [2026-10-18] Created