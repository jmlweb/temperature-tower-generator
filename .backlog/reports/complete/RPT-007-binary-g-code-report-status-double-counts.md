---
id: RPT-007
title: Binary G-code report status double-counts inserted tier commands
type: bug
severity: low
status: triaged
created: 2026-11-08
triaged: 2026-11-08
task-id: TSK-014
---

## Summary

For a `.bgcode` upload the status line under step 2 says twice as many tier commands were inserted as the output G-code header does.

## Where

- `packages/core/src/transform.ts:130-136` — with `markerStyle: 'line'` (binary input, ADR-0007) each tier produces two `insert` changes: the marker comment line `; [temptower] tier <i>` and the bare `M104`/`M109` command.
- `packages/core/src/report.ts:96` — `report.inserted` collects every `insert` change, so it holds both lines per tier.
- `apps/web/src/main.ts:175` — the status text uses `result.report.inserted.length` as the number of "tier commands inserted".
- `packages/core/src/transform.ts:90` — the output header counts placed tiers instead, so the two numbers disagree.

## Observed output

Fixture `fixtures/prusaslicer/coreone-binary` (3 tiers, all placed):

```
$ jq '{placed: ([.tiers[]|select(.lineIndex!=null)]|length), inserted: (.inserted|length)}' fixtures/prusaslicer/coreone-binary.report.json
{ "placed": 3, "inserted": 6 }
$ rg -n 'changes:' fixtures/prusaslicer/coreone-binary.golden.gcode
4:; [temptower] changes: 3 tier commands inserted, 1 temperature commands neutralized, start G-code kept
```

The UI therefore shows "Report ready: 6 tier commands inserted, ..." while the downloaded file says 3. Plain-text input is not affected (one inline line per tier).

## Expected

The status line counts tier commands, matching the header (3 for this fixture). Either count `report.tiers` with a line index, or keep marker lines out of the count.
