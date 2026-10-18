# 0007. Binary G-code is decoded, transformed as text, and re-encoded

**Status:** accepted

## Context
ADR-0004 lists binary G-code (`.bgcode`) as an `error`. The Prusa Core One, MK4S, XL and MINI ship with "Supports binary G-code" on, so their stock PrusaSlicer profiles export `.bgcode` by default. The Core One is the best-selling Prusa printer, which makes that error the first thing most new users see. The format is open (prusa3d/libbgcode): a `GCDE` header, then blocks (file, printer, print and slicer metadata, thumbnails, G-code) with per-block compression (none, Deflate, Heatshrink 11/4 or 12/4) and CRC32 checksums. G-code blocks are MeatPack-encoded, and MeatPack is lossy by design: it drops inline comments, strips spaces from `G` lines and re-inserts them on decode.

## Decision
A `.bgcode` upload is decoded in the G-code worker by a pure TypeScript codec in `packages/core` (no WASM, no new dependency): block reader with checksum verification, Heatshrink and zlib inflate decoders, and a MeatPack decoder ported from libbgcode. The motion analysis, validation and transform of ADR-0002 to ADR-0004 run unchanged on the decoded G-code text. The output is written back as `.bgcode`: every non-G-code block (metadata, thumbnails) is copied byte-for-byte from the input, and the transformed text is re-encoded into G-code blocks with the same encoding and compression as the input's G-code blocks, split on line boundaries at the same 64 KiB cache size libbgcode uses.

The ADR-0002 guarantee applies to the decoded text: every line of the decoded output is a decoded input line byte-for-byte, an inserted tier command, a header line or a neutralized line. Because MeatPack drops inline comments, the tier marker in binary output is a comment line `; [temptower] tier <i>` immediately before the bare `M104`/`M109` command, instead of the trailing ` ; [temptower] tier <i>`. Header and neutralized lines are whole-line comments, which MeatPack keeps.

Slicer metadata read from the blocks (producer, printer, print and slicer INI) feeds the PrusaSlicer reader the same way `; key = value` comments do in plain G-code, so base temperature, object names and config recovery (ADR-0005) work on both inputs. The `binary-gcode` error of ADR-0004 becomes `binary-gcode-unreadable`: a file with the `GCDE` magic or `.bgcode` extension that fails to decode (bad magic, unknown version, unknown block or compression type, checksum mismatch, truncated block) blocks the download with the decode reason in the report. The report states that the input was binary and which version, checksum, G-code compression and encoding it used, and the download delivers `<base>_temptower.bgcode`.

## Consequences
- Core One, MK4S, XL and MINI users upload what their slicer exports; no printer setting to change.
- The codec is verified three ways: decoding libbgcode's reference files to their published decoded text, a MeatPack and Heatshrink round trip on every fixture, and the ADR-0002 property test run over the decoded text of a binary input.
- The PrusaSlicer 3.0 CLI cannot export `.bgcode`, so the binary fixture is the Core One text slice binarized by the project's own converter, which mirrors libbgcode's `from_ascii_to_binary`. A `.bgcode` exported from the PrusaSlicer GUI stays a user gate (TSK-008).
- The decoded text is MeatPack's canonical form (inline comments gone, `G` lines re-spaced), not the slicer's original bytes. The report shows that form, and the original binary stays untouched.
- Ruled out: writing `.bgcode` for a plain-text upload, and shipping libbgcode as WASM (a 2 MB build with Emscripten for a 600-line format).
