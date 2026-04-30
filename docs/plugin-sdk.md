# Plugin SDK (Marketplace)

This document defines the SDK contract for DevToolBox marketplace plugins.

Marketplace plugins run in an isolated iframe runtime. A plugin must not call Electron/Node APIs directly. All privileged operations must go through the host-provided SDK.

## Runtime Model

- Plugin runtime: iframe (isolated)
- UI entry: `index.html` (declared in the plugin manifest)
- The plugin package (zip) must include `manifest.json` at the package root
- Manifest `id` must start with `market-`
- Workspace package name convention: `@devtoolbox/plugin-<market-id>`
- Privileged access: request/response messages between plugin ↔ host
- Compatibility: versioned by `sdkVersion` in the plugin manifest

## SDK Conventions

- All SDK calls are asynchronous and return a Promise-like response in the plugin layer.
- Host responses must use a standard result shape:
  - Success: `{ ok: true, data: T }`
  - Error: `{ ok: false, error: { code: string, message: string, details?: unknown } }`
- The host should log minimal request metadata for auditing (module id, method, duration, status), without logging secrets or full payloads.

## Permissions

Plugins must declare permissions in their manifest. The host must enforce permissions on every call.

Recommended permission keys:

- HTTP
  - `http:external` (plugin may access external network)
  - `http:proxy` (plugin may call `sdk.http.request`)
- File system
  - `fs:dialog` (plugin may open file dialogs)
  - `fs:read` / `fs:write` (plugin may read/write via tokens)
- Storage
  - `storage:kv` (plugin may use namespaced key-value storage)
- Hardware
  - `bluetooth`
  - `serial`
  - `usb`
- System (capability-based, no arbitrary exec)
  - `system:openExternal`
  - `system:revealPath`
  - `system:openPath`
  - `system:notifications`
  - `system:env:read`
  - `system:getInfo`

## Network Policy (Strategy 1)

Plugins may call `fetch` directly in the iframe runtime.

To support APIs without CORS or enterprise environments, the host also provides `sdk.http.request` as a recommended path.

When a plugin declares `http:external`, it must also declare `httpDomains` in its manifest for review and user transparency.

### httpDomains Rules (v1)

- Allowed:
  - Exact hostnames, e.g. `api.github.com`
  - Single-level wildcard, e.g. `*.example.com` (matches `a.example.com`, not `a.b.example.com`)
- Not allowed:
  - `*` (any domain)
  - Multi-level wildcards, e.g. `**.example.com`, `*.*.example.com`
  - Schemes, e.g. `https://api.example.com`
  - Localhost, private IP ranges, or raw IP addresses (v1)

## API Surface (v1)

This section lists the recommended v1 API domains. Some hardware APIs may be marked experimental and implemented later while keeping the contract stable.

Note:

- The host SDK intentionally stays small and capability-focused. App-specific protocols (for example, MQTT clients) are not part of the standard SDK surface. Such features should be implemented inside the plugin itself.

### sdk.http

Recommended for:

- Requests to APIs without CORS support
- Custom headers and controlled timeouts
- Auditing and governance

Methods:

- `sdk.http.request({ url, method, headers?, body?, timeoutMs?, responseType? })`

Notes:

- The host should enforce timeout and maximum response size.
- The host should reject requests to forbidden targets (e.g. localhost/private subnets).

### sdk.fs (Token-based)

File system access must be user-initiated through dialogs. The host returns tokens rather than raw paths.

Methods:

- `sdk.fs.openFileDialog({ filters?, multiple? }) -> { items: [{ fileToken, name, size? }] }`
- `sdk.fs.saveFileDialog({ suggestedName, filters? }) -> { fileToken }`
- `sdk.fs.readFile({ fileToken, encoding? })`
- `sdk.fs.writeFile({ fileToken, data, encoding? })`

### sdk.storage (Namespaced KV)

Storage must be scoped to the plugin id.

Methods:

- `sdk.storage.get({ key })`
- `sdk.storage.set({ key, value })`
- `sdk.storage.delete({ key })`
- `sdk.storage.list({ prefix? })`
- `sdk.storage.clear()`

### sdk.bluetooth (Experimental)

Methods (proposed):

- `sdk.bluetooth.isAvailable()`
- `sdk.bluetooth.scan({ services?, namePrefix?, timeoutMs? }) -> { scanId }`
- `sdk.bluetooth.onDeviceFound({ scanId })`
- `sdk.bluetooth.connect({ deviceId }) -> { sessionId }`
- `sdk.bluetooth.read({ sessionId, serviceUuid, characteristicUuid })`
- `sdk.bluetooth.write({ sessionId, serviceUuid, characteristicUuid, value, writeType? })`
- `sdk.bluetooth.disconnect({ sessionId })`

### sdk.serial (Experimental)

Methods (proposed):

- `sdk.serial.listPorts()`
- `sdk.serial.open({ portId, baudRate, dataBits?, stopBits?, parity? }) -> { sessionId }`
- `sdk.serial.write({ sessionId, data })`
- `sdk.serial.onData({ sessionId })`
- `sdk.serial.close({ sessionId })`

### sdk.usb (Experimental)

Methods (proposed):

- `sdk.usb.listDevices({ filters? })`
- `sdk.usb.open({ deviceId }) -> { sessionId }`
- `sdk.usb.transferIn({ sessionId, endpoint, length })`
- `sdk.usb.transferOut({ sessionId, endpoint, data })`
- `sdk.usb.close({ sessionId })`

### sdk.log (Debugging)

The host provides a logging bridge so a plugin can write debug information into the DevToolBox console.

Methods:

- `sdk.log.debug({ message, data? })`
- `sdk.log.info({ message, data? })`
- `sdk.log.warn({ message, data? })`
- `sdk.log.error({ message, data? })`
- `sdk.log.log({ message, data? })`

Notes:

- Logs are forwarded to the main process output (the terminal running `./cli.sh dev`).
- The host does not print SDK logs to the DevToolBox renderer console.

### sdk.system (Capability-based)

No arbitrary command execution is provided.

Methods:

- `sdk.system.openExternal({ url })`
- `sdk.system.revealPath({ pathToken })`
- `sdk.system.openPath({ pathToken })`
- `sdk.system.notify({ title, body, level? })`
- `sdk.system.getInfo()`
- `sdk.system.getEnv({ keys })` (keys must be allowlisted in the manifest)

## Error Codes (Recommended)

- `permission_denied`
- `invalid_params`
- `not_supported`
- `timeout`
- `too_large`
- `network_blocked`
- `io_error`
