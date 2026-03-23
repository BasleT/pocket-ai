# Bundle Audit

## Latest Build Snapshot

- Command: `bun run build`
- Target: `chrome-mv3`
- Total size: ~1.36 MB

## Budget Check

- Phase 8 budget target: under 5 MB
- Current build: PASS

## Notes

- Largest chunks are expected from `pdfjs-dist` and sidepanel UI bundles.
- Current size leaves headroom for remaining polish work.
