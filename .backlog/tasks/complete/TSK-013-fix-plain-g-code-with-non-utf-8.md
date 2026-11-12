---
id: TSK-013
title: Fix: Plain G-code with non-UTF-8 bytes loses them in the output
status: complete
priority: P4
tags: []
created: 2026-11-05
source: report/RPT-006
depends-on: []
completed: 2026-11-12
started: 2026-11-12
---

# Fix: Plain G-code with non-UTF-8 bytes loses them in the output

## Description

### Description

Plain-text uploads are decoded with `utf8Decode` (`packages/core/src/gcode-file.ts:22`), which turns every malformed UTF-8 byte into U+FFFD (`packages/core/src/bgcode/utf8.ts:83`), and the output is re-encoded with `utf8Encode` (`packages/core/src/process.ts:67`). A kept line with a Windows-1252 or Latin-1 byte therefore changes in the output, breaking the ADR-0002 byte-for-byte guarantee. Stock PrusaSlicer output is UTF-8 and unaffected. Reproduction and observed output: RPT-006.

## Acceptance Criteria

- [x] A kept input line holding a byte that is not valid UTF-8 appears byte-identical in the plain-text output, or a new ADR chooses to reject such input and a validation warning with a fixture reports it — evidence: gcode-file.ts reads plain text that is not valid UTF-8 as Latin-1 and process.ts writes it back the same way, so kept lines are byte-identical; no ADR needed (lossless) (2026-11-12)
- [x] A test covers a Latin-1 byte in a comment line of a plain G-code upload — evidence: transform.test.ts: Latin-1 0xE9 in a comment line survives processGcode; edge cases empty, BOM, literal U+FFFD, truncated, surrogate (2026-11-12)
- [x] The ADR-0002 line-preserving property is also checked over raw input bytes, not only decoded strings — evidence: raw-byte property test (random bytes in comments) plus a raw-byte check over every plain fixture in fixtures.test.ts; mutation forcing UTF-8 fails both (2026-11-12)

## Notes

## Learnings

## Progress Log

- [2026-11-05] Created
- [2026-11-12] Lossless Latin-1 fallback for non-UTF-8 plain uploads; reviewer noted report text for non-Latin-1 legacy encodings (e.g. Shift-JIS) shows mojibake, accepted since bytes are preserved and tower names are ASCII
- [2026-11-12] Completed