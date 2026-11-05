---
id: RPT-006
title: Plain G-code with non-UTF-8 bytes loses them in the output
type: bug
severity: low
status: triaged
created: 2026-11-05
triaged: 2026-11-05
task-id: TSK-013
---

## Summary

A plain-text G-code upload is decoded with `utf8Decode`, which replaces every malformed UTF-8 sequence with U+FFFD, and the output is re-encoded as UTF-8. A kept input line that holds a byte which is not valid UTF-8 (for example a Windows-1252 `é` in a comment) therefore comes out changed, which breaks the ADR-0002 guarantee that every other input line appears byte-for-byte.

## Where

- `packages/core/src/gcode-file.ts:22` decodes text uploads with `utf8Decode(bytes)`.
- `packages/core/src/bgcode/utf8.ts:83` pushes `0xfffd` for each invalid byte.
- `packages/core/src/process.ts:67` re-encodes the transformed text with `utf8Encode(output)`.
- The ADR-0002 property test (`packages/core/src/transform.test.ts:143`) generates JavaScript strings and never round-trips raw bytes, so it cannot catch this.

## Reproduction

Prepend the Latin-1 bytes `; caf\xe9 note\n` to `fixtures/prusaslicer/arc-moves.gcode`, call `loadGcodeFile({ fileName, bytes })`, then `processGcode` with the fixture's config.

Observed output:

```
input has 0xE9: true  output has 0xE9: false  output has EF BF BD: true
```

## Impact

PrusaSlicer writes UTF-8, so stock slices are byte-exact. Only hand-edited files, or files re-saved as Windows-1252 or Latin-1, are affected, and the changed bytes almost always sit in comments, so print behaviour does not change. The defect is the silent break of the documented line-preserving guarantee: the report does not mention that those lines changed.
