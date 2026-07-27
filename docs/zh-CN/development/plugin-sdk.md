# 插件 SDK 参考

[English](../../development/plugin-sdk.md) | [简体中文](plugin-sdk.md)

本文说明 Marketplace 插件可以使用的 SDK 能力。请配合 [Marketplace 插件开发](plugins.md) 阅读：该指南说明打包、清单、注册表、签名和安装流程；本文专注于可调用 API、参数、返回值、权限和运行时行为。

## 运行时契约

- 插件运行在沙箱 iframe 中，不能访问 Electron、Node.js、`ipcRenderer` 或 `ipcMain`。
- SDK 通过 `postMessage` 向宿主发送请求。宿主把已批准的请求路由到固定的 `plugin:*` IPC 通道。
- 每次特权调用都会根据已安装插件清单重新授权。
- 权威 SDK 方法列表是 `core/packages/plugin-sdk/src/index.ts` 中的 `SDK_METHODS` 和 `core/packages/core/src/index.ts` 中的 `PLUGIN_SDK_METHODS`。
- `serial`、`usb`、`bluetooth` 等未来权限可以被清单识别，但当前版本没有稳定 SDK 方法。

## 结果和超时模型

每个 SDK 调用都会解析为可区分结果；宿主侧失败不会以异常形式抛出：

```ts
type SdkError = { code: string; message: string; details?: unknown };

type SdkResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: SdkError };
```

读取 `data` 前始终先判断 `ok`：

```ts
const result = await sdk.storage.get<{ compact: boolean }>('settings');

if (!result.ok) {
  console.error(result.error.code, result.error.message);
  return;
}

const compact = result.data?.compact === true;
```

SDK 请求默认 15 秒超时。`callSdk(method, params, timeoutMs)` 会把客户端超时限制在 `1..60000` 毫秒。HTTP 请求还会受到宿主网络超时限制，最大为 30 秒。

## 快速导入

常用调用使用便捷对象：

```ts
import { sdk } from '@devtoolbox/plugin-sdk';
```

需要使用便捷对象未封装的批准方法时，导入 `callSdk`：

```ts
import { callSdk } from '@devtoolbox/plugin-sdk';
```

## 便捷 sdk 对象

| 命名空间      | 函数                                    | 所需权限               | 用途                          |
| ------------- | --------------------------------------- | ---------------------- | ----------------------------- |
| `sdk.http`    | `request<T>(params)`                    | `http:proxy`           | 发起由宿主代理的 HTTPS 请求。 |
| `sdk.storage` | `get<T>(key)`                           | `storage:kv`           | 读取一个隔离键。              |
| `sdk.storage` | `set(key, value)`                       | `storage:kv`           | 写入一个可 JSON 序列化的值。  |
| `sdk.storage` | `delete(key)`                           | `storage:kv`           | 删除一个隔离键。              |
| `sdk.storage` | `list(prefix?)`                         | `storage:kv`           | 列出键，可按前缀过滤。        |
| `sdk.storage` | `clear()`                               | `storage:kv`           | 清空当前插件的隔离存储。      |
| `sdk.system`  | `getInfo()`                             | `system:getInfo`       | 读取基础平台和运行时信息。    |
| `sdk.system`  | `notify(params)`                        | `system:notifications` | 显示原生通知。                |
| `sdk.log`     | `debug/info/warn/error(message, data?)` | 无                     | 把插件日志转发给宿主。        |

## HTTP API

### `sdk.http.request<T>(params)`

签名：

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

参数：

| 字段           | 类型                                | 说明                                                  |
| -------------- | ----------------------------------- | ----------------------------------------------------- |
| `url`          | `string`                            | 必填。必须是 HTTPS，并匹配清单中的 `httpDomains`。    |
| `method`       | `string`                            | 可选。默认 `GET`；最大长度 32 个字符。                |
| `headers`      | `Record<string, string>`            | 可选。最多 200 项；请求头名称最大 256 个字符。        |
| `body`         | `string`                            | 可选。必须是字符串；需要 JSON 时由插件自行编码。      |
| `timeoutMs`    | `number`                            | 可选。宿主会把网络超时限制在 `1..30000` 毫秒。        |
| `responseType` | `'text' \| 'json' \| 'arrayBuffer'` | 可选。默认 `text`；`arrayBuffer` 返回 base64 字符串。 |

返回值：

| 成功数据字段 | 类型                     | 说明                                   |
| ------------ | ------------------------ | -------------------------------------- |
| `status`     | `number`                 | HTTP 响应状态码。                      |
| `headers`    | `Record<string, string>` | 来自 `fetch` 的底层响应头。            |
| `data`       | `T`                      | 文本、解析后的 JSON 或 base64 字符串。 |

示例：

```ts
const result = await sdk.http.request<{ value: string }>({
  url: 'https://api.example.com/value',
  method: 'GET',
  responseType: 'json',
  timeoutMs: 10_000,
});
```

策略：

- 插件必须声明 `http:proxy` 和非空 `httpDomains` 白名单。
- 宿主代理请求会拒绝明文 HTTP、localhost、原始 IP、私有网络、IPv6 目标和未批准重定向。
- 响应体限制为 10 MiB。
- JSON 解析失败会返回 `invalid_json`。

## 存储 API

存储按插件 ID 隔离。一个插件不能读取另一个插件的存储。

| 函数                          | 参数                          | 返回类型                       | 说明                                            |
| ----------------------------- | ----------------------------- | ------------------------------ | ----------------------------------------------- |
| `sdk.storage.get<T>(key)`     | `key: string`                 | `Promise<SdkResult<T>>`        | 不存在的键返回 `null`；需要时使用 `T \| null`。 |
| `sdk.storage.set(key, value)` | `key: string, value: unknown` | `Promise<SdkResult<boolean>>`  | 值必须可以 JSON 序列化。                        |
| `sdk.storage.delete(key)`     | `key: string`                 | `Promise<SdkResult<boolean>>`  | 如果键存在则删除。                              |
| `sdk.storage.list(prefix?)`   | `prefix?: string`             | `Promise<SdkResult<string[]>>` | 返回排序后的键；前缀最大长度 256。              |
| `sdk.storage.clear()`         | 无                            | `Promise<SdkResult<boolean>>`  | 只清空当前插件命名空间。                        |

示例：

```ts
await sdk.storage.set('settings', { compact: true });
const settings = await sdk.storage.get<{ compact: boolean }>('settings');
const keys = await sdk.storage.list('setting');
await sdk.storage.delete('settings');
await sdk.storage.clear();
```

限制：

- 键必须是非空字符串，最长 256 个字符。
- 保留键 `__proto__`、`constructor` 和 `prototype` 会被拒绝。
- 单个插件的序列化存储限制为 1 MiB。
- 超出配额会返回 `quota_exceeded`，并保持原有存储不变。

## 系统 API

### `sdk.system.getInfo()`

签名：

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

需要 `system:getInfo` 权限。它只返回粗粒度运行时信息；不要把它用于设备指纹或授权校验。

### `sdk.system.notify(params)`

签名：

```ts
type NotifyParams = {
  title?: string;
  body?: string;
};

function notify(params: NotifyParams): Promise<SdkResult<boolean>>;
```

需要 `system:notifications` 权限。宿主会把 `title` 截断到 200 个字符，把 `body` 截断到 2000 个字符。如果当前平台不支持原生通知，调用返回 `not_supported`。

示例：

```ts
await sdk.system.notify({
  title: 'JSON Query',
  body: 'Export complete',
});
```

## 日志 API

函数：

| 函数                            | 返回类型                      | 说明                       |
| ------------------------------- | ----------------------------- | -------------------------- |
| `sdk.log.debug(message, data?)` | `Promise<SdkResult<boolean>>` | 未启用调试日志时会被忽略。 |
| `sdk.log.info(message, data?)`  | `Promise<SdkResult<boolean>>` | 记录信息事件。             |
| `sdk.log.warn(message, data?)`  | `Promise<SdkResult<boolean>>` | 记录警告事件。             |
| `sdk.log.error(message, data?)` | `Promise<SdkResult<boolean>>` | 记录插件失败事件。         |
| `callSdk('log.log', params)`    | `Promise<SdkResult<boolean>>` | 底层通用日志方法。         |

示例：

```ts
await sdk.log.info('query complete', { rows: 12 });
await sdk.log.error('query failed', { reason: 'invalid input' });
```

日志会进入主进程输出和设置中的有界诊断流。宿主会做防御性脱敏，但插件仍不得记录密钥、完整令牌、请求/响应正文、文件内容或设备通信载荷。

## 高级 callSdk 方法

`callSdk<T>(method, params?, timeoutMs?)` 可以调用 `SDK_METHODS` 中列出的所有方法，包括便捷 `sdk` 对象没有封装的底层文件和系统方法。

```ts
function callSdk<T = unknown>(method: SdkMethod, params?: unknown, timeoutMs?: number): Promise<SdkResult<T>>;
```

### 文件令牌方法

打开/保存对话框会签发不透明令牌。读取、写入、显示和打开操作只接受签发给同一插件的令牌。插件永远不会获得不受限制的文件系统路径。

| 方法                | 权限        | 参数                                                                    | 成功数据                                                |
| ------------------- | ----------- | ----------------------------------------------------------------------- | ------------------------------------------------------- |
| `fs.openFileDialog` | `fs:dialog` | `{ filters?: FileFilter[]; multiple?: boolean }`                        | `{ items: Array<{ fileToken: string; name: string }> }` |
| `fs.saveFileDialog` | `fs:dialog` | `{ suggestedName?: string; filters?: FileFilter[] }`                    | `{ fileToken: string; name: string } \| null`           |
| `fs.readFile`       | `fs:read`   | `{ fileToken: string; encoding?: 'utf8' \| 'base64' }`                  | `{ content: string }`                                   |
| `fs.writeFile`      | `fs:write`  | `{ fileToken: string; content: string; encoding?: 'utf8' \| 'base64' }` | `true`                                                  |

`FileFilter` 结构：

```ts
type FileFilter = {
  name: string;
  extensions: string[];
};
```

示例：

```ts
const selected = await callSdk<{ items: Array<{ fileToken: string; name: string }> }>('fs.openFileDialog', {
  filters: [{ name: 'JSON', extensions: ['json'] }],
  multiple: false,
});
```

限制：

- `filters` 最多支持 50 项；每个过滤器名称最长 128 个字符。
- 每个扩展名必须非空，最长 32 个字符，且不能包含路径分隔符。
- `fs.readFile` 和 `fs.writeFile` 限制为 50 MiB。
- `encoding` 接受 `utf8`、`utf-8` 或 `base64`。

### 系统宿主方法

| 方法                  | 权限                  | 参数                    | 成功数据                              |
| --------------------- | --------------------- | ----------------------- | ------------------------------------- |
| `system.openExternal` | `system:openExternal` | `{ url: string }`       | `true`                                |
| `system.revealPath`   | `system:revealPath`   | `{ pathToken: string }` | `true`                                |
| `system.openPath`     | `system:openPath`     | `{ pathToken: string }` | `true`                                |
| `system.getEnv`       | `system:env:read`     | `{ keys: string[] }`    | `Record<string, string \| undefined>` |

说明：

- `system.openExternal` 只接受最长 8192 字符的 `http:`、`https:` 和 `mailto:` URL。
- `system.revealPath` 和 `system.openPath` 需要当前插件文件对话框产生的路径令牌。
- `system.getEnv` 只返回插件清单 `envAllowlist` 中声明的键；未声明的键会被省略。
- `system.getEnv` 每次最多接受 100 个请求键。

## React 挂载辅助函数

构建 React 插件时导入 React 辅助函数：

```ts
import { mountPlugin, usePluginLocale } from '@devtoolbox/plugin-sdk/react';

function App() {
  const locale = usePluginLocale();
  return <div>{locale}</div>;
}

mountPlugin(<App />, { locale: true });
```

`mountPlugin(app, options?)` 完成三类工作：

| 行为         | 细节                                                                 |
| ------------ | -------------------------------------------------------------------- |
| React 挂载   | 渲染到 `#root`，并返回卸载函数。                                     |
| 主题同步     | 应用 `document.documentElement.dataset.theme = 'dark' \| 'light'`。  |
| 可选语言同步 | 使用 `{ locale: true }` 时应用 `dataset.locale` 和 `document.lang`，并通过 `usePluginLocale()` 暴露更新。 |
| 就绪握手     | React 树提交后发送 `devtoolbox:plugin:ready`。                       |

不要在 `index.html` 里再实现第二套就绪循环；请使用该辅助函数，或在非 React 插件中精确复现同样行为。

## 权限和错误

常见错误码：

| 代码                 | 含义                                       |
| -------------------- | ------------------------------------------ |
| `permission_denied`  | 已安装清单缺少所需权限。                   |
| `not_installed`      | 已安装 Marketplace 状态中不存在该插件 ID。 |
| `plugin_disabled`    | 插件已安装但当前被禁用。                   |
| `safe_mode`          | 本次应用会话禁用了 Marketplace 能力。      |
| `invalid_params`     | URL、令牌、键、方法参数或载荷无效。        |
| `quota_exceeded`     | 插件超过隔离键值存储配额。                 |
| `not_supported`      | 宿主或当前平台没有实现该能力。             |
| `timeout`            | SDK 或网络请求超过时限。                   |
| `network_blocked`    | 目标未通过域名或私有地址策略。             |
| `insecure_protocol`  | 通过宿主代理网络尝试了明文 HTTP。          |
| `too_many_redirects` | 网络请求超过重定向限制。                   |
| `too_large`          | 宿主拒绝了过大的响应或文件载荷。           |
| `invalid_json`       | JSON 响应无法解析。                        |
| `io_error`           | 文件系统、Shell、通知或其他原生操作失败。  |

清单中的权限只是必要条件，不是充分条件。宿主仍会在每次调用时校验参数、令牌归属、启用状态、安全模式、目标域名和大小限制。

## 保留能力

当前清单权限列表包含 `serial`、`usb` 和 `bluetooth` 作为保留硬件权限。当前 SDK 还没有稳定的 `sdk.serial`、`sdk.usb` 或 `sdk.bluetooth` 方法，因此这些权限目前不可用。

后续增加这些能力时，应遵循同一模型：

- 核心应用持有原生访问和 IPC。
- 插件只能通过 SDK 方法请求能力。
- 用户显式授权硬件资源。
- 令牌或连接 ID 只作用于单个插件。
- 插件被禁用、卸载或页面卸载时关闭连接。

## 维护清单

新增 SDK 能力时，需要同步更新这些文件：

- `core/packages/core/src/index.ts`：方法和权限契约。
- `core/packages/plugin-sdk/src/index.ts`：插件侧封装和类型。
- `core/renderer/components/PluginHost/index.tsx`：方法路由和事件桥接。
- `core/main/preload/index.ts` 和 `core/packages/core/src/electron-api.ts`：有类型的 preload IPC。
- `core/main/ipc/plugin-capabilities.ts` 和相关 broker：宿主侧授权。
- `docs/development/plugin-sdk.md` 和 `docs/zh-CN/development/plugin-sdk.md`：开发者参考文档。
- 针对清单验证、broker 授权、SDK 契约匹配和插件宿主路由的测试。
