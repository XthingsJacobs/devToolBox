# Contributing

Thanks for contributing to DevToolBox.

## Development Environment

- Node.js 20+
- pnpm 10+
- macOS / Windows / Linux are supported for development (packaging requires the target OS)

## Run Locally

```bash
pnpm install
pnpm dev
```

## Quality Gates

```bash
pnpm lint
pnpm lint:modules
pnpm format
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

## PR Guidelines

- Base branch: `dev`
- Workflow: fork from `dev` → create feature branch → open PR back to `dev`
- Keep each PR focused (one feature / one refactor / one bug fix).
- Do not commit secrets (tokens, private keys, certificates).
- For UI changes, include screenshots or screen recordings when possible.

## Add a Tool Module

References:

- [dev-guide.md](./docs/dev-guide.md)
- [module-api.md](./docs/module-api.md)
- [ui-guidelines.md](./docs/ui-guidelines.md)
- [ipc-api.md](./docs/ipc-api.md)
- [codebase.md](./docs/codebase.md)

You can also generate a starter template:

```bash
pnpm new:tool
pnpm new:tool TimestampConverter --category dev-tools
```

## Add a Marketplace Plugin

References:

- SDK contract: [plugin-sdk.md](./docs/plugin-sdk.md)
- Packaging & local registry: [marketplace.md](./docs/marketplace.md)

Quick flow:

```bash
./cli.sh plugin create
pnpm --filter @devtoolbox/plugin-market-<id> build
node marketplace/scripts/pack-local.mjs market-<id>
```

