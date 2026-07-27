## URL 编码/解码

URL（Uniform Resource Locator，统一资源定位符）用于定位互联网上的资源。它通常包含协议、服务器、端口、路径、查询参数和片段等部分。

URL 语法使用 ASCII 字符表示地址。对于中文、空格、特殊符号等可能与 URL 结构冲突的字符，需要使用百分号编码（Percent-Encoding），例如空格可编码为 `%20`。

## 语法

HTTP URL 常见组成部分：

1. 传输协议
2. 层级标记 `//`
3. 访问凭据（可选）
4. 服务器（域名或 IP）
5. 端口号（可选，省略时使用协议默认端口）
6. 路径（使用 `/` 分隔）
7. 查询参数（以 `?` 开始，参数之间用 `&` 分隔，键值用 `=` 分隔）
8. 片段（以 `#` 开始）

标准 URL 格式：

```text
[protocol]://[server]:[port]/[path][filename]?[query]#[fragment]
```

完整 URL 格式：

```text
[protocol]://[credentials]@[server]:[port]/[path][filename]?[query]#[fragment]
```

其中 `[credentials]`、`[port]`、`[query]` 和 `[fragment]` 都是可选项。

## 示例

以 `https://en.wikipedia.org:443/w/index.php?title=Special:Random` 为例：

1. **https**：协议
2. **en.wikipedia.org**：服务器
3. **443**：端口号
4. **/w/index.php**：路径
5. **?title=Special:Random**：查询参数

大多数浏览器会自动补全常见协议和默认端口。HTTPS 的默认端口是 `443`，HTTP 的默认端口是 `80`。

## 其他用途

URL 格式不仅用于网页地址，也常用于数据库连接、API 端点、资源定位等场景。例如 JDBC 连接字符串：

```text
jdbc:datadirect:oracle://myserver:1521;sid=testdb
```

在查询参数中传输中文或特殊字符时，建议使用 UTF-8 URL 编码，避免服务端解析歧义。
