# 项目与社区

[English](../../project/governance.md) | [简体中文](governance.md)

GitHub 可自动发现的社区规范保留在仓库根目录，并作为权威版本；文档站只链接这些文件，不维护重复副本。项目方向和发布信息统一维护在本节中。

## 参与贡献

请阅读[贡献指南](https://github.com/XthingsJacobs/devToolBox/blob/main/CONTRIBUTING.md)，了解环境要求、质量检查、拉取请求要求和扩展开发流程。

技术入口：

- [快速开始](../getting-started.md)
- [架构说明](../development/architecture.md)
- [内置工具开发](../development/tools.md)
- [Marketplace 插件开发](../development/plugins.md)
- [设计系统](../development/design-system.md)

## 社区规范

- [社区行为准则](https://github.com/XthingsJacobs/devToolBox/blob/main/CODE_OF_CONDUCT.md)：贡献者行为要求和私密举报方式。
- [支持](https://github.com/XthingsJacobs/devToolBox/blob/main/SUPPORT.md)：提问渠道和错误报告应包含的信息。
- [安全策略](https://github.com/XthingsJacobs/devToolBox/blob/main/SECURITY.md)：受支持版本、私密漏洞报告和安全边界。

请勿为疑似安全漏洞创建公开 Issue。

## 路线图

DevToolBox 正在向面向通用开发者、插件优先的一体化桌面工具箱持续演进。

### 当前：稳定性与采用体验

- 改善首次启动、安装、更新和诊断体验。
- 提升 Marketplace 注册表和插件安装的可靠性。
- 备份已登记的 Marketplace 签名密钥，配置发布密钥，并完成从审计模式到严格模式的迁移。
- 发布清晰的插件开发教程和最佳实践。
- 筛选一小组高质量插件作为参考实现。

### 下一步：发展插件生态

- 增加包含截图、标签和更好发现能力的插件画廊。
- 建立插件提交校验、审阅清单和 CI 辅助工具。
- 记录社区发布者登记和签名密钥轮换流程。
- 扩展共享插件 UI 原语和国际化辅助能力。

### 后续：支持更大型的工作流

- 增加集合、预设保存和面向导出的工作流工具。
- 探索面向团队的可选共享工作区同步。
- 通过插件扩展网络诊断和协议工具。

### 如何参与

- 选择带有 `good first issue` 或 `help wanted` 标签的 Issue。
- 通过功能请求提出插件创意。
- 开发插件并提交到插件画廊。

## 发布与法律信息

- [更新记录](changelog.md)
- [GitHub Releases](https://github.com/XthingsJacobs/devToolBox/releases)
- [声明](notice.md)
- [Apache-2.0 许可证](https://github.com/XthingsJacobs/devToolBox/blob/main/LICENSE)

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
