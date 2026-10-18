---
id: TSK-004
title: User reviews a change report before download
status: pending
priority: P2
tags: [validation, web]
created: 2026-10-18
source: kickstart
depends-on: [TSK-001, TSK-002]
---

# User reviews a change report before download

## Description

**Outcome:** before downloading, a user sees the detected slicer, base temperature source, warnings, a temperature-vs-Z chart and every inserted and neutralized command; errors block the download.
**Validates:** none
**Implements:** ADR-0004

## Acceptance Criteria

- [ ] Every ADR-0004 error and warning check has a fixture that triggers it
- [ ] Error fixtures produce no output file and block the download
- [ ] Download control appears only after the report renders, with temperature-vs-Z chart and inserted and neutralized commands
- [ ] Output G-code starts with the temptower header block holding version, config and change summary

## Notes

## Learnings

## Progress Log

- [2026-10-18] Created