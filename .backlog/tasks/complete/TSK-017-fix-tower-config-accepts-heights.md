---
id: TSK-017
title: Fix: Tower config accepts heights the STL name cannot encode, breaking the lossless round trip
status: complete
priority: P4
tags: []
created: 2026-11-17
source: report/RPT-010
depends-on: []
started: 2026-11-20
completed: 2026-11-20
---

# Fix: Tower config accepts heights the STL name cannot encode, breaking the lossless round trip

## Description

Report RPT-010 is valid and actionable: add a precision bound to height validation in validateTowerConfig and widen the round-trip property test. Severity low maps to P4.

## Acceptance Criteria

- [x] validateTowerConfig rejects block and base heights the filename codec cannot represent exactly
- [x] The filename-codec round-trip property draws block and base heights from the full domain validation accepts
- [x] A test covers a height with more than 3 decimals being rejected
- [x] pnpm typecheck and pnpm test pass

## Notes

## Learnings

- LRN-006: STL name number precision limits for tower heights
## Progress Log

- [2026-11-17] Created
- [2026-11-20] Started
- [2026-11-20] criterion 1 — evidence: pnpm vitest run packages/core/src/tower-config.test.ts → 'rejects heights finer than the 0.001 mm the STL name keeps' failed before the fix (expected [] to deeply equal [Array(1)]), passes after; also rejects heights at or above 1e21 (exponent form) (2026-11-20)
- [2026-11-20] criterion 2 — evidence: pnpm vitest run packages/core/src/filename-codec.test.ts → round-trip property draws heights from acceptedHeightArbitrary (thousandths up to MAX_SAFE_INTEGER plus any double below 1e21 the predicate accepts) and asserts validateTowerConfig accepts each draw; passes (2026-11-20)
- [2026-11-20] criterion 3 — evidence: tower-config.test.ts asserts blockHeight 10.0004 and baseHeight 1.2345 are rejected with 'must have at most 3 decimals' → passes (2026-11-20)
- [2026-11-20] criterion 4 — evidence: pnpm typecheck → no errors; pnpm test → 13 files passed, 137 tests passed, 5 skipped (2026-11-20)
- [2026-11-20] Completed