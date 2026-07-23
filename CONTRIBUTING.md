# Contributing

Thanks for contributing to DevToolBox.

Use [Getting Started](./docs/getting-started.md) for installation, repository CLI, packaging, and troubleshooting. This page defines the contribution workflow and review expectations.

## Development Environment

- Node.js 20+
- pnpm 10+
- macOS / Windows / Linux are supported for development (packaging requires the target OS)

## Run Locally

```bash
pnpm install
./cli.sh dev
```

On Windows PowerShell:

```powershell
pnpm install
.\cli.ps1 dev
```

## Quality Gates

Run the standard checks before opening a pull request:

```bash
./cli.sh check
pnpm lint:docs
pnpm build
pnpm bundle:check
pnpm test:renderer
pnpm test:electron
```

Use `pnpm format` only when you intend to rewrite files; use `pnpm format:check` for a read-only formatting check.

## PR Guidelines

- Base branch: `main`
- Workflow: fork from `main` → create a focused feature branch → open a PR back to `main`
- Keep each PR focused (one feature / one refactor / one bug fix).
- Write all Git commit messages in English, preferably using concise Conventional Commit style.
- Do not commit secrets (tokens, private keys, certificates).
- For UI changes, include screenshots or screen recordings when possible.

## Choose the Right Guide

| Change                          | Start here                                                      | Scaffold command         |
| ------------------------------- | --------------------------------------------------------------- | ------------------------ |
| Built-in tool                   | [Built-in Tool Development](./docs/development/tools.md)        | `./cli.sh tool new`      |
| Independently packaged plugin   | [Marketplace Plugin Development](./docs/development/plugins.md) | `./cli.sh plugin create` |
| Main, preload, renderer, or IPC | [Architecture](./docs/development/architecture.md)              | —                        |
| Shared visual behavior          | [Design System](./docs/development/design-system.md)            | —                        |

Changes to the shared Plugin SDK must also pass its release-package checks:

```bash
pnpm --filter @devtoolbox/plugin-sdk typecheck
pnpm --filter @devtoolbox/plugin-sdk build
pnpm --filter @devtoolbox/plugin-sdk pack:check
```

## Documentation Changes

- Update the smallest authoritative page and link to it instead of copying the same instructions elsewhere.
- Keep GitHub-discovered community files (`CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, and `SUPPORT.md`) at the repository root.
- Update [Project and Community](./docs/project/governance.md) for roadmap or governance changes.

### Translation Structure

- English is the default documentation language and remains directly under `docs/` so existing URLs stay stable.
- Each additional language uses a BCP 47 locale directory such as `docs/zh-CN/` and mirrors the English relative paths.
- Keep code, commands, manifest fields, file paths, permission names, and error codes unchanged in translations.
- When an English page changes, update every available translation in the same pull request or explicitly record the translation as pending.
- To add a language, create its mirrored directory, add page-level language links, and add one matching navigation group to `docs-site/mkdocs.yml`.
- Run `pnpm lint:docs` to verify translation mirrors, language switches, local links, page structure, and navigation coverage.
