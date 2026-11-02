---
id: RPT-005
title: No CI workflow runs typecheck and tests on pull requests
type: improvement
severity: low
status: triaged
created: 2026-11-02
triaged: 2026-11-02
task-id: TSK-012
---

## Summary

The only workflow, `.github/workflows/deploy.yml:3-6`, triggers on `push` to `main` and `workflow_dispatch`. No workflow runs on `pull_request`, so `pnpm typecheck` and `pnpm test` (the property test for ADR-0002, the fixture goldens and the geometry checks) first run after a change is already on `main`. A failing change then blocks the Pages deploy instead of the merge.

## Observed

```
$ ls .github/workflows
deploy.yml
```

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:
```

Locally on 2026-11-02, `pnpm typecheck` passes and `pnpm test` reports 110 passed, 5 skipped, so a PR check would be green today.

## Expected

A workflow on `pull_request` to `main` runs `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test` and `pnpm build`, so that PRs (including automated backlog PRs) are gated before merge.
