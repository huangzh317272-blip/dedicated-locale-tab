# 专用语言与时区页面

[![CI](https://github.com/huangzh317272-blip/dedicated-locale-tab/actions/workflows/ci.yml/badge.svg)](https://github.com/huangzh317272-blip/dedicated-locale-tab/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[English](README.en.md) | 简体中文

这是一个面向 Chrome 和 Microsoft Edge 的 Manifest V3 扩展。它为网页国际化开发、语言兼容性测试和隐私研究建立独立测试窗口，并仅修改该窗口中受控标签页的浏览器语言、默认 `Intl` Locale、IANA 时区和 HTTP `Accept-Language`。

**不得用于绕过网站地区限制、账号封禁或安全措施。**

## v1.0.0 能做什么

- 显式设置最多 5 项 `navigator.languages`，并按 Chromium 的真实序列化规则生成 `Accept-Language`；
- 从当前浏览器的 ICU/IANA 运行时加载完整时区列表，保留可搜索的国家/城市快捷预设；
- 在首个目标网站请求前附加 debugger、应用配置、建立安全标签组，然后导航；
- 对跨进程 iframe、dedicated/shared worker 等子目标递归应用配置；
- 对 debugger 断开、预渲染替换、标签拖入/移出、恢复后失联等情况执行 fail-closed；
- 从 CDP Network 事件读取主文档真实请求头，并检查当前偏移、全年 DST 矩阵和可用时的 Temporal 时区；
- 提供 `Intl.DateTimeFormat`、数字、百分比、排序、复数、相对时间、列表、地区名和分词样例；
- 保存多套测试配置，批量打开环境，导入/导出不含网址与登录数据的迁移 JSON；
- 导出去敏 JSON/Markdown 多环境报告；网址只保留 origin；
- 在 Windows、macOS、Linux 运行单元检查，并在 Chrome/Edge Stable 与 Beta 运行真实浏览器 E2E。

## 明确边界

本扩展不会改变或隐藏：

- IP、VPN 路由、DNS 或 WebRTC；
- Cookie、登录状态、账号注册地区；
- 浏览器配置文件、操作系统语言或系统时区；
- 屏幕、字体、Canvas、WebGL、硬件与其他设备特征。

因此，IP 定位显示“中国”而页面时区显示其他地区，不代表时区覆盖失败；它表示检测站同时展示了两个不同来源。VPN 是否需要“全局模式”取决于 VPN 软件的路由规则，本插件不读取也不控制 VPN。

## 安装

1. 从 [Releases](https://github.com/huangzh317272-blip/dedicated-locale-tab/releases) 下载 ZIP，并按同名 `.sha256` 文件校验；或克隆本仓库。
2. 解压 ZIP。
3. Chrome 打开 `chrome://extensions`；Edge 打开 `edge://extensions`。
4. 开启“开发者模式”，点击“加载已解压的扩展程序”。
5. 选择直接包含 `manifest.json` 的文件夹。

浏览器会显示 debugger 权限警告。该权限用于 Chromium 原生的每标签页 Locale/时区覆盖，无法改为可选权限。

## 使用与窗口设计

1. 输入测试网址。
2. 搜索或下拉选择预设，也可以手工填写首选语言、附加语言和时区。
3. 点击“打开隔离窗口”。
4. 同一窗口需要更多页面时，只使用运行卡片中的“新建隔离标签页”。它先建立 `about:blank` 标签、完成隔离，再允许导航。
5. 不同语言/时区组合使用不同窗口；可保存配置后勾选多项批量打开。
6. 点击“严格检查”，核对真实请求头、语言、Locale、时区、DST 和 Temporal。
7. 测试结束后关闭整个窗口。

普通已加载标签拖入隔离窗口会被关闭；打开受控页面 DevTools、重新加载扩展或恢复旧会话导致 debugger 失效时，窗口也会关闭。这是预期的安全行为。

## Windows 与 Mac 迁移

扩展源码和内置预设可直接在 Windows 与 macOS 的 Chrome/Edge 125+ 使用。迁移个人测试配置：

1. 旧电脑控制页点击“导出配置 JSON”；
2. 把 JSON 与扩展 ZIP 复制到新电脑；
3. 在 Mac 浏览器加载解压后的扩展；
4. 点击“导入配置 JSON”。

迁移文件只包含配置名称、语言优先级和 IANA 时区，不包含网址、Cookie、登录状态、历史记录或 VPN 设置。浏览器同步存储可作为便利功能，但由于未打包扩展在不同电脑上可能获得不同 ID，跨电脑迁移应以导出/导入为准。

## 自检四态

| 状态 | 含义 |
| --- | --- |
| 通过 | 插件承诺覆盖且实际值一致 |
| 警告 | 浏览器隐私缩减等可解释差异 |
| 失败 | 承诺字段不一致 |
| 无法验证 | 浏览器未提供该 API，或该项目超出插件范围 |

配置预览使用真实 Chromium 行为。例如显式语言 `[fr-FR, en-US]` 的请求头是 `fr-FR,en-US;q=0.9`；不会展示浏览器实际未发送的理论回退项。

## 权限

| 权限 | 必要用途 |
| --- | --- |
| `debugger` | 应用并验证每个受控 tab/iframe/worker 的 CDP Locale、语言和时区配置 |
| `tabs` | 安全创建、枚举、聚焦和关闭受控标签页与窗口 |
| `tabGroups` | 标记隔离窗口并在启动/恢复后识别失去保护的遗留标签组 |
| `storage` | 保存上次选择、用户测试配置和当前会话健康状态 |

扩展不申请 `host_permissions`，不包含遥测、广告、跟踪器或远程可执行代码。详情见 [隐私政策](PRIVACY.md)。

## 开发与验证

要求 Node.js 22 或 24：

```powershell
npm ci
npm test
npm run check
npm run package
```

真实浏览器测试需要 Chrome for Testing 或 Edge 路径：

```powershell
$env:PUPPETEER_EXECUTABLE_PATH = "C:\path\to\chrome.exe"
npm run test:e2e
```

E2E 使用本地 HTTP fixture，不向第三方发送测试数据。发布包由确定性打包脚本生成，并同时输出 SHA-256。更多信息见 [贡献指南](CONTRIBUTING.md)、[安全政策](SECURITY.md)和 [Web Store 发布材料](docs/CHROME_WEB_STORE.md)。

## 许可证

[MIT](LICENSE)
