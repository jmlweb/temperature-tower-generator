---
id: TSK-013
title: Fix: Plain G-code with non-UTF-8 bytes loses them in the output
status: pending
priority: P4
tags: []
created: 2026-11-05
source: report/RPT-006
depends-on: []
---

# Fix: Plain G-code with non-UTF-8 bytes loses them in the output

## Description

### Description

Plain-text uploads are decoded with `utf8Decode` (`packages/core/src/gcode-file.ts:22`), which turns every malformed UTF-8 byte into U+FFFD (`packages/core/src/bgcode/utf8.ts:83`), and the output is re-encoded with `utf8Encode` (`packages/core/src/process.ts:67`). A kept line with a Windows-1252 or Latin-1 byte therefore changes in the output, breaking the ADR-0002 byte-for-byte guarantee. Stock PrusaSlicer output is UTF-8 and unaffected. Reproduction and observed output: RPT-006.

## Acceptance Criteria

- [ ] A kept input line holding a byte that is not valid UTF-8 appears byte-identical in the plain-text output, or a new ADR chooses to reject such input and a validation warning with a fixture reports it
- [ ] A test covers a Latin-1 byte in a comment line of a plain G-code upload
- [ ] The ADR-0002 line-preserving property is also checked over raw input bytes, not only decoded strings

## Notes

## Learnings

## Progress Log

- [2026-11-05] Created