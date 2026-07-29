# 快速开始

[English](../getting-started.md) | [简体中文](getting-started.md)

本指南介绍如何安装 DevToolBox、从源码运行、使用仓库 CLI、打包安装程序，以及解决常见的本地开发问题。

## 安装发布版本

从 [GitHub Releases](https://github.com/jacobs-256/devToolBox/releases) 下载已打包的版本。通过 **模块 → Marketplace → 刷新 → 安装** 安装 Marketplace 插件。

后续章节面向需要在仓库中工作的贡献者和插件开发者。

## 从源码运行

### 环境要求

- Node.js 20 或更高版本（`.nvmrc` 记录默认贡献者版本）
- pnpm 10 或更高版本（仓库默认固定使用 `pnpm@10.10.0`）
- Git

安装依赖并启动桌面开发服务器：

```bash
pnpm install
pnpm dev
```

等效的 CLI 流程：

```bash
./cli.sh doctor
./cli.sh dev
```

在 Windows PowerShell 中，请使用 Windows 入口：

```powershell
.\cli.ps1 doctor
.\cli.ps1 dev
```

如果 macOS/Linux 上的 `cli.sh` 没有执行权限，请先运行一次 `chmod +x ./cli.sh`。

## 仓库 CLI

`cli.sh` 和 `cli.ps1` 是常用开发和打包流程的统一入口。macOS/Linux 使用 `cli.sh`，Windows PowerShell 使用 `cli.ps1`。运行 `./cli.sh help` 或 `.\cli.ps1 help` 查看当前命令列表。

| 命令                             | 用途                                                 |
| -------------------------------- | ---------------------------------------------------- |
| `./cli.sh doctor`                | 显示检测到的 Node.js、pnpm 和 Git 版本。             |
| `./cli.sh dev`                   | 启动 Electron 开发环境。                             |
| `./cli.sh build`                 | 进行类型检查并构建渲染进程、主进程和预加载桥接。     |
| `./cli.sh check`                 | 运行 Lint、类型检查和测试。                          |
| `./cli.sh tool new`              | 启动交互式内置工具生成器。                           |
| `./cli.sh plugin create`         | 创建 Marketplace 插件模板。                          |
| `./cli.sh plugin <market-id>`    | 构建并将一个插件打包到本地注册表。                   |
| `./cli.sh plugin all`            | 构建并打包所有本地 Marketplace 插件。                |
| `./cli.sh package <目标> [架构]` | 构建 macOS 或 Windows 安装程序。                     |
| `./cli.sh clear`                 | 以交互方式清理选定的用户数据、缓存、插件或构建产物。 |

在 Windows 中，将 `./cli.sh` 替换为 `.\cli.ps1`；Windows 打包支持 `.\cli.ps1 package windows [x64]`。

`./cli.sh clear` 和 `.\cli.ps1 clear` 只会在交互确认后删除本地数据。使用前请关闭 DevToolBox，并仔细阅读每个提示。

## 构建和验证

构建应用但不生成安装程序：

```bash
pnpm build
```

运行标准质量检查：

```bash
pnpm lint
pnpm lint:docs
pnpm typecheck
pnpm test
pnpm build
pnpm test:electron
```

`test:electron` 会在隐藏的 Electron 窗口中加载生产环境预加载脚本，因此应在 `pnpm build` 之后运行。

`pnpm lint` 会验证内置工具和 Marketplace 清单、架构边界以及文档一致性。贡献者也可以分别运行 `pnpm lint:modules`、`pnpm lint:boundaries` 或 `pnpm lint:docs` 进行专项检查。

## 打包安装程序

常用示例：

```bash
./cli.sh package macos arm64
./cli.sh package macos x64
./cli.sh package macos universal
./cli.sh package windows
./cli.sh package all
```

Windows PowerShell：

```powershell
.\cli.ps1 package windows
.\cli.ps1 package windows x64
```

不带参数运行 `./cli.sh package` 可进入交互流程。

- macOS 安装包以 `.dmg` 文件写入 `release/`。
- Windows 安装包以 `.exe` 文件写入 `release/`。
- 通常应在目标操作系统上执行打包。在 macOS 上构建 Windows 安装包可能需要 Wine 和 Mono，使用 CI 或 Windows 设备会更可靠。
- 在 Windows 上，`.\cli.ps1 package` 会将控制台切换为 UTF-8，并预先准备 electron-builder 的 `winCodeSign` 资源工具。如果 GitHub 返回 `504`，稍后重试或设置 `ELECTRON_BUILDER_BINARIES_MIRROR`。如果 7-Zip 提示符号链接权限，请启用 Windows 开发者模式或以管理员身份运行 PowerShell；当 Windows 文件已解压时，CLI 会尝试修复本地缓存。

## 备份保护

备份文件包含应用设置、Marketplace 状态和插件键值数据。请根据文件用途选择保护方式：

- 不保护：创建压缩但未加密的备份。
- 设备保护：使用当前 DevToolBox 安装进行加密，不支持跨设备迁移。
- 密码保护：创建可移植的加密备份；请使用至少八个字符的密码，并单独保存密码。
- 同时启用两种保护：恢复时必须使用同一设备并提供密码。

当前版本仍可导入包含旧版内置兼容层的历史备份，但新备份不再把应用内置密钥视为保密边界。

## 故障排查

### 导出诊断包

打开 **设置 → 诊断** 查看最近的本地运行事件。向维护者反馈问题时，可以使用 **导出诊断包**。只有在你选择保存位置后才会生成 JSON 文件，其中包含已脱敏事件、应用和运行时版本，以及当前启动/安全模式状态；生成的上下文不会包含用户名、主机名、IP 地址、环境变量或本地存储内容。事件在保存前会移除凭据类字段以及内容、正文和载荷字段。

使用 **清除日志** 可删除本地保留的事件。DevToolBox 不会自动上传诊断信息。

### DevToolBox 以安全模式启动

如果连续两次启动在渲染进程进入健康状态前失败，下一次启动会暂时停用所有 Marketplace 插件。内置工具和模块中心仍然可用，任何插件都不会被永久禁用。

请检查 **设置 → 诊断**，必要时导出诊断包，并在 **模块** 页面卸载或禁用可疑插件。准备完成后选择 **正常重启**。也可以先从诊断页面选择 **以安全模式重启**，再复现与插件相关的启动问题。

### 依赖安装缓慢或失败

确认可以访问 npm 注册表，然后清理 pnpm 存储并重试：

```bash
pnpm store prune
pnpm install
```

### CI 通过但本地检查失败

先检查版本：

```bash
./cli.sh doctor
```

Windows PowerShell：

```powershell
.\cli.ps1 doctor
```

请使用 Node.js 20 或更高版本、pnpm 10 或更高版本和当前锁文件。如果依赖不完整，请重新运行 `pnpm install`。


### Windows 窗口缺少原生控制按钮

Windows 和 Linux 的开发窗口会以最大化方式打开，而不是进入独占全屏，因此应保留系统原生的最小化、最大化和关闭按钮。如果看不到这些按钮，请确认正在运行包含当前主进程窗口行为的构建，并重启 DevToolBox。
### 录制导出提示缺少 `ffmpeg`

`KvsWebrtcViewer` 的录制导出需要系统安装 `ffmpeg`。在 macOS 上运行：

```bash
brew install ffmpeg
```

在 Linux 或 Windows 上安装对应的系统软件包，并确保可执行文件位于 `PATH` 中。

### Ping 或路由追踪在不同系统上行为不同

Windows 与 macOS/Linux 使用不同的命令名称和参数。主进程已经处理已知的平台差异，但受限 Shell、容器和托管设备仍可能阻止底层网络诊断，或要求额外权限。

### 本地 Marketplace 插件不可见

重新构建本地注册表，然后确认设置页面指向生成的 `file://` 注册表 URL：

```bash
./cli.sh plugin <market-id>
```

Windows PowerShell：

```powershell
.\cli.ps1 plugin <market-id>
```

修改注册表 URL 后刷新 Marketplace。完整的本地安装流程请参阅[插件开发](development/plugins.md)。

## 后续阅读

- 修改进程或 IPC 边界前，请先阅读[架构说明](development/architecture.md)。
- 开发随应用发布的工具，请遵循[内置工具开发](development/tools.md)。
- 开发独立打包的扩展，请遵循[插件开发](development/plugins.md)。
