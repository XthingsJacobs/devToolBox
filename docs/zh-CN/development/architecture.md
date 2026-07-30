# 架构说明

[English](../../development/architecture.md) | [简体中文](architecture.md)

本文是面向贡献者的 DevToolBox 架构地图，整合了此前分散在多个文档中的进程模型、仓库结构、扩展发现、IPC 约定和安全边界。

## 系统概览

DevToolBox 是一个使用 React 渲染进程的 Electron 应用。特权操作位于 Web UI 之外，并通过有类型约束的预加载边界调用。

```text
内置 React 工具
        |
        v
React 渲染进程 -> window.electronAPI -> 预加载 -> IPC 处理器 -> 操作系统

Marketplace 插件 iframe
        |
        v
postMessage -> PluginHost -> window.electronAPI -> Marketplace IPC -> 能力代理
```

| 层级        | 位置                  | 职责                                                     |
| ----------- | --------------------- | -------------------------------------------------------- |
| 主进程      | `core/main/`          | 窗口、原生对话框、文件、网络、存储、子进程和 IPC 处理器  |
| 预加载桥接  | `core/main/preload/`  | 通过 `contextBridge` 暴露小型、明确的 API                |
| 渲染进程    | `core/renderer/`      | React 应用、导航、内置工具、Marketplace UI、主题和本地化 |
| 共享核心    | `core/packages/core/` | 清单、注册表、权限、已安装插件和 Electron IPC 契约       |
| 共享 UI     | `core/packages/ui/`   | 可复用 UI 组件和 Hook                                    |
| Marketplace | `marketplace/`        | 插件源码、共享浏览器 SDK、构建配置和打包脚本             |

## 仓库结构

```text
core/
  main/                         Electron 主进程、服务和预加载桥接
    marketplace/                注册表、仓库、安装器和能力服务
  packages/                     共享核心、插件 SDK 和 UI 包
  renderer/                     React 应用和内置工具
docs/                            MkDocs 内容
docs-site/                       MkDocs 配置
marketplace/
  modules/                       Marketplace 插件源码
  scripts/                       注册表和插件包构建器
  shared/                        Marketplace 共享 Vite 配置
scripts/                         仓库校验器和脚手架
cli.sh / cli.ps1                 统一贡献者 CLI 入口
```

## 进程边界

### 主进程

主进程是特权操作的信任边界。它在 `core/main/ipc/` 中注册应用级 IPC，并从 `core/main/modules/*.ts` 发现内置工具处理器。

处理器必须校验输入、返回可序列化值，并避免暴露任意文件系统路径或命令执行能力。共享的敏感行为应放在主进程辅助模块中，不要由各工具重复实现。

主窗口使用平台原生窗口行为：macOS 启动后进入全屏；Windows 和 Linux 启动后最大化，以保留系统原生的最小化、最大化和关闭按钮。

### 预加载桥接

`core/main/preload/index.ts` 将批准的 IPC 操作映射到 `window.electronAPI`。权威的 `ElectronAPI` 和 invoke 契约位于 `core/packages/core/src/electron-api.ts`；`core/renderer/types/electron.d.ts` 只负责把该共享类型绑定到 `window`。

增加一个特权操作需要同时修改三个层级：

1. 在主进程中注册并校验处理器。
2. 将通道参数和结果添加到共享 invoke 契约。
3. 从预加载桥接层暴露范围明确的方法，并在渲染进程中调用。

渲染进程不得导入 Electron 模块或直接调用原始 IPC 通道。

### 渲染进程

渲染进程负责展示和应用状态。它可以使用浏览器 API 和预加载桥接，但必须把特权操作返回值视为可能失败的不可信结果。

`ToolsPage` 同时也是渲染进程的故障隔离边界。每个延迟加载的 React 工具和 iframe 宿主都独立包裹，因此导入失败或渲染异常只会显示可重试的工具级错误，不会替换整个工作区。长时间运行的转换操作必须丢弃过期结果；新操作开始或工具卸载时，应取消 Worker、定时器和监听器。

## 内置工具发现

内置工具位于 `core/renderer/components/ModuleTools/<ToolName>/`。Vite 通过 `core/renderer/data/placeholder.ts` 中的 `import.meta.glob` 发现其 `manifest.json` 和 React 入口。

清单可以选择两种入口模型：

- `.tsx` 入口作为 React 组件延迟加载。
- `.html` 入口作为隔离的内置 Web 页面提供。

英文和简体中文语言文件由渲染进程国际化层单独发现。分类由 `core/renderer/data/placeholder.ts` 中的 `categoryDefs` 固定定义，清单负责把工具分配到这些分类。

清单格式和开发流程请参阅[内置工具开发](tools.md)。

## Marketplace 运行时

Marketplace 插件包包含根目录 `manifest.json` 和一个 Web 入口。安装后的资源通过每个插件独立的 `devtoolbox-plugin://<plugin-id>/...` 源提供，并在沙箱 iframe 中运行；插件无法访问 Electron 或 Node.js API。

请求流程：

1. 插件 SDK 发送带版本号的 `postMessage` 请求。
2. `PluginHost` 同时校验 iframe 窗口及其绑定的插件源。
3. 渲染进程将 SDK 方法映射到批准的预加载方法。
4. 主进程校验插件清单、权限、参数和资源策略。
5. 结构化的成功或错误响应返回 iframe。

Marketplace 启动使用独立的就绪握手。`mountPlugin` 只在第一棵 React 树提交后发送 `devtoolbox:plugin:ready`，并持续重试直到 `PluginHost` 确认。收到该信号之前，宿主会让 iframe 保持加载状态；启动超时和加载错误会提供重新加载操作。普通内置 HTML 入口无需使用 Marketplace SDK，因此仍在 iframe `load` 事件触发后进入就绪状态。

插件存储按插件 ID 隔离。文件访问使用用户选择后生成的令牌。代理 HTTP 请求会执行域名白名单、DNS/私有地址检查、重定向校验、超时和响应大小限制。

主进程的 Marketplace 职责被有意拆分：

- `registry-client.ts` 获取、校验并缓存注册表。
- `plugin-repository.ts` 校验和持久化已安装插件状态。
- `plugin-installer.ts` 校验归档文件，在隔离暂存目录中解压，并以支持回滚的方式激活有效版本。
- `provenance.ts` 在下载或解压前校验已签名产物的身份、源码修订、受信任发布者范围和 Ed25519 签名。
- `capability-broker.ts` 对每个特权 SDK 调用重新检查启用状态、权限、参数、存储配额、文件令牌和网络策略。
- `ipc/marketplace.ts` 构造上述服务，并只注册公开的 Marketplace 操作。

插件包在下载前完成来源验证。签名声明将插件身份和特权清单字段与 ZIP 的 SHA-256、精确大小、发布时间、源码仓库、源码修订、发布者和密钥 ID 绑定。受信任密钥可以限制为明确的插件 ID 和源码仓库范围。无论处于何种模式，无效签名和超出受信任发布者范围的包都会被拒绝。

`core/main/marketplace/trusted-publishers.json` 控制迁移模式。官方公钥以明确的插件 ID 和源码仓库范围登记。`audit` 模式仍允许安装旧版未签名包，但会持久化并显示为未签名或不受信任；验证通过的包会在安装状态中保留发布者和源码修订。`strict` 模式只接受已登记发布者密钥的签名。这样可以先随应用分发已登记签名密钥，再启用严格校验，而不会把附带但无效的签名误认为可信。

如果私钥派生出的公钥、指纹、发布者、插件 ID 和源码仓库尚未登记，发布打包器会拒绝使用该私钥。独立的发布校验器会在上传前根据应用信任库检查每个 ZIP 的哈希、大小、范围和签名。

Plugin SDK 在工作区开发期间保留源码入口，并在 `core/packages/plugin-sdk/dist/` 下生成独立 npm 包。Marketplace 生产构建会创建并打包此发布产物。CI 还会在隐藏的 Electron 窗口中加载生产预加载脚本，确认 `contextBridge` 和有类型约束的 IPC 在打包运行时配置中正常工作。

清单、权限、SDK 和插件包生命周期请参阅[插件开发](plugins.md)。

## 本地诊断与隐私

DevToolBox 不会把运行时遥测发送到远程服务。主进程、渲染进程、工具和插件的异常事件会通过有类型约束的诊断 IPC 流转，并仅保存在本地应用数据目录。

主进程 `DiagnosticStore` 在持久化前执行以下控制：

- 递归移除凭据类字段、授权值、Cookie、内容/正文/载荷字段、私钥、URL 凭据和无结构插件详情字符串；
- 将消息和堆栈跟踪中的当前用户主目录前缀替换为 `~`；
- 限制嵌套深度、集合大小、字符串长度，将事件环限制为 500 条，并将序列化存储限制为 512 KiB；
- 每个来源/作用域组合每分钟最多保留 120 条事件，并统计被丢弃的事件；
- 在文件系统支持时，以仅所有者可读写的权限原子写入存储。

用户可以在 **设置 → 诊断** 中查看最近的脱敏事件、清除本地存储，或显式导出 JSON 支持包。支持包包含应用/运行时版本、非识别性平台元数据、保留计数器、当前启动/安全模式状态，以及已经脱敏的事件。生成的上下文不包含用户名、主机名、IP 地址、环境变量或本地存储内容。

诊断契约位于 `core/packages/core/src/electron-api.ts`，存储和脱敏位于 `core/main/diagnostics.ts`，IPC/导出位于 `core/main/ipc/diagnostics.ts`，渲染进程捕获位于 `core/renderer/lib/diagnostics.ts`。

## 启动健康与安全模式

主进程在创建应用窗口前原子写入启动健康标记。渲染进程保持挂载五秒并调用有类型约束的 `startup:rendererReady` IPC 方法后，本次启动才算完成。即使在这五秒内正常退出，也会把会话标记为已干净结束。

如果连续两个会话结束时仍标记为 `starting`，第三次启动会自动进入安全模式。安全模式为当前会话提供纵深防御：

- 工具分类、全局搜索和 iframe 宿主不加载 Marketplace 模块。
- `devtoolbox-plugin://` 协议拒绝插件资源。
- 主进程能力代理以 `safe_mode` 拒绝所有插件 SDK 操作。
- 内置工具、设置、模块中心和诊断导出仍然可用。

安全模式不会修改已安装插件的持久化 `enabled` 标记。用户可以查看或卸载插件、导出诊断，并从全局恢复提示或 **设置 → 诊断** 正常重启。同一页面也可以在排查问题时手动请求一次安全模式重启。健康的安全模式会话会清除崩溃序列，使下一次普通启动恢复正常。

状态机位于 `core/main/startup-health.ts`，IPC 和重新启动控制位于 `core/main/ipc/startup.ts`。单元测试覆盖启动未完成、健康确认、正常退出、自动隔离和手动安全/正常重启。

## 构建边界与发布元数据

渲染进程页面和内置工具使用动态导入，因此仪表盘不会预加载所有工作区、编辑器语言或转换引擎。Vite 输出 `dist/.vite/manifest.json`；`pnpm bundle:check` 会沿入口静态导入进行检查，并分别限制初始资源、普通延迟块，以及明确隔离的条码和 JavaScript 混淆引擎。发现体积回归时，应先检查清单依赖图，不要直接提高预算来隐藏问题。

Marketplace 模块遵循相同规则。共享 Vite 配置会在每个插件的 `package/` 目录中生成清单，`pnpm -C marketplace build` 最后会验证所有插件的初始 JavaScript、CSS、普通块和明确批准的大型数据块。

生产渲染进程冒烟测试使用隔离测试数据，通过真实的沙箱预加载桥接加载 `dist/index.html`。它会导航延迟页面、验证可选择文本和 JSON 输出、检查离线 Markdown 预览、在 Worker 中执行 JavaScript 混淆，并通过延迟加载的条码引擎渲染 PDF417。控制台错误、预加载失败、渲染进程退出、缺失块和交互超时都会导致 CI 失败。

`pnpm supply-chain:generate` 读取已安装的生产依赖树，拒绝缺失或禁止的许可证，并生成 CycloneDX SBOM 和 `THIRD_PARTY_NOTICES.md`。打包会把构建、包体校验和元数据生成作为一个准备步骤。发布工作流还会发布这些文件和 `SHA256SUMS`；Plugin SDK 和 Marketplace 发布流程为各自产物生成校验和。

### 已知第三方构建 warning

当构建命令最终成功退出时，`pnpm build` 可能打印以下已跟踪且当前可接受的第三方 warning：

- `javascript-obfuscator` 发布的浏览器代码中包含 `eval`。该包被隔离在 JavaScript 格式化工具的延迟 Worker chunk 中，包体预算也单独跟踪该 chunk。
- `terser` 可能包含 Rollup 无法解释并会在打包时移除的注释标记。该 warning 来自依赖源码，不会改变应用代码生成。

不要全局屏蔽这些 warning。应通过升级或替换产生 warning 的依赖来移除它们；任何变更后都需要重新运行 `pnpm build` 和 `pnpm bundle:check`。

## IPC 约定

内置操作和 Marketplace 操作都遵循以下规则：

- 暴露面向能力的方法，不提供通用命令或路径访问。
- 在主进程中重新校验每个值；渲染进程校验只用于改善用户体验。
- 通道注册保留在主进程代码中，桥接调用保留在预加载代码中。
- 跨进程边界优先返回结构化结果，不依赖抛出异常。
- 在 React 清理阶段移除监听器，并把事件流限制在所属窗口或会话。
- 常规日志中不得写入密钥、文件内容或完整请求正文。

内置 MQTT 工具是有状态 IPC 服务的示例。主进程处理器持有连接并发送 `mqtt:event` 更新；渲染进程只调用有类型约束的连接、订阅、发布和断开方法。

## 安全边界

- 渲染进程代码不得执行任意命令。
- 文件读写必须来自明确的用户操作或此前签发的令牌。
- 外部 URL 和网络目标必须在主进程中校验。
- Marketplace 权限只是声明，不代表信任；每个 SDK 调用都在运行时检查。
- 插件 iframe 不得直接调用内部 IPC 或预加载方法。
- 主窗口导航在开发环境中仅允许已配置的 Vite 来源，在生产环境中仅允许打包后的渲染进程入口文档；弹出窗口和跨来源重定向都会被拒绝。
- 主渲染进程使用严格的内容安全策略。生成的富文本或语法标记必须通过 `components/SafeHtml` 渲染；架构校验会拒绝其他位置直接使用 `dangerouslySetInnerHTML`。
- 开发和打包版本都保持 Chromium Web 安全启用；本地注册表通过明确的主进程例外处理。
- 保持预加载接口最小化，不要暴露原始 `ipcRenderer`。

安全敏感变更还应遵循仓库[安全策略](https://github.com/jacobs-256/devToolBox/blob/main/SECURITY.md)。

## 修改位置

| 变更内容                  | 主要位置                                                               |
| ------------------------- | ---------------------------------------------------------------------- |
| 内置工具 UI 或逻辑        | `core/renderer/components/ModuleTools/<ToolName>/`                     |
| 应用导航或页面            | `core/renderer/components/`                                            |
| 净化后的生成 HTML         | `core/renderer/components/SafeHtml/`                                   |
| 主题和共享样式            | `core/renderer/theme/`                                                 |
| 共享 React 原语           | `core/packages/ui/`                                                    |
| 原生或特权操作            | `core/main/ipc/` 或 `core/main/modules/`，以及预加载和渲染进程类型     |
| Marketplace 生命周期/安全 | `core/main/marketplace/` 和 `core/main/ipc/marketplace.ts`             |
| 插件 iframe 消息桥接      | `core/renderer/components/PluginHost/`                                 |
| 诊断、脱敏和导出          | `core/main/diagnostics.ts`、`core/main/ipc/diagnostics.ts` 和设置页面  |
| 启动健康和安全模式        | `core/main/startup-health.ts`、`core/main/ipc/startup.ts` 和 `App.tsx` |
| 插件源码                  | `marketplace/modules/<market-id>/`                                     |
| 清单或脚手架校验          | `scripts/`                                                             |
