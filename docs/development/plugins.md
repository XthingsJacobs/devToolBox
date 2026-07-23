# Marketplace Plugin Development

[English](plugins.md) | [简体中文](../zh-CN/development/plugins.md)

Marketplace plugins are independently packaged web applications that run inside isolated iframes. This guide combines plugin creation, manifests, permissions, local packaging, and installation into one workflow. Use [Plugin SDK Reference](plugin-sdk.md) for the full callable API surface.

## Runtime model

- Source lives under `marketplace/modules/<market-id>/`.
- Vite produces a self-contained web entry in the plugin's `package/` directory.
- The distributable ZIP contains `manifest.json` at its root plus the declared entry directory.
- The host loads the installed entry in a sandboxed iframe.
- Privileged work uses request/response messages through the host SDK; plugins do not receive Electron or Node.js APIs.
- Compatibility is identified by `sdkVersion` in the manifest.

The host passes the active theme and locale to the iframe. `mountPlugin` from `@devtoolbox/plugin-sdk/react` applies theme changes automatically; pass `{ locale: true }` when the plugin also handles `en` and `zh-CN` locale changes.

`mountPlugin` also owns the host readiness handshake. It announces the plugin only after React commits successfully and retries until the host acknowledges it. Do not add a second ready loop to `index.html`. If startup does not complete within eight seconds, the host shows a timeout state and lets the user rebuild the iframe with **Reload plugin**.

When the application is in safe mode, Marketplace iframe assets and all SDK capabilities are unavailable for that session. The plugin remains installed and its persistent enabled setting is unchanged. Use **Settings → Diagnostics** to return to normal mode after reviewing or removing the suspected plugin.

## Create a plugin

Run the interactive generator from the repository root:

```bash
./cli.sh plugin create
```

Plugin IDs must be kebab-case and start with `market-`, for example `market-json-query`. The generator creates:

```text
marketplace/modules/market-json-query/
├── manifest.json
├── package.json
├── index.html
├── tsconfig.json
└── src/
    ├── App.tsx
    ├── main.tsx
    └── style.css
```

Generated plugins consume `@devtoolbox/plugin-sdk` and share these repository-level build files instead of copying infrastructure:

- `core/packages/plugin-sdk/src/index.ts`
- `core/packages/plugin-sdk/src/react.tsx`
- `marketplace/shared/vite.config.ts`
- `marketplace/tsconfig.plugin.json`

Install workspace dependencies after creating a plugin if its package has not yet been added to the lockfile:

```bash
pnpm install
```

Workspace development resolves the SDK source directly. `pnpm -C marketplace build` first creates the SDK release output and then makes Vite bundle that compiled output into every plugin, so the same package entry points are exercised before publication.

If a plugin creates Workers, subscriptions, observers, or timers, release them from the owning React effect. Async actions should ignore stale responses after a newer request starts; iframe reload destroys the document but should not be the normal cleanup mechanism.

### Build and release the Plugin SDK

The SDK source package is private to prevent accidentally publishing TypeScript workspace files. Build the standalone npm directory and validate all exports with:

```bash
pnpm --filter @devtoolbox/plugin-sdk typecheck
pnpm --filter @devtoolbox/plugin-sdk build
pnpm --filter @devtoolbox/plugin-sdk pack:check
npm pack ./core/packages/plugin-sdk/dist
```

The generated declarations are self-contained and do not depend on `@devtoolbox/core`. The repository-only `contract-check.ts` still verifies that SDK methods, errors, results, and host responses exactly match the main application contract.

Maintainers publish through the manually dispatched **Plugin SDK Release** workflow. It always uploads the npm tarball for inspection and publishes only when its `publish` input is enabled.

## Manifest

Example:

```json
{
  "id": "market-json-query",
  "name": "JSON Query",
  "description": "Query and transform JSON documents",
  "version": "0.1.0",
  "sdkVersion": "1.0",
  "entry": "package/index.html",
  "categoryId": "dev-tools",
  "author": "Example Author",
  "license": "Apache-2.0",
  "homepage": "https://example.com/json-query",
  "repository": "https://github.com/example/json-query",
  "permissions": ["storage:kv", "http:proxy"],
  "httpDomains": ["api.example.com"]
}
```

The canonical TypeScript contract is `MarketplacePluginManifest` in `core/packages/core/src/index.ts`.

| Field                                         | Requirement                                                                      |
| --------------------------------------------- | -------------------------------------------------------------------------------- |
| `id`                                          | Unique kebab-case ID prefixed with `market-`; it must match the module directory |
| `name`, `description`                         | English fallback metadata                                                        |
| `version`                                     | Plugin package version                                                           |
| `sdkVersion`                                  | Host SDK compatibility version; current templates use `1.0`                      |
| `entry`                                       | Built web entry, normally `package/index.html`                                   |
| `categoryId`                                  | Application category such as `dev-tools` or `network-tools`                      |
| `author`, `license`, `homepage`, `repository` | Required package ownership and provenance fields                                 |
| `permissions`                                 | Non-empty list of requested capabilities                                         |
| `httpDomains`                                 | Required when `http:external` or `http:proxy` is declared                        |

Optional fields include localized metadata, icon information, tags, keywords, minimum application version, maintainers, environment allowlists, and deprecation metadata.

## Permissions

Declaring a permission does not grant general access. The host checks the installed plugin manifest on every privileged call.

| Permission                             | Capability                                   | Status                                          |
| -------------------------------------- | -------------------------------------------- | ----------------------------------------------- |
| `http:proxy`                           | Host-mediated HTTP request                   | Implemented as `sdk.http.request`               |
| `http:external`                        | Declares direct external browser traffic     | Recognized; browser CORS still applies          |
| `storage:kv`                           | Namespaced key-value storage                 | Implemented as `sdk.storage`                    |
| `fs:dialog`                            | User-initiated open/save dialogs             | Implemented by host methods                     |
| `fs:read`, `fs:write`                  | Read/write a token returned by a dialog      | Implemented by host methods                     |
| `system:getInfo`                       | Platform and runtime information             | Implemented as `sdk.system.getInfo`             |
| `system:notifications`                 | Native notification                          | Implemented as `sdk.system.notify`              |
| `system:openExternal`                  | Open an approved URL externally              | Implemented by a host method                    |
| `system:revealPath`, `system:openPath` | Reveal or open a tokenized path              | Implemented by host methods                     |
| `system:env:read`                      | Read explicitly allowlisted environment keys | Implemented by a host method and `envAllowlist` |
| `bluetooth`, `serial`, `usb`           | Hardware integrations                        | Reserved/experimental; no stable host API yet   |

Request only the capabilities the plugin actually uses. A future or reserved permission is not evidence that a method is available.

## Network policy

Use `sdk.http.request` when an API does not support browser CORS, requires controlled headers, or should use host-level auditing. A plugin using it must declare `http:proxy` and an `httpDomains` allowlist.

Allowed domain forms:

- Exact hostname: `api.example.com`
- Single-level wildcard: `*.example.com` matches `a.example.com`, but not `a.b.example.com`

Rejected forms include `*`, multi-level wildcards, schemes, paths, raw IP addresses, localhost, and private network targets.

The main process allows HTTPS targets only, rechecks the allowlist after redirects, and rejects DNS results that resolve to private or local addresses. It also enforces a timeout, redirect limit, and response-size limit. Local development registries may use `file://`, but packaged registry and plugin downloads require HTTPS; this does not weaken plugin HTTP target validation.

## Plugin SDK reference

This page intentionally keeps SDK details short. The full reference is [Plugin SDK Reference](plugin-sdk.md), which documents every SDK namespace, method name, permission, parameter, return value, timeout, limit, and error code.

Common plugin code imports the convenience client:

```ts
import { sdk } from '@devtoolbox/plugin-sdk';
```

Use `sdk.http`, `sdk.storage`, `sdk.system`, and `sdk.log` for common capabilities. Use `callSdk` only for approved lower-level methods such as file-token operations:

```ts
import { callSdk } from '@devtoolbox/plugin-sdk';

const selected = await callSdk<{ items: Array<{ fileToken: string; name: string }> }>('fs.openFileDialog', {
  filters: [{ name: 'JSON', extensions: ['json'] }],
});
```

Every SDK call resolves to `SdkResult<T>` and should branch on `ok` before reading `data`.

## Develop and build

Run one plugin in Vite development mode:

```bash
pnpm --filter @devtoolbox/plugin-market-json-query dev
```

Build it:

```bash
pnpm --filter @devtoolbox/plugin-market-json-query build
```

The manifest entry expects output in `package/`. Treat that directory as generated content.

## Pack and install locally

The shortest workflow builds the plugin, creates a ZIP, and updates the local registry:

```bash
./cli.sh plugin market-json-query
```

To package all local plugins:

```bash
./cli.sh plugin all
```

The lower-level packer is also available after building:

```bash
node marketplace/scripts/pack-local.mjs market-json-query
```

Generated files:

- `marketplace/registry.local.json`
- `marketplace/.local-dist/<plugin>-<version>.zip`

Local packages are unsigned by default. The application runs Marketplace provenance in audit mode during the migration period and labels a newly installed local package as **Unsigned**. An attached signature that claims a trusted publisher but fails verification is rejected even in audit mode.

In DevToolBox:

1. Open **Settings**.
2. Set **Marketplace Registry URL** to the generated `file:///.../marketplace/registry.local.json` URL.
3. Open **Modules -> Marketplace** and refresh.
4. Install the plugin and test its declared capabilities.

## Validate a plugin

Run the focused checks while iterating:

```bash
pnpm -C marketplace lint
pnpm -C marketplace typecheck
pnpm -C marketplace build
```

The root `pnpm lint:modules` command also validates Marketplace IDs, required manifest fields, permissions, domain rules, and duplicate IDs.

Before publishing, confirm that the ZIP contains only the required manifest and web assets, the manifest version matches the package, and every requested permission is exercised by visible plugin behavior.

## Sign and trust release packages

DevToolBox uses Ed25519 package provenance. The signed statement binds the package SHA-256 and exact size to its plugin identity, privileged manifest fields, publication timestamp, source repository, source commit, publisher, and key ID. The private key is used only by the release packer; the application contains only explicitly trusted public keys.

The official `devtoolbox-official` public key is enrolled in audit mode with fingerprint `sha256-27d34403da3feda5439b477441d9ae8af076e91252a84fd335a0d721ece729f6`. Its scope is restricted to the four official Marketplace plugins in this repository. The corresponding private key is intentionally excluded from Git and must remain in the project owner's secret storage.

For a new publisher or a planned key rotation, generate a key once in a secure local environment:

```bash
pnpm -C marketplace run signing:keygen -- \
  --publisher devtoolbox-official \
  --repository https://github.com/XthingsJacobs/devToolBox
```

The command writes an ignored `marketplace/.signing/` directory with owner-only permissions for the private key. Never commit or upload `private-key.pk8.base64` as a build artifact. Back it up using the project's secret-management process.

To enroll the public key:

1. Copy the object from `marketplace/.signing/trusted-publisher.json` into the `publishers` array in `core/main/marketplace/trusted-publishers.json`.
2. Keep the trust-store mode set to `audit` while existing unsigned releases remain available.
3. Store the contents of `private-key.pk8.base64` in the GitHub Actions secret `MARKETPLACE_SIGNING_PRIVATE_KEY_BASE64`.
4. Publish and verify signed registry entries. Installed cards should show **Verified · devtoolbox-official** with the expected repository and revision.
5. Set the repository variable `MARKETPLACE_REQUIRE_SIGNATURES` to `true`, then change the bundled trust-store mode to `strict` in the next application release.

The release job also runs `marketplace/scripts/verify-release.mjs`. It rehashes each ZIP and independently verifies the signature, public-key fingerprint, plugin scope, and source repository against the bundled trust store before any release asset is uploaded.

The release workflow derives source repository, commit, and workflow URL from GitHub Actions. For a signed local pack, provide the equivalent values explicitly:

```bash
export MARKETPLACE_SIGNING_PRIVATE_KEY_BASE64="$(tr -d '\n' < marketplace/.signing/private-key.pk8.base64)"
export MARKETPLACE_SIGNING_PUBLISHER=devtoolbox-official
export MARKETPLACE_SOURCE_REPOSITORY=https://github.com/XthingsJacobs/devToolBox
export MARKETPLACE_SOURCE_REVISION="$(git rev-parse HEAD)"
pnpm -C marketplace run pack -- --all
```

For key rotation, add the new public key to the trust store and release that application update before changing the signing secret. Keep both scoped keys trusted until packages signed by the previous key are no longer offered, then remove the old key. Reusing a publisher key outside its configured plugin-ID or source-repository scope is rejected.

## Common errors

| Code                | Meaning                                                      |
| ------------------- | ------------------------------------------------------------ |
| `permission_denied` | The installed manifest lacks the required permission.        |
| `not_installed`     | The plugin ID is not present in installed Marketplace state. |
| `plugin_disabled`   | The plugin is installed but currently disabled.              |
| `invalid_params`    | A URL, token, key, or method parameter is invalid.           |
| `quota_exceeded`    | The plugin exceeded its isolated key-value storage quota.    |
| `not_supported`     | The host or platform does not implement the capability.      |
| `timeout`           | The SDK or network request exceeded its deadline.            |
| `network_blocked`   | The destination failed the domain or private-address policy. |
| `too_large`         | The host rejected an oversized response.                     |
| `io_error`          | A filesystem, shell, or other native operation failed.       |
