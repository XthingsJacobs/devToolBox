# 项目与社区

[English](../../project/governance.md) | [简体中文](governance.md)

GitHub 可自动发现的社区规范保留在仓库根目录，并作为权威版本；文档站只链接这些文件，不维护重复副本。项目方向和发布信息统一维护在本节中。

## 参与贡献

请阅读[贡献指南](https://github.com/jacobs-256/devToolBox/blob/main/CONTRIBUTING.md)，了解环境要求、质量检查、拉取请求要求和扩展开发流程。

技术入口：

- [快速开始](../getting-started.md)
- [架构说明](../development/architecture.md)
- [内置工具开发](../development/tools.md)
- [Marketplace 插件开发](../development/plugins.md)
- [设计系统](../development/design-system.md)

## 社区规范

- [社区行为准则](https://github.com/jacobs-256/devToolBox/blob/main/CODE_OF_CONDUCT.md)：贡献者行为要求和私密举报方式。
- [支持](https://github.com/jacobs-256/devToolBox/blob/main/SUPPORT.md)：提问渠道和错误报告应包含的信息。
- [安全策略](https://github.com/jacobs-256/devToolBox/blob/main/SECURITY.md)：受支持版本、私密漏洞报告和安全边界。

请勿为疑似安全漏洞创建公开 Issue。

## 如何参与

- 选择带有 `good first issue` 或 `help wanted` 标签的 Issue。
- 通过功能请求提出插件创意。
- 开发插件并提交到插件画廊。

适合新手的 Marketplace Issue 应该范围小、可复现，并且不依赖私有服务即可评审。合适的例子包括：

- 为现有插件补充截图、本地化描述或更清晰的权限说明。
- 把一个小型公开 API 做成只读插件，并只声明一个有文档依据的 `httpDomains` 条目。
- 给示例或故障排查页面补充缺失的 `plugin doctor` 指引。
- 改善插件的空状态、加载状态、错误状态和权限拒绝状态。
- 添加覆盖一个校验边界情况的测试或 fixture manifest。

## 发布与法律信息

- [更新记录](changelog.md)
- [GitHub Releases](https://github.com/jacobs-256/devToolBox/releases)
- [声明](notice.md)
- [Apache-2.0 许可证](https://github.com/jacobs-256/devToolBox/blob/main/LICENSE)

## 文档维护职责

MkDocs 内容按照读者任务组织：

```text
docs/
├── index.md
├── getting-started.md
├── development/
│   ├── architecture.md
│   ├── tools.md
│   ├── plugins.md
│   └── design-system.md
├── project/
│   ├── governance.md
│   ├── changelog.md
│   └── notice.md
└── zh-CN/                       与英文页面保持相同路径的简体中文译本
```

实现发生变化时，只更新最小范围的权威页面，并通过链接引用，不要在多个页面复制相同说明。清单、共享类型、`package.json`、`cli.sh` 和 `cli.ps1` 等可执行文件始终是最终的信息来源。
