---
id: RPT-010
title: Tower config accepts heights the STL name cannot encode, breaking the lossless round trip
type: bug
severity: low
status: triaged
created: 2026-11-17
triaged: 2026-11-17
task-id: TSK-017
---

## Summary

ADR-0005 says the STL base name encodes the tower config and that encode/decode is lossless. `validateTowerConfig` accepts any finite block or base height at or above the minimum, with no precision bound, but the codec rounds every number to 0.001 mm. A config with a finer height passes validation, and the STL name (and so the recovered config) silently differs from the config the tower was built from.

## Where

- `packages/core/src/filename-codec.ts:11` — `formatNumber` rounds to 0.001 (`Math.round(n * 1000) / 1000`).
- `packages/core/src/tower-config.ts:283-284` — block and base height checks only test `isFinite` and the minimum; no precision limit.
- `packages/core/src/filename-codec.test.ts:12-13` — the round-trip property draws heights only in 0.1 mm steps, so it passes despite the gap.
- `apps/web/src/config-form.ts:40` — the form's only check is `validateTowerConfig`; the inputs' `step` attribute does not stop `Number(input.value)` from reading `10.0004`.

## Reproduction

Vitest scratch test against the current code:

```ts
const c = { material: 'PLA', startTemperature: 230, endTemperature: 190, step: 5, blockHeight: 10.0004, baseHeight: 1.4, waitForTemperature: false }
validateTowerConfig(c)                         // []
encodeTowerConfigName(c)                       // 'temptower_v1_PLA_230to190_step5_h10_b1.4_m104'
decodeTowerConfigName(encodeTowerConfigName(c)) // { ..., blockHeight: 10, ... }
towerHeight(c)                                 // 91.404
towerHeight(decoded)                           // 91.4
```

## Impact

Low. At normal layer heights the shift is far below one layer, so tier placement and the height check do not change for realistic inputs. It is a missing validation at a boundary that contradicts the documented lossless round trip (ADR-0005), and the property test does not cover the domain validation accepts.

## Suggested fix

Reject block and base heights the codec cannot represent (more than 3 decimals, or a coarser bound matching the form steps) in `validateTowerConfig`, and widen the round-trip arbitrary to draw from the full domain validation accepts.
