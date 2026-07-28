# Project and Community

[English](governance.md) | [简体中文](../zh-CN/project/governance.md)

GitHub-discovered community policies live at the repository root. Those root files are canonical; the documentation site links to them instead of maintaining duplicate copies. Project direction and release information live in this section of the documentation.

## Contribute

Read the [Contributing Guide](https://github.com/XthingsJacobs/devToolBox/blob/main/CONTRIBUTING.md) for environment requirements, quality gates, pull-request expectations, and extension workflows.

Technical starting points:

- [Getting Started](../getting-started.md)
- [Architecture](../development/architecture.md)
- [Built-in Tool Development](../development/tools.md)
- [Marketplace Plugin Development](../development/plugins.md)
- [Design System](../development/design-system.md)

## Community standards

- [Code of Conduct](https://github.com/XthingsJacobs/devToolBox/blob/main/CODE_OF_CONDUCT.md): expected contributor behavior and private reporting guidance.
- [Support](https://github.com/XthingsJacobs/devToolBox/blob/main/SUPPORT.md): where to ask questions and what to include in a bug report.
- [Security Policy](https://github.com/XthingsJacobs/devToolBox/blob/main/SECURITY.md): supported versions, private vulnerability reporting, and security boundaries.

Do not open a public issue for a suspected security vulnerability.

## Roadmap

DevToolBox is evolving as a plugin-first, all-in-one desktop toolbox for general developers.

### Now: stabilize and improve adoption

- Improve the first-run, installation, update, and diagnostics experience.
- Harden Marketplace registry and plugin installation reliability.
- Back up the enrolled Marketplace signing key, configure the release secret, and complete the audit-to-strict rollout.
- Publish clear plugin-authoring tutorials and best practices.
- Curate a small set of high-quality reference plugins.

### Next: grow the plugin ecosystem

- Add a gallery with screenshots, tags, and better discovery.
- Establish plugin submission validation, review checklists, and CI helpers.
- Document community publisher enrollment and signing-key rotation.
- Expand shared plugin UI primitives and internationalization helpers.

### Later: support larger workflows

- Add collections, saved presets, and export-oriented workflow tools.
- Explore optional shared workspace synchronization for teams.
- Expand network diagnostics and protocol tooling through plugins.

### How to help

- Pick a `good first issue` or `help wanted` issue.
- Propose a plugin idea through a feature request.
- Build a plugin and submit it for inclusion in the gallery.

Good first Marketplace issues should be narrow, reproducible, and reviewable without private services. Useful examples:

- Add screenshots, localized descriptions, or clearer permission notes for an existing plugin.
- Convert a small public API into a read-only plugin with one documented `httpDomains` entry.
- Add missing `plugin doctor` guidance to an example or troubleshooting page.
- Improve a plugin's empty, loading, error, and permission-denied states.
- Add tests or fixture manifests that cover one validation edge case.

## Releases and legal

- [Changelog](changelog.md)
- [GitHub Releases](https://github.com/XthingsJacobs/devToolBox/releases)
- [Notice](notice.md)
- [Apache-2.0 License](https://github.com/XthingsJacobs/devToolBox/blob/main/LICENSE)

## Documentation ownership

The MkDocs source is organized by reader task:

```text
docs/
├── index.md
├── getting-started.md
├── development/
│   ├── architecture.md
│   ├── tools.md
│   ├── plugins.md
│   └── design-system.md
├── project/
    ├── governance.md
    ├── changelog.md
    └── notice.md
└── zh-CN/                       Simplified Chinese mirror with the same paths
```

When implementation changes, update the smallest authoritative page and link to it rather than copying the same instructions into several pages. Keep executable files such as manifests, shared types, `package.json`, `cli.sh`, and `cli.ps1` as the final source of truth.
