---
id: TSK-012
title: Fix: No CI workflow runs typecheck and tests on pull requests
status: pending
priority: P4
tags: []
created: 2026-11-02
source: report/RPT-005
depends-on: []
---

# Fix: No CI workflow runs typecheck and tests on pull requests

## Description

`.github/workflows/deploy.yml` runs typecheck and tests only on push to `main`, so PRs merge without a check. Add a separate PR workflow. Details in RPT-005.

## Acceptance Criteria

- [ ] A workflow triggered on pull_request to main runs pnpm install --frozen-lockfile, pnpm typecheck, pnpm test and pnpm build on Node 24
- [ ] The workflow has read-only permissions and no deploy step
- [ ] The check passes on a PR that changes only .backlog files

## Notes

## Learnings

## Progress Log

- [2026-11-02] Created