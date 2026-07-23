# Repository Scripts

These scripts support development and contributor workflows for DevToolBox.

## Overview

- `lint-modules.mjs`: Validates each tool's runtime `manifest.json`, entry, category, and locale.
- `lint-marketplace.mjs`: Validates Marketplace manifests, permissions, SDK compatibility, and network domains.
- `lint-boundaries.mjs`: Prevents renderer privileged imports, unsafe HTML render paths, new direct IPC growth, and oversized tool entries.
- `lint-docs.mjs`: Keeps translated page trees, language switches, links, structure, and MkDocs navigation in sync.
- `new-tool.mjs`: Generates a manifest-based tool module scaffold under `core/renderer/components/ModuleTools/`.
- `exec-without-node-options.mjs`: Runs a command with `NODE_OPTIONS` cleared (helps avoid issues with injected node options).
- `check-bundle-budget.mjs`: Enforces initial-load and lazy-chunk size budgets from the Vite manifest.
- `check-marketplace-bundle-budget.mjs`: Applies per-plugin entry and lazy-chunk budgets to Marketplace builds.
- `renderer-smoke.mjs`: Loads the production renderer in sandboxed Electron and exercises lazy pages and heavy tools.
- `generate-supply-chain.mjs`: Produces a CycloneDX SBOM and production third-party license inventory.
- `generate-checksums.mjs`: Creates a deterministic SHA-256 checksum list for release artifacts.

## CLI Preflight

`./cli.sh` wraps the common local workflows with environment checks:

- `./cli.sh doctor` prints Node, pnpm, Git, OS, memory, disk, and the default dev port status.
- `./cli.sh dev` checks the default Vite port (`5173`) before launch and automatically selects the next free port when it is occupied.
- `./cli.sh package` validates Node/pnpm versions, memory, disk space, macOS-to-Windows packaging prerequisites, and writes `.devtoolbox-diagnostics/package-preflight.txt`.
- `./cli.sh package` also runs build, bundle budget, supply-chain generation, and an esbuild binary sanity check before `electron-builder`.

Useful overrides:

- `DEVTOOLBOX_DEV_PORT=5174 ./cli.sh dev`: choose a preferred dev port.
- `DEVTOOLBOX_STRICT_PORT=1 ./cli.sh dev`: fail instead of auto-selecting a fallback port.
- `DEVTOOLBOX_SKIP_RESOURCE_CHECK=1 ./cli.sh package macos arm64`: skip memory/disk checks when intentionally forcing a package run.
- `DEVTOOLBOX_ALLOW_UNSUPPORTED_NODE=1`: bypass the Node major-version guard for diagnostics only; release packaging should use Node 20.
- `DEVTOOLBOX_ALLOW_UNSUPPORTED_PNPM=1`: bypass the pnpm major-version guard for diagnostics only; normal workflows should use pnpm 10.

## Usage

```bash
# Validate module structure (used by CI)
pnpm lint:modules
pnpm lint:boundaries
pnpm lint:docs
pnpm build
pnpm bundle:check
pnpm bundle:marketplace
pnpm supply-chain:generate
pnpm test:renderer

# Inspect local development/package environment
./cli.sh doctor
./cli.sh dev
./cli.sh package macos arm64

# Create a new tool module (interactive)
pnpm new:tool

# Create a new tool module (non-interactive examples)
pnpm new:tool TimestampConverter --category dev-tools
pnpm new:tool UrlCodec --id url-encode --with-help

# Hash release files or directories
node scripts/generate-checksums.mjs release --output release/SHA256SUMS
```

## Notes for Contributors

- Scripts should remain dependency-free (plain Node.js) unless there is a strong reason to add dependencies.
- Do not add scripts that require private credentials or internal infrastructure.
- Boundary baselines in `lint-boundaries.mjs` should only decrease. If a legacy tool needs new behavior, split it into `*.model.ts`, `use*.ts`, and panel components before increasing the entry file.
- `*.model.ts` files under built-in tools must stay UI-free and side-effect-free; route IPC/network access through hooks or service adapters.
- `bundle:check` requires a completed production build and reads `dist/.vite/manifest.json`.
- `bundle:marketplace` requires `pnpm -C marketplace build`; the Marketplace build command runs it automatically.
- `test:renderer` requires `pnpm build` and uses an isolated temporary Electron profile.
- Supply-chain output defaults to `dist/supply-chain/`; package and release workflows regenerate it from the installed production dependency tree.
