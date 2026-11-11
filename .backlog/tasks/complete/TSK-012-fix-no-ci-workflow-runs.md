---
id: TSK-012
title: Fix: No CI workflow runs typecheck and tests on pull requests
status: complete
priority: P4
tags: []
created: 2026-11-02
source: report/RPT-005
depends-on: []
completed: 2026-11-11
started: 2026-11-11
---

# Fix: No CI workflow runs typecheck and tests on pull requests

## Description

`.github/workflows/deploy.yml` runs typecheck and tests only on push to `main`, so PRs merge without a check. Add a separate PR workflow. Details in RPT-005.

## Acceptance Criteria

- [x] A workflow triggered on pull_request to main runs pnpm install --frozen-lockfile, pnpm typecheck, pnpm test and pnpm build on Node 24 — evidence: .github/workflows/ci.yml: pull_request to main, Node 24, install --frozen-lockfile, typecheck, test, build (#7) (2026-11-11)
- [x] The workflow has read-only permissions and no deploy step — evidence: permissions: contents: read; no deploy job (2026-11-11)
- [x] The check passes on a PR that changes only .backlog files — evidence: this backlog-only PR passed the CI check before merge (2026-11-11)

## Notes

## Learnings

## Progress Log

- [2026-11-02] Created
- [2026-11-11] Added .github/workflows/ci.yml in #7; completion PR touches only .backlog
- [2026-11-11] Completed