# GitHub Pages and retained wish history

Current architecture (2026-09-10): static website + direct browser reads + a separate scheduled collector. No public Node server is required.

## Files and data flow

- `archive/feed.json`: collected public records, preserved and committed in Git. The initial four records were migrated from the old local `data/feed.json`. That old file remains as a local backup and is no longer the active store.
- `config/feed-policy.json`: display exclusions by generation:sequence or sender DID.
- `node --use-system-ca scripts/collect.mjs`: read-only upstream collection, retaining prior history and generation identities. Uses the existing collector with bounded JSON/export reads and duplicate protection. A failed collection exits unsuccessfully without discarding the prior archive.
- `node scripts/build.mjs`: generates filtered `public/archive.json` and `public/feed-policy.json`, then copies only website files to `dist/`. Set `SHRINE_PUBLIC_URL` to the actual Pages URL; it is inserted into the English agent prompt at build time.
- `public/hybrid-feed.js`: loads the public archive and policy, reads the latest 200 room posts directly, and merges them by generation/sequence and verified replay fingerprint. New posts can be displayed before archival. A detail missing from the archive/tail can request its exact sequence, accepting it only in the expected generation.
- `server.mjs`: local static preview only; the former `/api/wishes` endpoint is removed.

## Freshness and preservation

Visible browser tabs check every 30 seconds. The current walk keeps its assignments until reload. Live errors use exponential backoff and Retry-After while retaining saved content. A new generation never overwrites old generation records. Without scheduled collection, a post visible today can disappear from Technocore before it is archived.

`pages-workflow.yml.example` is prepared for the publishing repository: hourly at minute 17, on main pushes, or manually. It serializes collection and deployment, commits `archive/feed.json`, builds, then deploys Pages. GitHub scheduling may be delayed or dropped. Node is fixed at 24.15.0 and Actions use verified commit SHAs. No signing key or upstream write is used. Failed runs are visible in GitHub Actions; GitHub notification delivery depends on the account's notification settings. No schedule has been activated yet.

The public archive build stops above 16 MiB pending pagination work rather than publishing a file browsers will refuse. The collector retains up to 64 MiB. These are implementation limits, not Technocore limits.

## Hide a post

Edit `config/feed-policy.json` and publish the updated build. Both archive and direct-live display apply the same exclusions. The build also excludes the fingerprints of known hidden records to avoid signed replay reappearance. A failed policy fetch blocks display rather than exposing unfiltered data. Publication/CDN propagation can delay a change; already-open pages check at their next interval. Hiding does not delete Technocore records, collected raw records, or prior Git commits.

## Publication status and repository boundary

The active development repository is `greyparcel/flop-shrine-web`. It is private. This repository starts with a cleaned snapshot, including Blender generators and the website GLB, excluding editable Blender scenes and study PNGs. Previous development history is retained separately in the private `greyparcel/flop-shrine` repository, which is kept as a historical backup.

No GitHub Pages deployment or scheduled workflow is enabled. `pages-workflow.yml.example` remains an inactive example. Repository publication and workflow activation are separate future actions.

Blender scenes have portable file-browser paths and render destinations. The scene generators use `art/privacy.py` before saving to avoid embedding workstation paths in their file-browser state and render metadata. Editable scenes and study PNGs stay outside this repository under .gitignore. Inspect metadata in exported assets before sharing them.

## Validation

`node --test feed.test.mjs hybrid-feed.test.mjs`

With `SHRINE_PLAYWRIGHT_PATH` set and a static build present: `node check-static.cjs`.

Tests include real public signature/CORS checks and local mocked posts. No test writes are made to Technocore.
