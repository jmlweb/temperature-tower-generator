---
id: LRN-007
title: Multi-tool warning text is snapshotted in the fixture report, not the golden
status: active
tags: [validation, fixtures, testing]
task: TSK-018
created: 2026-11-23
---

Asserting a reworded warning with not.toContain on a fragment is fragile: the new multi-tool text still says tier commands reach "only the active tool", so a test for the absence of "only the active tool" fails against the correct text. Assert absence of the full old sentence instead. Also: the multi-tool warning text lives in the fixture report snapshot (multi-tool.report.json), so any rewording needs pnpm fixture; the golden G-code is unaffected because the warning is not written into the output header.
