# Architecture

[English](architecture.md) | [简体中文](../zh-CN/development/architecture.md)

This page is the contributor-facing map of DevToolBox. It combines the process model, repository layout, extension discovery, IPC conventions, and security boundaries that previously lived in several separate documents.

## System overview

DevToolBox is an Electron application with a React renderer. Privileged work stays outside the web UI and crosses a typed preload boundary.

```text
Built-in React tool
        |
        v
React renderer -> window.electronAPI -> preload -> IPC handler -> operating system

Marketplace plugin iframe
        |
        v
postMessage -> PluginHost -> window.electronAPI -> Marketplace IPC -> capability broker
```

| Layer          | Location              | Responsibility                                                                          |
| -------------- | --------------------- | --------------------------------------------------------------------------------------- |
| Main process   | `core/main/`          | Windows, native dialogs, files, networking, storage, child processes, and IPC handlers  |
| Preload bridge | `core/main/preload/`  | Small, explicit API exposed through `contextBridge`                                     |
| Renderer       | `core/renderer/`      | React application, navigation, built-in tools, Marketplace UI, themes, and localization |
| Shared core    | `core/packages/core/` | Manifest, registry, permission, installed-plugin, and Electron IPC contracts            |
| Shared UI      | `core/packages/ui/`   | Reusable UI components and hooks                                                        |
| Marketplace    | `marketplace/`        | Plugin sources, shared browser SDK, build configuration, and packaging scripts          |

## Repository layout

```text
core/
  main/                         Electron main process, services, and preload bridge
    marketplace/                Registry, repository, installer, and capability services
  packages/                     Shared core, plugin SDK, and UI packages
  renderer/                     React application and built-in tools
docs/                            MkDocs content
docs-site/                       MkDocs configuration
marketplace/
  modules/                       Marketplace plugin sources
  scripts/                       Registry and package builders
  shared/                        Shared Marketplace Vite configuration
scripts/                         Repository validators and scaffolding
cli.sh / cli.ps1                 Unified contributor CLI entry points
```

## Process boundaries

### Main process

The main process is the trust boundary for privileged operations. It registers application-level IPC in `core/main/ipc/` and discovers built-in tool handlers from `core/main/modules/*.ts`.

Handlers must validate input, return serializable values, and avoid exposing arbitrary filesystem paths or command execution. Shared sensitive behavior belongs in main-process helpers rather than being reimplemented by individual tools.

The main window uses platform-native window behavior: macOS starts in fullscreen, while Windows and Linux start maximized so native minimize, maximize, and close controls remain visible.

### Preload bridge

`core/main/preload/index.ts` maps approved IPC operations onto `window.electronAPI`. The canonical `ElectronAPI` and invoke contracts live in `core/packages/core/src/electron-api.ts`; `core/renderer/types/electron.d.ts` only attaches that shared type to `window`.

Adding a privileged operation requires all three layers:

1. Register and validate the handler in the main process.
2. Add the channel arguments and result to the shared invoke contract.
3. Expose a narrow method from the preload bridge and call it from the renderer.

The renderer must not import Electron modules or call raw IPC channels directly.

### Renderer

The renderer owns presentation and application state. It may use browser APIs and the preload bridge, but must treat responses from privileged operations as untrusted results that can fail.

`ToolsPage` is also the renderer's fault-containment boundary. Each lazily loaded React tool and iframe host is wrapped independently, so an import failure or render exception produces a retryable tool-level error state instead of replacing the whole workspace. Long-running transformations must discard stale results and cancel Workers, timers, and listeners when a newer operation starts or the tool unmounts.

## Built-in tool discovery

Built-in tools live under `core/renderer/components/ModuleTools/<ToolName>/`. Vite discovers their `manifest.json` files and React entries with `import.meta.glob` in `core/renderer/data/placeholder.ts`.

The manifest selects one of two entry models:

- A `.tsx` entry is loaded lazily as a React component.
- An `.html` entry is served as an isolated built-in web entry.

English and Simplified Chinese locale files are discovered separately by the renderer i18n layer. Categories are fixed by `categoryDefs` in `core/renderer/data/placeholder.ts`; manifests assign tools to those categories.

See [Built-in Tool Development](tools.md) for the manifest and authoring workflow.

## Marketplace runtime

A Marketplace package contains a root `manifest.json` and a web entry. Installed assets are served from a per-plugin `devtoolbox-plugin://<plugin-id>/...` origin and run inside a sandboxed iframe; they do not receive Electron or Node.js APIs.

Requests follow this path:

1. The plugin SDK sends a versioned `postMessage` request.
2. `PluginHost` verifies both the iframe window and its bound plugin origin.
3. The renderer maps the SDK method to an approved preload method.
4. The main process verifies the plugin manifest, permission, parameters, and resource policy.
5. A structured success or error response returns to the iframe.

Marketplace startup has a separate readiness handshake. `mountPlugin` emits `devtoolbox:plugin:ready` only after the first React tree commits and retries until `PluginHost` acknowledges it. The host keeps the iframe behind a loading state until that signal arrives; startup timeout and load errors produce a reload action. Ordinary built-in HTML entries remain compatible and become ready on their iframe `load` event because they are not required to use the Marketplace SDK.

Plugin storage is namespaced by plugin ID. File access uses user-selected tokens. Proxied HTTP requests enforce domain allowlists, DNS/private-address checks, redirect validation, timeouts, and response-size limits.

Main-process Marketplace responsibilities are intentionally separated:

- `registry-client.ts` retrieves, validates, and caches registries.
- `plugin-repository.ts` validates and persists installed-plugin state.
- `plugin-installer.ts` verifies archives, extracts into an isolated staging directory, and activates a validated version with rollback support.
- `provenance.ts` verifies signed artifact identity, source revision, trusted publisher scope, and Ed25519 signatures before download or extraction.
- `capability-broker.ts` rechecks enabled state, permissions, parameters, storage quotas, file tokens, and network policy for every privileged SDK call.
- `ipc/marketplace.ts` constructs these services and registers only the public Marketplace operations.

Package provenance is evaluated before an archive is downloaded. The signed statement binds the plugin identity and privileged manifest fields to the ZIP SHA-256, exact size, publication time, source repository, source revision, publisher, and key ID. A trusted key can be limited to explicit plugin IDs and source repositories. Invalid signatures and trusted-publisher scope violations are rejected in every mode.

`core/main/marketplace/trusted-publishers.json` controls rollout. The official public key is enrolled with exact plugin-ID and source-repository scopes. `audit` mode continues to install legacy unsigned packages while persisting and displaying them as unsigned or untrusted; verified packages retain their publisher and source revision in installed state. `strict` mode accepts only signatures from an enrolled publisher key. This allows the enrolled signing key to be distributed before strict enforcement is enabled, without silently treating an attached but invalid signature as trustworthy.

The release packer refuses to use a private key unless its derived public key, fingerprint, publisher, plugin ID, and source repository are already enrolled. A separate release verifier then checks every emitted ZIP hash, size, scope, and signature against the application trust store before upload.

The Plugin SDK keeps source entry points for workspace development and generates a standalone npm package under `core/packages/plugin-sdk/dist/`. Marketplace production builds create and bundle this release output. CI also loads the production preload in a hidden Electron window to verify that `contextBridge` and typed IPC work in the packaged runtime configuration.

See [Plugin Development](plugins.md) for the manifest, permissions, SDK, and package lifecycle.

## Local diagnostics and privacy

DevToolBox does not send runtime telemetry to a remote service. Unexpected main-process, Renderer, tool, and plugin events flow through the typed diagnostics IPC and are retained only under the local application data directory.

The main-process `DiagnosticStore` applies the following controls before persistence:

- recursively removes credential-like fields, authorization values, cookies, content/body/payload fields, private keys, URL credentials, and unstructured plugin detail strings;
- replaces the current user's home-directory prefix with `~` in messages and stack traces;
- limits nesting, collection sizes, string lengths, the event ring to 500 entries, and the serialized store to 512 KiB;
- limits each source/scope pair to 120 events per minute and counts discarded events;
- writes the store atomically with owner-only file permissions where the filesystem supports them.

Users can inspect recent redacted events under **Settings → Diagnostics**, clear the local store, or explicitly export a JSON support bundle. The bundle contains application/runtime versions, non-identifying platform metadata, retention counters, the current startup/safe-mode state, and the already-redacted events. The generated context excludes usernames, hostnames, IP addresses, environment variables, and local-storage contents.

Diagnostic contracts live in `core/packages/core/src/electron-api.ts`, storage and redaction in `core/main/diagnostics.ts`, IPC/export in `core/main/ipc/diagnostics.ts`, and Renderer capture in `core/renderer/lib/diagnostics.ts`.

## Startup health and safe mode

The main process writes an atomic startup-health marker before creating the application window. A startup remains incomplete until the Renderer has stayed mounted for five seconds and calls the typed `startup:rendererReady` IPC method. A normal quit marks the session clean even when it occurs during that initial window.

If two consecutive sessions end while still marked `starting`, the third launch enters safe mode automatically. Safe mode applies defense in depth for the current session:

- Marketplace modules are omitted from tool categories, global search, and iframe hosts.
- The `devtoolbox-plugin://` protocol refuses plugin assets.
- The main-process capability broker rejects every plugin SDK operation with `safe_mode`.
- Built-in tools, Settings, the Module Center, and diagnostic export remain available.

Safe mode never rewrites an installed plugin's persistent `enabled` flag. Users can inspect or uninstall plugins, export diagnostics, and restart normally from the global recovery banner or **Settings → Diagnostics**. The same page can request a one-shot safe-mode restart manually when troubleshooting. A healthy safe-mode session clears the crash sequence so the following ordinary launch starts normally.

The state machine lives in `core/main/startup-health.ts`; IPC and relaunch control live in `core/main/ipc/startup.ts`. Unit tests cover incomplete starts, health confirmation, clean exits, automatic isolation, and manual safe/normal restarts.

## Build boundaries and release metadata

Renderer pages and built-in tools use dynamic imports so the dashboard does not preload every workspace, editor language, or transformation engine. Vite emits `dist/.vite/manifest.json`; `pnpm bundle:check` follows the entry's static imports and applies separate budgets to initial assets, ordinary lazy chunks, and the explicitly isolated barcode and JavaScript-obfuscation engines. Do not hide a regression by increasing a budget without first checking the manifest dependency graph.

Marketplace modules follow the same rule. Their shared Vite configuration emits a manifest into each `package/` directory, and `pnpm -C marketplace build` finishes by validating every plugin's initial JavaScript, CSS, ordinary chunks, and explicitly approved large data chunks.

The production Renderer smoke test loads `dist/index.html` through the real sandboxed preload bridge with isolated test data. It navigates lazy pages, verifies selectable text and JSON output, checks the offline Markdown preview, executes JavaScript obfuscation in its Worker, and renders PDF417 through the delayed barcode engine. Console errors, preload failures, renderer exits, missing chunks, and interaction timeouts fail CI.

`pnpm supply-chain:generate` reads the installed production dependency tree, rejects missing or disallowed licenses, and writes a CycloneDX SBOM plus `THIRD_PARTY_NOTICES.md`. Packaging runs build, bundle validation, and metadata generation as one preparation step. Release workflows also publish those files and a `SHA256SUMS` list; the Plugin SDK and Marketplace release paths generate checksums for their own artifacts.

## IPC conventions

Use these rules for both built-in and Marketplace operations:

- Expose capability-focused methods instead of general command or path access.
- Validate every value again in the main process; renderer validation is only for user experience.
- Keep channel registration in main-process code and bridge calls in preload code.
- Prefer a structured result over throwing across process boundaries.
- Remove listeners during React cleanup and scope event streams to their owning window or session.
- Never put secrets, file contents, or full request bodies in routine logs.

The built-in MQTT tool is an example of a stateful IPC service. Its main-process handler owns connections and emits `mqtt:event` updates; the renderer only calls the typed connect, subscribe, publish, and disconnect methods.

## Security boundaries

- Renderer code must not execute arbitrary commands.
- File reads and writes must follow an explicit user action or a previously issued token.
- External URLs and network targets must be validated in the main process.
- Marketplace permissions are declarations, not trust: every SDK call is checked at runtime.
- A plugin iframe must not call internal IPC or preload methods directly.
- Main-window navigation is restricted to the configured Vite origin in development and the packaged Renderer entry document in production; popups and cross-origin redirects are denied.
- The main Renderer uses a restrictive Content Security Policy. Render generated rich text or syntax markup through `components/SafeHtml`; architecture lint rejects direct `dangerouslySetInnerHTML` use elsewhere.
- Development and packaged builds keep Chromium web security enabled; local registries are handled by explicit main-process exceptions.
- Keep the preload surface minimal; do not expose raw `ipcRenderer`.

Security-sensitive changes should also follow the repository [Security Policy](https://github.com/jacobs-256/devToolBox/blob/main/SECURITY.md).

## Where to make a change

| Change                          | Primary location                                                           |
| ------------------------------- | -------------------------------------------------------------------------- |
| Built-in tool UI or logic       | `core/renderer/components/ModuleTools/<ToolName>/`                         |
| Application navigation or pages | `core/renderer/components/`                                                |
| Sanitized generated HTML         | `core/renderer/components/SafeHtml/`                                       |
| Themes and shared styles        | `core/renderer/theme/`                                                     |
| Shared React primitives         | `core/packages/ui/`                                                        |
| Native or privileged operation  | `core/main/ipc/` or `core/main/modules/`, plus preload and renderer typing |
| Marketplace lifecycle/security  | `core/main/marketplace/` and `core/main/ipc/marketplace.ts`                |
| Plugin iframe message bridge    | `core/renderer/components/PluginHost/`                                     |
| Diagnostics, redaction, export  | `core/main/diagnostics.ts`, `core/main/ipc/diagnostics.ts`, and Settings   |
| Startup health and safe mode    | `core/main/startup-health.ts`, `core/main/ipc/startup.ts`, and `App.tsx`   |
| Plugin source                   | `marketplace/modules/<market-id>/`                                         |
| Manifest or scaffold validation | `scripts/`                                                                 |
