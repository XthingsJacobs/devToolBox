# Contributing

Thanks for contributing to DevToolBox.

## Development Environment

- Node.js 20+
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

- [dev-guide.md](./dev-guide.md)
- [module-api.md](./module-api.md)
- [ui-guidelines.md](./ui-guidelines.md)
- [ipc-api.md](./ipc-api.md)
- [codebase.md](./codebase.md)
- Marketplace plugin SDK: [plugin-sdk.md](./plugin-sdk.md)

You can also generate a starter template:

```bash
pnpm new:tool
pnpm new:tool TimestampConverter --category dev-tools
```
