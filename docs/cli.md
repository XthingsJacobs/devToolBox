# CLI Guide (`cli.sh`)

The repository provides `cli.sh` as a unified command entry for local development, packaging, and quality checks.

## Quick Start

Make the script executable (first time only):

```bash
chmod +x ./cli.sh
```

Show help:

```bash
./cli.sh help
```

Check local environment (Node/pnpm/Git):

```bash
./cli.sh doctor
```

## Commands

```bash
./cli.sh dev
./cli.sh build
./cli.sh plugin create
./cli.sh plugin <market-id>
./cli.sh plugin all
./cli.sh package <macos|windows|all> [arm64|x64|universal]
./cli.sh check
./cli.sh tool new
```

## Common Workflows

### Run in Development

```bash
./cli.sh dev
```

### Build (no installer)

```bash
./cli.sh build
```

### Package Installer

macOS (arm64):

```bash
./cli.sh package macos arm64
```

macOS (x64):

```bash
./cli.sh package macos x64
```

macOS (universal):

```bash
./cli.sh package macos universal
```

Windows:

```bash
./cli.sh package windows
```

All:

```bash
./cli.sh package all
```

Interactive packaging:

```bash
./cli.sh package
```

Notes:

- macOS artifacts are written to `release/` as `*.dmg`
- Windows artifacts are written to `release/` as `*.exe`
- Packaging Windows on macOS may require `wine` + `mono` (otherwise use Windows or CI)

### Quality Gates

```bash
./cli.sh check
```

This runs:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`

## Marketplace

Marketplace plugin development lives in `marketplace/`:

```bash
pnpm -C marketplace build
```

Create a new marketplace plugin template (interactive):

```bash
./cli.sh plugin create
```

Build + pack a marketplace plugin into a local registry zip:

```bash
./cli.sh plugin <market-id>
```

Build + pack all marketplace plugins into `marketplace/registry.local.json`:
```bash
./cli.sh plugin all
```

See also: [Marketplace Packaging](marketplace.md)
