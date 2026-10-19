# 0002. Line-preserving pure transform over parsed G-code

**Status:** accepted; the neutralize rule is superseded by ADR-0009, which neutralizes every non-turn-off `M104`/`M109` after the tier 0 command and inserts tier 0 before the first extruding move

## Context
The users' main complaint about the formula workaround is that it fails silently: temperatures do not change, or tiers start at the wrong layer. Trust depends on the user seeing that the tool changed only what it reported. The core logic must also be testable quickly in isolation, without a browser.

## Decision
G-code is parsed as a stream into typed commands that keep their raw line text and line endings. The transformation is a pure function: (parsed G-code, tower config) → (output lines, change list). It changes the file in only three ways:
- **Insert:** a tier temperature command ending in ` ; [temptower] tier <i>` at the first layer of each tier.
- **Header:** comment lines starting with `; [temptower]`.
- **Neutralize:** an `M104`/`M109` line, including tool-indexed variants such as `M104 T0 S…`, whose layer Z is at or above the first tier boundary is prefixed with `; [temptower] neutralized: `. Start G-code and lines below the first tier boundary are kept.

Every other line is emitted byte-for-byte. Parsing and transformation run off the UI thread, and the core has no dependency on browser or DOM APIs.

## Consequences
- The change list feeds the report directly, and "untouched lines identical" becomes a property test.
- The core runs and is tested in a non-browser runtime.
- Every edit must be one of the three kinds above. In-place rewriting of existing commands is ruled out.
