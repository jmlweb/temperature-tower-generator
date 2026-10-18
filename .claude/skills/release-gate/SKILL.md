---
name: release-gate
description: Runs the pre-release checklist, including the physical-print gate, before deploying a version. Use when the user says "release", "ship it", "deploy a version", or "phase gate". Not for routine commits.
---

# Release gate

## Steps
1. Run every test suite: unit, golden fixtures, property-based, geometry and E2E. Stop on any failure.
2. For each supported slicer, slice a fresh tower and transform the G-code with the release build. Print it.
3. Confirm that each printed label matches the temperature the report lists for its tier. Store a photo in the release notes.
4. Bump the tool version, and check that it appears in the output header block (ADR-0004).
5. Build the static site and deploy it. Confirm that no request other than the aggregate counter carries user data (ADR-0001).
6. Update the changelog with user-visible changes and the new fixtures.

Done when every step passes and the photo and changelog are recorded. A failed print blocks the release.
