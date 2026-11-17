---
id: TSK-017
title: Fix: Tower config accepts heights the STL name cannot encode, breaking the lossless round trip
status: pending
priority: P4
tags: []
created: 2026-11-17
source: report/RPT-010
depends-on: []
---

# Fix: Tower config accepts heights the STL name cannot encode, breaking the lossless round trip

## Description

Report RPT-010 is valid and actionable: add a precision bound to height validation in validateTowerConfig and widen the round-trip property test. Severity low maps to P4.

## Acceptance Criteria

- [ ] validateTowerConfig rejects block and base heights the filename codec cannot represent exactly
- [ ] The filename-codec round-trip property draws block and base heights from the full domain validation accepts
- [ ] A test covers a height with more than 3 decimals being rejected
- [ ] pnpm typecheck and pnpm test pass

## Notes

## Learnings

## Progress Log

- [2026-11-17] Created