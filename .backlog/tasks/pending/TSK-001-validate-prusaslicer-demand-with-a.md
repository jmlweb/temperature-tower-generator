---
id: TSK-001
title: Validate PrusaSlicer demand with a hand-made demo
status: pending
priority: P1
tags: [validation, community]
created: 2026-10-18
source: kickstart
depends-on: []
---

# Validate PrusaSlicer demand with a hand-made demo

## Description

**Outcome:** PrusaSlicer users see a demo tower (generated STL plus a before/after G-code report) and say whether they would use the 3-step flow.
**Validates:** PrusaSlicer users will run a 3-step flow (download STL, slice, upload G-code) instead of the pasted-formula workaround or switching to OrcaSlicer's built-in tower. Holds with at least 5 counted replies across both boards within 14 days; refuted with fewer than 5 or if most replies recommend OrcaSlicer.
**Implements:** none
**If refuted:** stop per the kill criteria, or pivot by re-running /flowstate:kickstart with the new assumption.

## Acceptance Criteria

- [ ] Demo of STL plus before and after G-code report posted on the Prusa forum and r/prusa3d, or Printables comments if a board blocks it
- [ ] Counted replies tallied 14 days after posting using the counted-reply definition in docs/evaluation.md
- [ ] Verdict held or refuted recorded in docs/evaluation.md and docs/overview.md by 2026-11-15
- [ ] Search for an existing tool that already covers PrusaSlicer with matching labels and a verified change done and recorded

## Notes

## Learnings

## Progress Log

- [2026-10-18] Created