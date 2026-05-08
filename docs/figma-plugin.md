## DevToolBox UI Kit Generator（Figma 本地插件）

用途：一键生成/更新 DevToolBox UI Kit 的基础结构与 Tokens（Color/Text Styles），用于快速在 Figma 中落地设计系统。

### 1) 构建插件

在项目根目录执行：

```bash
node figma/plugins/devtoolbox-ui-kit-generator/build.mjs
```

构建产物：

- `figma/plugins/devtoolbox-ui-kit-generator/dist/code.js`

### 2) 在 Figma 中导入（Development plugin）

1. 打开 Figma（Web 或 Desktop 均可）
2. 菜单：Plugins → Development → Import plugin from manifest…
3. 选择本项目中的 `figma/plugins/devtoolbox-ui-kit-generator/manifest.json`

### 3) 运行

在目标文件（例如 DevToolBox UI Kit）中：

1. Plugins → Development → DevToolBox UI Kit Generator
2. 点击“生成/更新 UI Kit”

会创建/更新：

- Pages：0 Cover / 1 Tokens / 2 Components / 3 Templates / 4 Archive
- Color Styles：`Color/...`
- Text Styles：`Text/...`
- 页面基础 Frame 结构（Cover/Tokens/Components/Templates/Archive）

