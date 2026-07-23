# Marketplace 插件开发

[English](../../development/plugins.md) | [简体中文](plugins.md)

Marketplace 插件是独立打包并在隔离 iframe 中运行的 Web 应用。本指南把插件创建、清单、权限、本地打包和安装整合为一套完整流程。完整可调用 API 请阅读 [插件 SDK 参考](plugin-sdk.md)。

## 运行时模型

- 源码位于 `marketplace/modules/<market-id>/`。
- Vite 在插件的 `package/` 目录中生成自包含 Web 入口。
- 分发 ZIP 的根目录包含 `manifest.json`，以及清单声明的入口目录。
- 宿主在沙箱 iframe 中加载已安装入口。
- 特权操作通过宿主 SDK 的请求/响应消息完成；插件无法访问 Electron 或 Node.js API。
- 兼容性由清单中的 `sdkVersion` 标识。

宿主会把当前主题和语言传给 iframe。`@devtoolbox/plugin-sdk/react` 提供的 `mountPlugin` 会自动应用主题变化；如果插件同时处理 `en` 和 `zh-CN` 语言变化，请传入 `{ locale: true }`。

`mountPlugin` 还负责宿主就绪握手。它只会在 React 成功提交后宣布插件就绪，并持续重试直到宿主确认。不要在 `index.html` 中添加第二套就绪循环。如果启动在八秒内没有完成，宿主会显示超时状态，并允许用户通过 **重新加载插件** 重建 iframe。

应用处于安全模式时，本次会话无法使用 Marketplace iframe 资源和所有 SDK 能力。插件仍保持安装状态，其持久化启用设置不会改变。检查或移除可疑插件后，通过 **设置 → 诊断** 返回正常模式。

## 创建插件

在仓库根目录运行交互式生成器：

```bash
./cli.sh plugin create
```

插件 ID 必须使用 kebab-case 并以 `market-` 开头，例如 `market-json-query`。生成器会创建：

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

生成的插件使用 `@devtoolbox/plugin-sdk`，并共享以下仓库级构建文件，不复制基础设施：

- `core/packages/plugin-sdk/src/index.ts`
- `core/packages/plugin-sdk/src/react.tsx`
- `marketplace/shared/vite.config.ts`
- `marketplace/tsconfig.plugin.json`

如果新插件包尚未写入锁文件，创建后安装工作区依赖：

```bash
pnpm install
```

工作区开发会直接解析 SDK 源码。`pnpm -C marketplace build` 会先创建 SDK 发布产物，再让 Vite 把编译结果打入每个插件，因此发布前会实际验证相同的包入口。

插件创建 Worker、订阅、Observer 或定时器时，应在所属 React Effect 中释放。新的请求开始后，异步操作应忽略旧响应；iframe 重新加载会销毁文档，但不应成为常规清理机制。

### 构建和发布 Plugin SDK

SDK 源码包设为私有，防止意外发布 TypeScript 工作区文件。使用以下命令构建独立 npm 目录并验证全部导出：

```bash
pnpm --filter @devtoolbox/plugin-sdk typecheck
pnpm --filter @devtoolbox/plugin-sdk build
pnpm --filter @devtoolbox/plugin-sdk pack:check
npm pack ./core/packages/plugin-sdk/dist
```

生成的类型声明是自包含的，不依赖 `@devtoolbox/core`。仅在仓库中使用的 `contract-check.ts` 仍会验证 SDK 方法、错误、结果和宿主响应与主应用契约完全一致。

维护者通过手动触发的 **Plugin SDK Release** 工作流发布。工作流始终上传 npm tarball 供检查，只有启用 `publish` 输入时才会正式发布。

## 清单

示例：

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

权威 TypeScript 契约是 `core/packages/core/src/index.ts` 中的 `MarketplacePluginManifest`。

| 字段                                          | 要求                                                        |
| --------------------------------------------- | ----------------------------------------------------------- |
| `id`                                          | 唯一的 kebab-case ID，以 `market-` 开头，并与模块目录一致。 |
| `name`、`description`                         | 英文回退元数据。                                            |
| `version`                                     | 插件包版本。                                                |
| `sdkVersion`                                  | 宿主 SDK 兼容版本；当前模板使用 `1.0`。                     |
| `entry`                                       | 构建后的 Web 入口，通常为 `package/index.html`。            |
| `categoryId`                                  | 应用分类，例如 `dev-tools` 或 `network-tools`。             |
| `author`、`license`、`homepage`、`repository` | 必需的插件归属和来源字段。                                  |
| `permissions`                                 | 非空的请求能力列表。                                        |
| `httpDomains`                                 | 声明 `http:external` 或 `http:proxy` 时必填。               |

可选字段包括本地化元数据、图标信息、标签、关键词、最低应用版本、维护者、环境变量白名单和弃用元数据。

## 权限

声明权限并不代表获得通用访问能力。宿主会在每次特权调用时检查已安装插件的清单。

| 权限                                   | 能力                       | 状态                               |
| -------------------------------------- | -------------------------- | ---------------------------------- |
| `http:proxy`                           | 由宿主代理的 HTTP 请求     | 通过 `sdk.http.request` 实现       |
| `http:external`                        | 声明浏览器直接访问外部网络 | 已识别；仍受浏览器 CORS 限制       |
| `storage:kv`                           | 按插件隔离的键值存储       | 通过 `sdk.storage` 实现            |
| `fs:dialog`                            | 用户发起的打开/保存对话框  | 通过宿主方法实现                   |
| `fs:read`、`fs:write`                  | 读写对话框返回的令牌       | 通过宿主方法实现                   |
| `system:getInfo`                       | 平台和运行时信息           | 通过 `sdk.system.getInfo` 实现     |
| `system:notifications`                 | 原生通知                   | 通过 `sdk.system.notify` 实现      |
| `system:openExternal`                  | 在外部打开已批准 URL       | 通过宿主方法实现                   |
| `system:revealPath`、`system:openPath` | 显示或打开令牌化路径       | 通过宿主方法实现                   |
| `system:env:read`                      | 读取明确列入白名单的环境键 | 通过宿主方法和 `envAllowlist` 实现 |
| `bluetooth`、`serial`、`usb`           | 硬件集成                   | 保留/实验性；目前没有稳定宿主 API  |

只请求插件实际使用的能力。未来或保留权限的存在并不表示对应方法可用。

## 网络策略

当 API 不支持浏览器 CORS、需要受控请求头或需要宿主级审计时，使用 `sdk.http.request`。插件必须声明 `http:proxy` 和 `httpDomains` 白名单。

允许的域名形式：

- 精确主机名：`api.example.com`
- 单层通配符：`*.example.com` 可匹配 `a.example.com`，但不能匹配 `a.b.example.com`

禁止使用 `*`、多层通配符、协议、路径、原始 IP 地址、localhost 和私有网络目标。

主进程只允许 HTTPS 目标，会在重定向后重新检查白名单，并拒绝解析到私有或本地地址的 DNS 结果。它还会限制超时、重定向次数和响应大小。本地开发注册表可以使用 `file://`，但打包后的注册表和插件下载必须使用 HTTPS；该例外不会降低插件 HTTP 目标校验强度。

## 插件 SDK 参考

本文有意只保留简短 SDK 说明。完整内容见 [插件 SDK 参考](plugin-sdk.md)，其中列出了每个 SDK 命名空间、方法名、权限、参数、返回值、超时、限制和错误码。

常见插件代码导入便捷客户端：

```ts
import { sdk } from '@devtoolbox/plugin-sdk';
```

常用能力使用 `sdk.http`、`sdk.storage`、`sdk.system` 和 `sdk.log`。只有需要文件令牌等已批准底层方法时才使用 `callSdk`：

```ts
import { callSdk } from '@devtoolbox/plugin-sdk';

const selected = await callSdk<{ items: Array<{ fileToken: string; name: string }> }>('fs.openFileDialog', {
  filters: [{ name: 'JSON', extensions: ['json'] }],
});
```

每个 SDK 调用都会解析为 `SdkResult<T>`，读取 `data` 前应先判断 `ok`。

## 开发和构建

以 Vite 开发模式运行一个插件：

```bash
pnpm --filter @devtoolbox/plugin-market-json-query dev
```

构建插件：

```bash
pnpm --filter @devtoolbox/plugin-market-json-query build
```

清单入口要求输出位于 `package/`。该目录属于生成内容。

## 本地打包和安装

最短流程会构建插件、创建 ZIP 并更新本地注册表：

```bash
./cli.sh plugin market-json-query
```

打包所有本地插件：

```bash
./cli.sh plugin all
```

构建完成后也可以使用底层打包器：

```bash
node marketplace/scripts/pack-local.mjs market-json-query
```

生成的文件：

- `marketplace/registry.local.json`
- `marketplace/.local-dist/<plugin>-<version>.zip`

本地插件包默认不签名。迁移期间，应用以审计模式执行 Marketplace 来源验证，新安装的本地包会显示为 **未签名**。如果附加签名声称来自受信任发布者但校验失败，即使在审计模式下也会被拒绝。

在 DevToolBox 中：

1. 打开 **设置**。
2. 将 **Marketplace 注册表 URL** 设置为生成的 `file:///.../marketplace/registry.local.json` URL。
3. 打开 **模块 → Marketplace** 并刷新。
4. 安装插件并测试其声明的能力。

## 验证插件

迭代期间运行针对性检查：

```bash
pnpm -C marketplace lint
pnpm -C marketplace typecheck
pnpm -C marketplace build
```

根目录的 `pnpm lint:modules` 还会验证 Marketplace ID、必填清单字段、权限、域名规则和重复 ID。

发布前确认 ZIP 只包含必需清单和 Web 资源，清单版本与插件包一致，并且每个申请的权限都对应用户可见的插件行为。

## 签名并信任发布包

DevToolBox 使用 Ed25519 包来源验证。签名声明把插件包 SHA-256 和精确大小与插件身份、特权清单字段、发布时间、源码仓库、源码提交、发布者和密钥 ID 绑定。私钥只由发布打包器使用；应用只包含明确受信任的公钥。

官方 `devtoolbox-official` 公钥以审计模式登记，指纹为 `sha256-27d34403da3feda5439b477441d9ae8af076e91252a84fd335a0d721ece729f6`。其范围限制为本仓库中的四个官方 Marketplace 插件。对应私钥有意排除在 Git 之外，必须保存在项目所有者的密钥存储中。

添加发布者或计划轮换密钥时，在安全的本地环境中生成一次密钥：

```bash
pnpm -C marketplace run signing:keygen -- \
  --publisher devtoolbox-official \
  --repository https://github.com/XthingsJacobs/devToolBox
```

该命令会创建被忽略的 `marketplace/.signing/` 目录，并为私钥设置仅所有者可访问的权限。绝不能提交 `private-key.pk8.base64`，也不能把它作为构建产物上传。请通过项目密钥管理流程备份。

登记公钥：

1. 将 `marketplace/.signing/trusted-publisher.json` 中的对象复制到 `core/main/marketplace/trusted-publishers.json` 的 `publishers` 数组。
2. 现有未签名版本仍在提供时，保持信任库模式为 `audit`。
3. 把 `private-key.pk8.base64` 的内容保存到 GitHub Actions 密钥 `MARKETPLACE_SIGNING_PRIVATE_KEY_BASE64`。
4. 发布并验证已签名注册表条目。已安装卡片应显示 **Verified · devtoolbox-official**，并包含预期仓库和修订。
5. 将仓库变量 `MARKETPLACE_REQUIRE_SIGNATURES` 设置为 `true`，然后在下一个应用版本中把内置信任库模式改为 `strict`。

发布任务还会运行 `marketplace/scripts/verify-release.mjs`。上传任何发布产物前，它会重新计算每个 ZIP 的哈希，并根据内置信任库独立校验签名、公钥指纹、插件范围和源码仓库。

发布工作流从 GitHub Actions 获取源码仓库、提交和工作流 URL。进行已签名的本地打包时，请显式提供对应值：

```bash
export MARKETPLACE_SIGNING_PRIVATE_KEY_BASE64="$(tr -d '\n' < marketplace/.signing/private-key.pk8.base64)"
export MARKETPLACE_SIGNING_PUBLISHER=devtoolbox-official
export MARKETPLACE_SOURCE_REPOSITORY=https://github.com/XthingsJacobs/devToolBox
export MARKETPLACE_SOURCE_REVISION="$(git rev-parse HEAD)"
pnpm -C marketplace run pack -- --all
```

轮换密钥时，应先把新公钥添加到信任库并发布包含该更新的应用版本，然后再更换签名密钥。在旧密钥签名的插件包不再提供前，同时信任两个限定范围的密钥，之后再移除旧密钥。在配置的插件 ID 或源码仓库范围之外复用发布者密钥会被拒绝。

## 常见错误

| 代码                | 含义                                       |
| ------------------- | ------------------------------------------ |
| `permission_denied` | 已安装清单缺少所需权限。                   |
| `not_installed`     | 已安装 Marketplace 状态中不存在该插件 ID。 |
| `plugin_disabled`   | 插件已安装但当前被禁用。                   |
| `invalid_params`    | URL、令牌、键或方法参数无效。              |
| `quota_exceeded`    | 插件超过隔离键值存储配额。                 |
| `not_supported`     | 宿主或平台没有实现该能力。                 |
| `timeout`           | SDK 或网络请求超过时限。                   |
| `network_blocked`   | 目标未通过域名或私有地址策略。             |
| `too_large`         | 宿主拒绝了过大的响应。                     |
| `io_error`          | 文件系统、Shell 或其他原生操作失败。       |
