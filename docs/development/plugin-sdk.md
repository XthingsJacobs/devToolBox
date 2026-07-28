# Plugin SDK Reference

[English](plugin-sdk.md) | [简体中文](../zh-CN/development/plugin-sdk.md)

This reference describes the SDK surface available to Marketplace plugins. Read it with [Marketplace Plugin Development](plugins.md): that guide explains packaging, manifests, registries, signing, and installation; this page focuses on callable APIs, parameters, return values, permissions, and runtime behavior.

## Runtime contract

- Plugins run in a sandboxed iframe and do not receive Electron, Node.js, `ipcRenderer`, or `ipcMain` access.
- The SDK sends `postMessage` requests to the host. The host routes approved requests to fixed `plugin:*` IPC channels.
- Privileged calls are authorized against the installed plugin manifest on every request.
- The canonical SDK method list is `SDK_METHODS` in `core/packages/plugin-sdk/src/index.ts` and `PLUGIN_SDK_METHODS` in `core/packages/core/src/index.ts`.
- Future permissions such as `serial`, `usb`, and `bluetooth` are recognized by manifests but have no stable SDK methods in the current release.

## Result and timeout model

Every SDK call resolves to a discriminated result instead of throwing for host-side failures:

```ts
type SdkError = { code: string; message: string; details?: unknown };

type SdkResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: SdkError };
```

Always branch on `ok` before reading `data`:

```ts
const result = await sdk.storage.get<{ compact: boolean }>('settings');

if (!result.ok) {
  console.error(result.error.code, result.error.message);
  return;
}

const compact = result.data?.compact === true;
```

SDK requests time out after 15 seconds by default. `callSdk(method, params, timeoutMs)` clamps the client timeout to the range `1..60000` milliseconds. HTTP requests also have a host network timeout with a maximum of 30 seconds.

## Quick import

Use the convenience object for common calls:

```ts
import { sdk } from '@devtoolbox/plugin-sdk';
```

Use `callSdk` for approved methods that are not exposed on the convenience object:

```ts
import { callSdk } from '@devtoolbox/plugin-sdk';
```

## Convenience sdk object

| Namespace     | Function                                | Required permission    | Purpose                                  |
| ------------- | --------------------------------------- | ---------------------- | ---------------------------------------- |
| `sdk.http`    | `request<T>(params)`                    | `http:proxy`           | Make a host-mediated HTTPS request.      |
| `sdk.storage` | `get<T>(key)`                           | `storage:kv`           | Read one isolated key.                   |
| `sdk.storage` | `set(key, value)`                       | `storage:kv`           | Write one JSON-serializable value.       |
| `sdk.storage` | `delete(key)`                           | `storage:kv`           | Delete one isolated key.                 |
| `sdk.storage` | `list(prefix?)`                         | `storage:kv`           | List keys, optionally by prefix.         |
| `sdk.storage` | `clear()`                               | `storage:kv`           | Clear this plugin's isolated store.      |
| `sdk.system`  | `getInfo()`                             | `system:getInfo`       | Read basic platform/runtime information. |
| `sdk.system`  | `notify(params)`                        | `system:notifications` | Show a native notification.              |
| `sdk.log`     | `debug/info/warn/error(message, data?)` | none                   | Forward plugin logs to the host.         |

## HTTP API

### `sdk.http.request<T>(params)`

Signature:

```ts
type HttpRequestParams = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  responseType?: 'text' | 'json' | 'arrayBuffer';
};

type HttpResponse<T = unknown> = {
  status: number;
  headers: Record<string, string>;
  data: T;
};

function request<T = unknown>(params: HttpRequestParams): Promise<SdkResult<HttpResponse<T>>>;
```

Parameters:

| Field          | Type                                | Notes                                                             |
| -------------- | ----------------------------------- | ----------------------------------------------------------------- |
| `url`          | `string`                            | Required. Must be HTTPS and match `httpDomains` in the manifest.  |
| `method`       | `string`                            | Optional. Defaults to `GET`; max length is 32 characters.         |
| `headers`      | `Record<string, string>`            | Optional. Max 200 entries; header names max 256 characters.       |
| `body`         | `string`                            | Optional. Use a string body; encode JSON manually when needed.    |
| `timeoutMs`    | `number`                            | Optional. Host clamps network timeout to `1..30000` milliseconds. |
| `responseType` | `'text' \| 'json' \| 'arrayBuffer'` | Optional. Defaults to `text`; `arrayBuffer` returns base64 data.  |

Return value:

| Success data field | Type                     | Notes                                      |
| ------------------ | ------------------------ | ------------------------------------------ |
| `status`           | `number`                 | HTTP response status.                      |
| `headers`          | `Record<string, string>` | Lower-level response headers from `fetch`. |
| `data`             | `T`                      | Text, parsed JSON, or base64 string.       |

Example:

```ts
const result = await sdk.http.request<{ value: string }>({
  url: 'https://api.example.com/value',
  method: 'GET',
  responseType: 'json',
  timeoutMs: 10_000,
});
```

Policy:

- The plugin must declare `http:proxy` and a non-empty `httpDomains` allowlist.
- Host-mediated requests reject plain HTTP, localhost, raw IP targets, private networks, IPv6 targets, and disallowed redirects.
- The response body is limited to 10 MiB.
- JSON parse failures return `invalid_json`.

## Storage API

Storage is namespaced by plugin ID. One plugin cannot read another plugin's store.

| Function                      | Parameters                    | Return type                    | Notes                                                    |
| ----------------------------- | ----------------------------- | ------------------------------ | -------------------------------------------------------- |
| `sdk.storage.get<T>(key)`     | `key: string`                 | `Promise<SdkResult<T>>`        | Missing keys return `null`; use `T \| null` when needed. |
| `sdk.storage.set(key, value)` | `key: string, value: unknown` | `Promise<SdkResult<boolean>>`  | Value must be JSON serializable.                         |
| `sdk.storage.delete(key)`     | `key: string`                 | `Promise<SdkResult<boolean>>`  | Deletes the key if present.                              |
| `sdk.storage.list(prefix?)`   | `prefix?: string`             | `Promise<SdkResult<string[]>>` | Returns sorted keys; prefix max length is 256.           |
| `sdk.storage.clear()`         | none                          | `Promise<SdkResult<boolean>>`  | Clears only the current plugin's namespace.              |

Example:

```ts
await sdk.storage.set('settings', { compact: true });
const settings = await sdk.storage.get<{ compact: boolean }>('settings');
const keys = await sdk.storage.list('setting');
await sdk.storage.delete('settings');
await sdk.storage.clear();
```

Limits:

- Keys must be non-empty strings up to 256 characters.
- Reserved keys `__proto__`, `constructor`, and `prototype` are rejected.
- The serialized store for one plugin is limited to 1 MiB.
- Quota failures return `quota_exceeded` and keep the previous store unchanged.

## System API

### `sdk.system.getInfo()`

Signature:

```ts
type SystemInfo = {
  platform: string;
  arch: string;
  release: string;
  hostname: string;
  node: string;
  electron: string;
};

function getInfo(): Promise<SdkResult<SystemInfo>>;
```

Requires `system:getInfo`. It returns coarse runtime information only; do not use it for fingerprinting or license checks.

### `sdk.system.notify(params)`

Signature:

```ts
type NotifyParams = {
  title?: string;
  body?: string;
};

function notify(params: NotifyParams): Promise<SdkResult<boolean>>;
```

Requires `system:notifications`. The host truncates `title` to 200 characters and `body` to 2000 characters. If native notifications are unsupported, the call returns `not_supported`.

Example:

```ts
await sdk.system.notify({
  title: 'JSON Query',
  body: 'Export complete',
});
```

## Logging API

Functions:

| Function                        | Return type                   | Notes                                    |
| ------------------------------- | ----------------------------- | ---------------------------------------- |
| `sdk.log.debug(message, data?)` | `Promise<SdkResult<boolean>>` | Ignored unless debug logging is enabled. |
| `sdk.log.info(message, data?)`  | `Promise<SdkResult<boolean>>` | Records informational events.            |
| `sdk.log.warn(message, data?)`  | `Promise<SdkResult<boolean>>` | Records warning events.                  |
| `sdk.log.error(message, data?)` | `Promise<SdkResult<boolean>>` | Records plugin failures.                 |
| `callSdk('log.log', params)`    | `Promise<SdkResult<boolean>>` | Lower-level generic log method.          |

Example:

```ts
await sdk.log.info('query complete', { rows: 12 });
await sdk.log.error('query failed', { reason: 'invalid input' });
```

Logs go to the main-process output and the bounded diagnostics stream under Settings. The host redacts defensively, but plugins must not log secrets, full tokens, request/response bodies, file contents, or device payloads.

## Advanced callSdk methods

`callSdk<T>(method, params?, timeoutMs?)` can call every method listed in `SDK_METHODS`, including lower-level file and system methods not wrapped by the convenience `sdk` object.

```ts
function callSdk<T = unknown>(method: SdkMethod, params?: unknown, timeoutMs?: number): Promise<SdkResult<T>>;
```

### File token methods

Open/save dialogs issue opaque tokens. Read, write, reveal, and open operations accept only tokens issued to the same plugin. Plugins never receive unrestricted filesystem paths.

| Method              | Permission  | Params                                                                  | Success data                                            |
| ------------------- | ----------- | ----------------------------------------------------------------------- | ------------------------------------------------------- |
| `fs.openFileDialog` | `fs:dialog` | `{ filters?: FileFilter[]; multiple?: boolean }`                        | `{ items: Array<{ fileToken: string; name: string }> }` |
| `fs.saveFileDialog` | `fs:dialog` | `{ suggestedName?: string; filters?: FileFilter[] }`                    | `{ fileToken: string; name: string } \| null`           |
| `fs.readFile`       | `fs:read`   | `{ fileToken: string; encoding?: 'utf8' \| 'base64' }`                  | `{ content: string }`                                   |
| `fs.writeFile`      | `fs:write`  | `{ fileToken: string; content: string; encoding?: 'utf8' \| 'base64' }` | `true`                                                  |

`FileFilter` shape:

```ts
type FileFilter = {
  name: string;
  extensions: string[];
};
```

Example:

```ts
const selected = await callSdk<{ items: Array<{ fileToken: string; name: string }> }>('fs.openFileDialog', {
  filters: [{ name: 'JSON', extensions: ['json'] }],
  multiple: false,
});
```

Limits:

- `filters` supports up to 50 entries; each filter name is limited to 128 characters.
- Each extension must be non-empty, max 32 characters, and cannot contain path separators.
- `fs.readFile` and `fs.writeFile` are limited to 50 MiB.
- `encoding` accepts `utf8`, `utf-8`, or `base64`.

### System host methods

| Method                | Permission            | Params                  | Success data                          |
| --------------------- | --------------------- | ----------------------- | ------------------------------------- |
| `system.openExternal` | `system:openExternal` | `{ url: string }`       | `true`                                |
| `system.revealPath`   | `system:revealPath`   | `{ pathToken: string }` | `true`                                |
| `system.openPath`     | `system:openPath`     | `{ pathToken: string }` | `true`                                |
| `system.getEnv`       | `system:env:read`     | `{ keys: string[] }`    | `Record<string, string \| undefined>` |

Notes:

- `system.openExternal` accepts only `http:`, `https:`, and `mailto:` URLs up to 8192 characters.
- `system.revealPath` and `system.openPath` require path tokens produced by file dialogs for the same plugin.
- `system.getEnv` returns only keys listed in the plugin manifest `envAllowlist`; undeclared keys are omitted.
- `system.getEnv` accepts up to 100 requested keys per call.

## React mount helper

Import the React helper when building a React plugin:

```ts
import { mountPlugin, usePluginLocale } from '@devtoolbox/plugin-sdk/react';

function App() {
  const locale = usePluginLocale();
  return <div>{locale}</div>;
}

mountPlugin(<App />, { locale: true });
```

`mountPlugin(app, options?)` does three things:

| Behavior             | Details                                                                |
| -------------------- | ---------------------------------------------------------------------- |
| React mount          | Renders into `#root` and returns an unmount function.                  |
| Theme sync           | Applies `document.documentElement.dataset.theme = 'dark' \| 'light'`.  |
| Optional locale sync | With `{ locale: true }`, applies `dataset.locale` and `document.lang`, then exposes updates through `usePluginLocale()`. |
| Readiness handshake  | Sends `devtoolbox:plugin:ready` after the React tree commits.          |

Do not implement a second readiness loop in `index.html`; use this helper or reproduce the same behavior exactly for non-React plugins.

## Permissions and errors

Common error codes:

| Code                 | Meaning                                                              |
| -------------------- | -------------------------------------------------------------------- |
| `permission_denied`  | The installed manifest lacks the required permission.                |
| `not_installed`      | The plugin ID is not present in installed Marketplace state.         |
| `plugin_disabled`    | The plugin is installed but currently disabled.                      |
| `safe_mode`          | Marketplace capabilities are disabled for this app session.          |
| `invalid_params`     | A URL, token, key, method parameter, or payload is invalid.          |
| `quota_exceeded`     | The plugin exceeded its isolated key-value storage quota.            |
| `not_supported`      | The host or current platform does not implement a capability.        |
| `timeout`            | The SDK or network request exceeded its deadline.                    |
| `network_blocked`    | The destination failed domain or private-address policy.             |
| `insecure_protocol`  | Plain HTTP was attempted through host-mediated networking.           |
| `too_many_redirects` | The network request exceeded the redirect limit.                     |
| `too_large`          | The host rejected an oversized response or file payload.             |
| `invalid_json`       | A JSON response could not be parsed.                                 |
| `io_error`           | A filesystem, shell, notification, or other native operation failed. |

A permission in the manifest is necessary but not sufficient. The host still validates parameters, token ownership, enabled state, safe mode, target domains, and size limits on every call.

When the host returns `permission_denied`, `error.details` includes the plugin ID, SDK method, required permission, manifest field, and suggested manifest fix. Plugin UIs can surface that detail during development, but production UI should still use user-friendly text.

## SDK changelog

The manifest `sdkVersion` declares host compatibility. Current plugins should use `sdkVersion: "1.0"`.

### 1.0

- Provides `sdk.http.request`, isolated `sdk.storage`, basic `sdk.system`, and `sdk.log`.
- Provides `callSdk` for approved lower-level file-token and system methods.
- Provides React helpers through `@devtoolbox/plugin-sdk/react`, including `mountPlugin` and `usePluginLocale`.
- Uses `SdkResult<T>` for all host-mediated calls instead of throwing host-side errors.
- Enforces per-call permission checks, safe-mode checks, network allowlists, timeouts, and payload limits in the host.

Compatibility policy:

- Adding optional fields, new error codes, or new SDK methods under existing permissions is a minor-compatible change when existing behavior is preserved.
- Requiring a new manifest field, changing a return shape, tightening a previously accepted parameter, or removing a method requires a new `sdkVersion`.
- Deprecated methods should stay documented until the oldest supported host version no longer accepts them.

## Reserved capabilities

The current manifest permission list includes `serial`, `usb`, and `bluetooth` as reserved hardware permissions. They are not usable through the current SDK because no stable `sdk.serial`, `sdk.usb`, or `sdk.bluetooth` method exists yet.

When these capabilities are added, they should follow the same model:

- The core application owns native access and IPC.
- Plugins request the capability through SDK methods only.
- Users explicitly authorize hardware resources.
- Tokens or connection IDs are scoped to one plugin.
- Connections are closed when the plugin is disabled, unloaded, or uninstalled.

## Maintenance checklist

When adding a new SDK capability, update these files together:

- `core/packages/core/src/index.ts` for method and permission contracts.
- `core/packages/plugin-sdk/src/index.ts` for plugin-facing wrappers and types.
- `core/renderer/components/PluginHost/index.tsx` for method routing and event bridging.
- `core/main/preload/index.ts` and `core/packages/core/src/electron-api.ts` for typed preload IPC.
- `core/main/ipc/plugin-capabilities.ts` and the related broker for host-side authorization.
- `docs/development/plugin-sdk.md` and `docs/zh-CN/development/plugin-sdk.md` for developer-facing reference.
- Focused tests for manifest validation, broker authorization, SDK contract matching, and plugin host routing.
