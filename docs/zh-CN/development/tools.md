# 内置工具开发

[English](../../development/tools.md) | [简体中文](tools.md)

内置工具随 DevToolBox 一起发布，并通过清单自动发现。本指南涵盖从脚手架生成到最终验证的完整开发流程。

源码环境配置和仓库命令请先阅读[快速开始](../getting-started.md)；进程边界请阅读[架构说明](architecture.md)。

## 创建工具

请使用生成器，而不是复制现有模块：

```bash
pnpm new:tool
```

非交互式生成示例：

```bash
pnpm new:tool TimestampConverter --category dev-tools
```

可用选项：

```text
--category <categoryId>
--id <moduleId>
--name <displayName>
--description <description>
--with-help
```

`./cli.sh tool new` 可以通过仓库 CLI 打开同一个生成器。

## 模块结构

生成的模块位于 `core/renderer/components/ModuleTools/<ToolName>/`：

```text
<ToolName>/
├── manifest.json
├── index.tsx
├── <ToolName>.module.css
└── locales/
    ├── en.ts
    └── help-en.md             可选
```

只有三个项目是必需的：有效的清单、清单声明的入口文件，以及 `locales/en.ts`。CSS Modules 和帮助内容均为可选项。

## 清单

示例：

```json
{
  "id": "core-timestamp-converter",
  "name": "Timestamp Converter",
  "description": "Convert timestamps and formatted dates",
  "sdkVersion": "core",
  "entry": "./index.tsx",
  "categoryId": "dev-tools",
  "author": "DevToolBox",
  "iconKey": "vsc:VscClock",
  "permissions": []
}
```

运行时接口为 `core/renderer/data/placeholder.ts` 中的 `CoreToolManifest`。

| 字段          | 要求                                                                                 |
| ------------- | ------------------------------------------------------------------------------------ |
| `id`          | 唯一、稳定、使用 kebab-case，并以 `core-` 开头。                                     |
| `name`        | 英文回退显示名称。                                                                   |
| `description` | 英文回退简介。                                                                       |
| `sdkVersion`  | 内置工具必须为 `core`。                                                              |
| `entry`       | 模块目录内存在的 `.tsx` 或 `.html` 文件。                                            |
| `categoryId`  | `dev-tools`、`text-tools`、`network-tools`、`security-tools` 或 `other-tools` 之一。 |
| `iconKey`     | 可选的已注册图标键，通常来自 `vsc:` 图标集。                                         |
| `permissions` | 为声明能力预留的数组；不需要能力时使用空数组。                                       |

校验器会拒绝越出模块目录的入口、未知分类、缺失的英文语言文件和重复 ID。

## 入口类型

### React 入口

大多数工具使用 `./index.tsx`，并默认导出一个 React 组件。渲染进程会延迟加载它，并放入共享应用外壳中。

当交互模式匹配时，请使用 `core/packages/ui` 提供的组件和 Hook。工具专属状态和格式化逻辑应保留在模块内部，而不是扩展全局应用状态。

应用会在单个工具边界捕获延迟导入和渲染失败，并提供重试或关闭操作。工具仍需负责自身生命周期：新任务替代旧任务时取消 Worker 和请求，在清理阶段移除全局监听器，并保护异步状态更新，避免旧操作覆盖新结果。

未处理的渲染错误会自动记录到本地诊断流。对于没有到达错误边界、但可以恢复的异常，请使用共享渲染进程诊断工具，提供稳定的工具作用域和简短的运行信息。不得附带编辑器输入、生成的密钥、文件内容、HTTP 正文或用户凭据；主进程脱敏只是最终保护措施，并不意味着可以收集这些数据。

### 隔离的 HTML 入口

清单可以指向 `.html` 文件，以提供 Web 风格的隔离入口。仅在工具无法合理共享 React 应用运行时时使用该方式。普通内置 React 工具应优先使用 `.tsx`。

## 本地化和帮助

每个模块都必须包含 `locales/en.ts`。将可见标签、操作、占位符、回退名称和回退描述放在语言文件中，不要直接写死在 JSX 中。

按照现有模块的方式，在英文文件旁添加其他受支持语言。使用 `--with-help` 时，生成器还会创建 `locales/help-en.md`；较长的说明和示例应放在这里，不要挤占工具界面。

清单中的英文 `name` 和 `description` 仍然是必需项，因为它们是在 React 翻译生命周期之外使用的稳定回退元数据。

## UI 约定

- 使用 `ToolSection` 作为工具顶层容器，保持标题、间距和操作一致。
- 多个操作需要在窄窗口中折叠时，使用 `ResponsiveActions`。
- 双栏可调整布局使用 `useSplitPane`，不要重复实现拖拽逻辑。
- 编辑器、输出或日志中的 Ctrl/Cmd+F 搜索使用 `useTextSearch` 和 `SearchBar`。
- 使用 `core/renderer/theme/variables.css` 中的主题变量，不要硬编码第二套颜色。
- 突出主要操作，并将破坏性操作单独分组。
- 在亮色和暗色主题以及窄窗口宽度下验证工具。

完整的设计变量和组件说明请参阅[设计系统](design-system.md)。

## 添加特权行为

只使用浏览器能力的工具不需要 IPC。必须使用原生能力时：

1. 在 `core/main/ipc/` 中添加范围明确的应用处理器，或在 `core/main/modules/` 中添加工具专属处理器。
2. 在处理器中校验参数并执行安全约束。
3. 从 `core/main/preload/index.ts` 暴露方法。
4. 在 `core/renderer/types/electron.d.ts` 中添加方法签名。
5. 调用有类型约束的 `window.electronAPI` 方法，并处理不可用和错误结果。

不要暴露原始 IPC 通道、任意命令或不受限制的文件路径。边界规则请参阅[架构说明](architecture.md)。

## 验证变更

迭代过程中运行针对性的清单检查：

```bash
pnpm lint:modules
```

打开拉取请求前运行：

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

对于 UI 变更，请手动验证正常、空、加载、错误和溢出状态。如果行为涉及视觉变化，请在拉取请求中附上截图或录屏。

## 完成检查清单

- 清单 ID 稳定且分类有效。
- 所有可见字符串均已本地化，并包含英文版本。
- 工具在适用位置使用共享布局和主题原语。
- 特权操作通过有类型约束的预加载边界。
- 错误和空状态清晰易懂。
- 模块 Lint、类型检查、测试和构建全部通过。
