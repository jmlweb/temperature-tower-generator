# Slicer-Agnostic Temperature Tower Generator - Task Index

## Stats

| Status | Count |
|--------|-------|
| Pending | 2 |
| Active | 0 |
| Blocked | 2 |
| Complete | 15 |

## Active Tasks

- TSK-001: Validate PrusaSlicer demand with a hand-made demo (P1) [BLOCKED: Needs a human: criteria 1-3 require posting the demo on the Prusa forum and r/prusa3d from a personal account, waiting 14 days and tallying replies; an unattended agent must not publish on public forums, and the 2026-11-15 decision date cannot fit a 14-day window from 2026-11-14. Criterion 4 (prior-tool search) is best done alongside the post.]
- TSK-008: User transforms binary G-code (.bgcode) from Core One and MK4-class printers (P1) [BLOCKED: Criterion 9 is a physical gate: one print on a Prusa Core One from a transformed .bgcode must reach every tier at its temperature. Needs the user and the printer; all software criteria (1-8) are proven.]

## Pending Tasks

| ID | Title | Priority | Tags | Created |
|----|-------|----------|------|---------|
| TSK-007 | Public launch with counter and physical print gate | P3 | release, community | 2026-10-18 |
| TSK-019 | Fix: First layer taller than the start G-code purge Z is rejected as variable layer height | P3 |  | 2026-11-26 |

## Recently Completed

| ID | Title | Completed |
|----|-------|-----------|
| TSK-018 | Fix: Multi-tool output neutralizes the inactive tool's heat command, so it prints cold while the warning says only the active tool changes | 2026-11-23 |
| TSK-017 | Fix: Tower config accepts heights the STL name cannot encode, breaking the lossless round trip | 2026-11-20 |
| TSK-009 | Fix: Tier 0 M109 R turns the hotend off on Klipper firmware | 2026-11-12 |
| TSK-010 | Fix: No warning when Custom tiers fall below the cold-extrusion limit | 2026-11-12 |
| TSK-011 | Fix: Tower config accepts a step that skips the top tier or leaves a single tier | 2026-11-12 |
| TSK-013 | Fix: Plain G-code with non-UTF-8 bytes loses them in the output | 2026-11-12 |
| TSK-012 | Fix: No CI workflow runs typecheck and tests on pull requests | 2026-11-11 |
| TSK-014 | Fix: Binary G-code report status double-counts inserted tier commands | 2026-11-11 |
| TSK-015 | Fix: Single-object Klipper or OctoPrint-labelled G-code fails with multiple-objects | 2026-11-11 |
| TSK-016 | Fix: Config recovery from Klipper object labels fails for non-integer heights | 2026-11-11 |
