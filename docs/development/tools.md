# Built-in Tool Development

[English](tools.md) | [简体中文](../zh-CN/development/tools.md)

Built-in tools ship with DevToolBox and are discovered from their manifests. This guide covers the complete workflow from scaffolding through validation.

For source setup and repository commands, start with [Getting Started](../getting-started.md). For process boundaries, read [Architecture](architecture.md).

## Create a tool

Use the generator rather than copying an existing module:

```bash
pnpm new:tool
```

For a non-interactive scaffold:

```bash
pnpm new:tool TimestampConverter --category dev-tools
```

Available options:

```text
--category <categoryId>
--id <moduleId>
--name <displayName>
--description <description>
--with-help
```

`./cli.sh tool new` opens the same generator through the repository CLI.

## Module structure

The generated module lives at `core/renderer/components/ModuleTools/<ToolName>/`:

```text
<ToolName>/
├── manifest.json
├── index.tsx
├── <ToolName>.module.css
└── locales/
    ├── en.ts
    └── help-en.md             optional
```

Only three items are required: a valid manifest, its declared entry, and `locales/en.ts`. CSS Modules and help content are optional.

## Manifest

Example:

```json
{
  "id": "core-timestamp-converter",
  "name": "Timestamp Converter",
  "description": "Convert timestamps and formatted dates",
  "sdkVersion": "core",
  "entry": "./index.tsx",
  "categoryId": "dev-tools",
  "author": "DevToolBox",
  "iconKey": "vsc:VscClock",
  "permissions": []
}
```

The runtime interface is `CoreToolManifest` in `core/renderer/data/placeholder.ts`.

| Field         | Requirement                                                                           |
| ------------- | ------------------------------------------------------------------------------------- |
| `id`          | Unique, stable, kebab-case, and prefixed with `core-`                                 |
| `name`        | English fallback display name                                                         |
| `description` | English fallback summary                                                              |
| `sdkVersion`  | Exactly `core` for a built-in tool                                                    |
| `entry`       | Existing `.tsx` or `.html` file inside the module directory                           |
| `categoryId`  | One of `dev-tools`, `text-tools`, `network-tools`, `security-tools`, or `other-tools` |
| `iconKey`     | Optional registered icon key, normally from the `vsc:` set                            |
| `permissions` | Array reserved for declared capabilities; use an empty array when none are needed     |

The validator rejects entries that escape the module directory, unknown categories, missing English locale files, and duplicate IDs.

## Entry types

### React entry

Most tools use `./index.tsx` and default-export a React component. The renderer loads it lazily and places it inside the shared application shell.

Use components and hooks from `core/packages/ui` where they match the interaction. Keep tool-specific state and formatting inside the module rather than extending global application state.

The application catches lazy-import and render failures at the individual tool boundary and offers retry/close actions. Tools still own their internal lifecycle: cancel Workers and requests when superseded, remove global listeners during cleanup, and guard asynchronous state updates so an older operation cannot overwrite a newer result.

Unhandled render failures are recorded automatically in the local diagnostic stream. For an unexpected recoverable failure that does not reach the boundary, call the shared Renderer diagnostic helper with a stable tool scope and a short operational message. Never attach editor input, generated keys, file contents, HTTP bodies, or user credentials; main-process redaction is a final safeguard, not permission to collect them.

### Isolated HTML entry

A manifest may point to an `.html` file for a web-style isolated entry. Use this only when the tool cannot reasonably share the React application runtime. An ordinary built-in React tool should prefer `.tsx`.

## Localization and help

Every module needs `locales/en.ts`. Put visible labels, actions, placeholders, fallback name, and fallback description there instead of hardcoding them in JSX.

Add other supported locales beside the English file, following existing modules. When `--with-help` is used, the generator also creates `locales/help-en.md`; keep long instructions and examples there instead of crowding the tool UI.

The manifest's English `name` and `description` remain required because they are stable fallback metadata outside the React translation lifecycle.

## UI conventions

- Use `ToolSection` as the top-level tool container for consistent title, spacing, and actions.
- Use `ResponsiveActions` when several actions must collapse on narrow layouts.
- Use `useSplitPane` for resizable two-pane layouts rather than implementing drag behavior again.
- Use `useTextSearch` with `SearchBar` for Ctrl/Cmd+F inside editors, output, or logs.
- Use theme variables from `core/renderer/theme/variables.css`; do not hardcode a second palette.
- Keep the primary action obvious and group destructive actions separately.
- Verify the tool in both light and dark themes and at narrow window widths.

The complete token and component guidance is in [Design System](design-system.md).

## Add privileged behavior

Browser-only tools do not need IPC. When native behavior is necessary:

1. Add a narrowly scoped application handler in `core/main/ipc/`, or a tool-specific handler in `core/main/modules/`.
2. Validate arguments and enforce security constraints in the handler.
3. Expose a method from `core/main/preload/index.ts`.
4. Add its signature to `core/renderer/types/electron.d.ts`.
5. Call the typed `window.electronAPI` method and handle unavailable/error results.

Do not expose raw IPC channels, arbitrary commands, or unrestricted paths. See [Architecture](architecture.md#ipc-conventions) for the boundary rules.

## Validate the change

Run the focused manifest check while iterating:

```bash
pnpm lint:modules
```

Before opening a pull request, run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

For UI changes, manually verify the normal, empty, loading, error, and overflow states. Include screenshots or a recording in the pull request when the behavior is visual.

## Completion checklist

- The manifest ID is stable and the category is valid.
- All visible strings are localized, with English present.
- The tool uses shared layout and theme primitives where appropriate.
- Privileged operations cross the typed preload boundary.
- Error and empty states are understandable.
- Module lint, type-check, tests, and build pass.
