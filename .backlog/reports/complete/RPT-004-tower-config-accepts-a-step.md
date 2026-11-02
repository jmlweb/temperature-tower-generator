---
id: RPT-004
title: Tower config accepts a step that skips the top tier or leaves a single tier
type: bug
severity: low
status: triaged
created: 2026-11-02
triaged: 2026-11-02
task-id: TSK-011
---

## Summary

`validateTowerConfig` (`packages/core/src/tower-config.ts:256-271`) accepts any positive whole-degree step, but `tierCount` (`packages/core/src/tower-config.ts:219-220`) floors `|end - start| / step`. Two wrong results follow:

1. A step larger than the range gives a one-tier "tower" with no temperature change at all. Validation already rejects `start === end` for that reason, but `230 to 228, step 5` passes.
2. A step that does not divide the range silently drops the configured top temperature. The form field is labelled "Top tier" (`apps/web/src/config-form.ts:37`) and the STL name encodes `230to190`, yet the top tier prints at 200 °C.

## Reproduction

Run against `packages/core/src` (Node 24, type stripping): call `validateTowerConfig`, `tierTemperatures`, `towerHeight` and `encodeTowerConfigName` for PLA, block height 10, base 1.4. Observed output:

```
[] [ 230, 215, 200 ] 31.4 temptower_v1_PLA_230to190_step15_h10_b1.4_m104
[] [ 230 ] 11.4 temptower_v1_PLA_230to228_step5_h10_b1.4_m104
```

The first array is the validation problem list (empty in both cases).

## Expected

Either validation rejects a step that does not divide the range and any config with fewer than 2 tiers, or the end temperature is defined as a bound and the UI labels it that way. Changing the meaning of the config touches ADR-0005, so the choice needs an ADR.
