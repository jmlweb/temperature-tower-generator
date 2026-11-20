---
id: LRN-006
title: STL name number precision limits for tower heights
status: active
tags: [filename-codec, validation, floating-point]
task: TSK-017
created: 2026-11-20
---

The STL name codec rounds numbers to 0.001 and writes them with String, so a height round-trips only if Math.round(n*1000)/1000 === n and n < 1e21.

- Math.round(1e20*1000)/1000 !== 1e20: very large heights fail the decimals check through floating-point error.
- String switches to exponent form at 1e21 (and ${1e21} renders as 1e+21); the decode regex cannot parse it.
- For property tests, draw from the accepted set (thousandths integers / 1000, or doubles filtered by the predicate); fc.pre over raw fc.double heights almost never passes.
