# DevToolBox — 插件优先的一体化桌面开发工具箱

[English](../../README.md) | [简体中文](README.md)

[![CI](https://github.com/XthingsJacobs/devToolBox/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/XthingsJacobs/devToolBox/actions/workflows/ci.yml)
[![CodeQL](https://github.com/XthingsJacobs/devToolBox/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/XthingsJacobs/devToolBox/actions/workflows/codeql.yml)
![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)

DevToolBox 是一款使用 Electron、React、TypeScript 和 Vite 构建的跨平台桌面开发工具箱。

项目致力于提供一个插件优先的一体化开发工作台，将常用开发工具集中在一个应用中：

- 内置工具模块：格式化、编解码、加密、网络、MQTT、JWT、文本对比等。
- Marketplace 插件：支持安装、更新以及自行开发独立插件。
- 一个应用、一处搜索、一个工作区，减少分散脚本和临时工具带来的切换成本。

## 推荐工具

建议优先体验以下内置工具：

- Markdown 预览
- 二维码生成器
- MQTT 工具

仓库中还包含以下 Marketplace 示例插件：

- `market-ip-lookup`：支持多服务商回退的 IP 地理位置查询。
- `market-exchange-rate`：汇率查询和货币换算。
- `market-matter-catalog`：查询 Matter 设备类型及其集群要求。

## 快速入口

| 目标                  | 文档                                           |
| --------------------- | ---------------------------------------------- |
| 下载和使用 DevToolBox | [快速开始](getting-started.md)                 |
| 参与项目贡献          | [贡献指南](../../CONTRIBUTING.md)              |
| 了解应用架构          | [架构说明](development/architecture.md)        |
| 添加内置工具          | [内置工具开发](development/tools.md)           |
| 开发 Marketplace 插件 | [Marketplace 插件开发](development/plugins.md) |
| 遵循界面和组件规范    | [设计系统](development/design-system.md)       |

可从 [GitHub Releases](https://github.com/XthingsJacobs/devToolBox/releases) 下载已打包的版本。在应用中通过 **模块 → Marketplace → 刷新 → 安装** 安装插件。

## 项目信息

- [完整文档](index.md)
- [路线图](project/governance.md#路线图)
- [更新记录](project/changelog.md)
- [社区行为准则](../../CODE_OF_CONDUCT.md)
- [安全策略](../../SECURITY.md)
- [支持与反馈](../../SUPPORT.md)

## 仓库结构

```text
devtoolbox/
├── core/                              Electron 应用（主进程、预加载和渲染进程）
├── docs/                              开发文档和 MkDocs 内容源
├── docs-site/                         MkDocs 站点配置
├── marketplace/                       Marketplace 插件工作区
├── scripts/                           校验、脚手架和发布辅助脚本
├── package.json
└── pnpm-workspace.yaml
```

## 许可证

Apache-2.0
