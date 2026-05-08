## DevToolBox Figma UI Kit 规范（草案）

目标：基于当前 DevToolBox（暗色主题）做一次“更统一、更现代”的 UI 系统升级，形成可在 Figma 落地的一套 Tokens + Components + Page Templates，后续由自动化在 Figma 中搭建。

### 1. 设计原则

- 暗色优先：保证长时间使用的舒适度与信息层级清晰
- 组件一致：按钮/输入/卡片/列表在所有页面保持统一尺寸、圆角、间距、状态
- 信息密度可控：默认偏紧凑（DevToolBox 适合工具集合），但提供舒适/紧凑两档尺寸策略（后续可扩展）
- 可读性：正文对比度适中、强调信息使用更亮文本与统一强调色

### 2. Tokens（Design Tokens）

#### 2.1 颜色（基于现有 variables.css，建议标准化命名）

语义色（建议在 Figma Styles 中以 `Color/` 分类）：

- Color/Bg/Primary: `#282C34`
- Color/Bg/Sidebar: `#21252B`
- Color/Bg/Panel: `#21252B`
- Color/Bg/Content: `#2C313A`
- Color/Bg/Hover: `rgba(255,255,255,0.06)`
- Color/Bg/Active: `rgba(255,255,255,0.10)`

- Color/Text/Primary: `#ABB2BF`
- Color/Text/Secondary: `rgba(171,178,191,0.68)`
- Color/Text/Active: `#E6E6E6`

- Color/Accent/Primary: `#61AFEF`
- Color/Accent/Weak: `rgba(97,175,239,0.25)`

- Color/Border/Default: `rgba(255,255,255,0.08)`
- Color/Border/Focus: `rgba(97,175,239,0.90)`

状态色（现有项目中多处用 `--color-error`，建议在 UI Kit 里补齐一套）：

- Color/Status/Error: `#E74C3C`
- Color/Status/Success: `#50C878`
- Color/Status/Info: `#4AA3FF`
- Color/Status/Warning: `#F5C542`

#### 2.2 字体（Typography）

- Font/Family/Sans: `ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial`
- Font/Family/Mono: `ui-monospace, SFMono-Regular, SF Mono, Menlo, Monaco, Consolas`

字号（建议在 Figma Text Styles 中以 `Text/` 分类）：

- Text/Title: 18px / 600
- Text/Heading: 15px / 600
- Text/Body: 13px / 400（现有 `--font-size-base`）
- Text/Small: 12px / 400
- Text/XS: 11px / 400
- Text/Mono/Body: 12px / 400（用于日志、输出、代码）

行高：

- LineHeight/Base: 1.55

#### 2.3 间距（Spacing）与尺寸（Sizing）

建议以 4px 为基准：

- Space/0: 0
- Space/1: 4
- Space/2: 8
- Space/3: 12
- Space/4: 16
- Space/5: 20
- Space/6: 24

交互控件高度（建议统一）：

- Control/Height/Sm: 28
- Control/Height/Md: 32（当前 WebSocketTester 已统一到 32）
- Control/Height/Lg: 36

#### 2.4 圆角与阴影（Radius / Shadow）

- Radius/Sm: 6（现有 `--radius-small`）
- Radius/Md: 8（现有 `--radius`）
- Shadow/Float: `0 12px 32px rgba(0,0,0,0.35)`（现有 `--shadow-float`）

### 3. Components（组件库）

建议在 Figma 中用 `Components/` 页面，分区为 `Atoms / Molecules / Organisms`。

#### 3.1 Button

Variants：

- Button/Default
- Button/Primary
- Button/Danger

States：

- Default / Hover / Active / Disabled / Focus

规格：

- 高度：32（默认）
- 左右 padding：12~14
- 圆角：6
- 图标按钮：32x32（Icon + tooltip）

#### 3.2 Input / TextArea / Select

规格：

- 高度：32（输入/下拉）
- padding：0 10
- 圆角：6
- Border：Default/Focus 两态

带前缀/后缀/清除按钮版本：

- Input/WithPrefix
- Input/WithSuffix
- Input/Search（带搜索图标）

#### 3.3 Checkbox / Switch

- Checkbox：14x14（与现有一致）
- Switch：用于 Enabled/On-Off

#### 3.4 Tabs

用于 Modules（Installed / Marketplace）等：

- Tabs/Segmented
- Tabs/Underline（可选）

#### 3.5 Badge / Pill

- Pill/Default（用于版本号、状态）
- Badge/Info / Success / Warning / Error（用于提示与计数）

#### 3.6 Card / List Item

用于工具卡片、插件卡片、设置项：

- Card/Surface
- ListItem/Row（左：标题+描述，右：操作区）

#### 3.7 Modal / Dialog

用于 Settings、Export/Import、确认弹窗：

- Modal/Base（带标题、内容区、按钮区）
- Dialog/Confirm

#### 3.8 Layout：TopNav / Sidebar / Content

TopNav：

- 高度：48
- 左侧：Dashboard + 分类入口
- 右侧：Modules/Settings 等入口

Sidebar（Category Sidebar）：

- 宽度：68（现有 `--sidebar-width`）

ModulePanel：

- 宽度：252（现有 `--panel-width`）

#### 3.9 Tool Page Patterns（工具页通用）

工具页建议统一成三段式：

- Header Bar：标题 + 主操作（可选）
- Body：主要内容（可滚动）
- Footer Bar：输入区/操作区（可选）

WebSocketTester：

- Split Layout：左右双栏（可折叠）+ 顶部统一 Header + 底部 Expand/Restore
- Log List：按 `System/Send/Recv/Error` 色块区分（已落地到 Client/Server）

### 4. Page Templates（页面模板）

建议在 Figma 中用 `Pages/` 页面存放模板：

- Pages/Dashboard
- Pages/Tools（左侧分类 + 工具列表 + 内容区）
- Pages/Modules（Installed/Marketplace）
- Pages/Settings
- Pages/GlobalSearch
- Pages/Tool/WebSocketTester

每个模板输出内容：

- 1440x900 Frame（Desktop）
- 设计标注：Spacing、组件用法、交互状态（hover/active/disabled）

### 5. 交互与细节（建议）

- Hover：背景 `Bg/Hover`，文字 `Text/Primary`
- Active：背景 `Bg/Active`
- Focus：边框 `Border/Focus`
- Danger 操作：使用 Error 色 + 二次确认（如卸载插件）
- 日志/输出：统一使用 Mono 字体，支持 Copy（可选）

### 6. Figma 结构（建议）

- 0 Cover（封面）
- 1 Tokens（Color / Type / Spacing / Radius / Shadow）
- 2 Components（按钮/输入/卡片/标签/弹窗/导航）
- 3 Templates（Dashboard/Tools/Modules/Settings/Tool pages）
- 4 Archive（历史版本）

