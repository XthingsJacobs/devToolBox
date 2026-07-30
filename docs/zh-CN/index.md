# DevToolBox 文档

[English](../index.md) | [简体中文](index.md)

DevToolBox 是一款使用 Electron、React、TypeScript 和 Vite 构建的跨平台桌面工具箱，集成了内置开发工具与隔离运行的 Marketplace 插件系统。

## 选择阅读路径

| 我想要……              | 从这里开始                                 |
| --------------------- | ------------------------------------------ |
| 安装或运行 DevToolBox | [快速开始](getting-started.md)             |
| 理解仓库和应用架构    | [架构说明](development/architecture.md)    |
| 添加内置工具          | [内置工具开发](development/tools.md)       |
| 开发 Marketplace 插件 | [插件开发](development/plugins.md)         |
| 使用 Plugin SDK API   | [插件 SDK 参考](development/plugin-sdk.md) |
| 遵循 UI 规范          | [设计系统](development/design-system.md)   |
| 参与贡献或报告问题    | [项目与社区](project/governance.md)        |

## 应用的组成方式

- Electron **主进程**负责操作系统访问、存储、网络和 IPC 处理器。
- **预加载桥接层**向渲染进程暴露受限且有类型定义的 API。
- React **渲染进程**根据清单发现内置工具，并负责桌面界面展示。
- Marketplace 插件在沙箱 iframe 中运行，通过 Plugin SDK 申请所需能力。

内置工具和 Marketplace 插件是两种有意分离的扩展模型。如果功能需要随应用发布并使用有类型约束的预加载 API，应选择内置工具；如果功能应当独立打包、安装和授权，则应选择 Marketplace 插件。

## 文档地图

### 使用应用

- [快速开始](getting-started.md)：下载、源码运行、CLI 命令、打包和故障排查。

### 开发应用

- [架构说明](development/architecture.md)：进程边界、仓库结构、模块发现、IPC 和安全边界。
- [内置工具开发](development/tools.md)：脚手架、清单、本地化、UI 模式、IPC 和验证。
- [插件开发](development/plugins.md)：插件生命周期、权限、本地注册表和打包。
- [插件 SDK 参考](development/plugin-sdk.md)：SDK 命名空间、方法签名、参数、返回值、限制和错误码。
- [设计系统](development/design-system.md)：当前设计变量、组件约定、页面模式和设计稿指南。

### 项目信息

- [项目与社区](project/governance.md)：贡献方式、社区规范、发布信息和文档维护职责。
- [更新记录](project/changelog.md)：文档层面的版本更新说明。
- [声明](project/notice.md)：版权和第三方软件声明。

## 权威信息来源

文档用于解释当前实现，但以下可执行内容始终具有最终解释权：

- 内置工具元数据：各工具的 `manifest.json`
- Marketplace 清单类型：`core/packages/core/src/index.ts`
- 插件客户端 SDK：`core/packages/plugin-sdk/src/index.ts`
- 渲染进程到主进程的 API：`core/main/preload/index.ts` 和 `core/renderer/types/electron.d.ts`
- 仓库命令：`package.json`、`cli.sh` 和 `cli.ps1`
