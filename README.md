# 专用语言与时区页面

[![CI](https://github.com/huangzh317272-blip/dedicated-locale-tab/actions/workflows/ci.yml/badge.svg)](https://github.com/huangzh317272-blip/dedicated-locale-tab/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[English](README.en.md) | 简体中文

这是一个 Chrome / Microsoft Edge Manifest V3 扩展。它在独立窗口中打开指定网站，并只对该窗口内的受控标签页覆盖：

- `navigator.language` 与 `navigator.languages`；
- JavaScript `Intl` 的默认 Locale；
- `Intl.DateTimeFormat().resolvedOptions().timeZone`、`Date` 和时区偏移；
- HTTP `Accept-Language`；
- 与原浏览器一致的 User-Agent 和 User-Agent Client Hints。

其他普通标签页不会受到影响。

## 项目用途与使用边界

本插件是**浏览器本地化与时区隔离测试插件**，用于网页国际化开发、语言兼容性测试和隐私研究。**不得用于绕过网站地区限制、账号封禁或安全措施。** 使用者还应遵守目标网站的服务条款和适用规则。

控制页提供：

- 175 个 VPN 国家 / 城市环境预设，可搜索或通过完整下拉列表选择，选中后同时填入建议语言和时区；
- 164 个常见国家及地区浏览器语言标签；
- 从当前浏览器 ICU/IANA 数据动态读取的完整时区列表（不同 Chrome 版本数量可能略有差异）；
- 语言和时区自定义输入，未列出的有效 BCP 47 语言标签仍可直接填写。
- 一个隔离窗口内可以创建多个标签页，所有标签页继承同一套语言和时区配置；不同配置使用不同隔离窗口。
- 严格环境自检，同时核对主语言、完整语言列表、Intl Locale、时区 ID 和夏令时感知的时区偏移。

## 工作原理

扩展先创建带标签栏的标准独立窗口，通过 Chrome DevTools Protocol 对其中每个受控标签页设置时区、Locale、纯 BCP 47 语言列表和 `Accept-Language`，完成后才导航到用户输入的网站。通过控制页创建的新标签页会在导航前继承窗口配置；窗口中随后创建的标签页也会自动纳入受控状态。调试连接意外断开时，扩展会关闭对应窗口，避免页面随后读取本机真实设置。

## 安装

1. 在 Chrome 打开 `chrome://extensions`；Edge 打开 `edge://extensions`。
2. 开启“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 下载并解压本仓库，选择包含 `manifest.json` 的 `dedicated-locale-tab` 文件夹。
5. 浏览器会提示该扩展需要调试器权限。这是按标签页设置 CDP 环境所必需的。

建议把扩展固定到工具栏。点击扩展图标会打开完整控制页。

## 使用

1. 先连接 VPN，并确认出口 IP 已经切换。
2. 在控制页输入目标网址。
3. 在搜索框输入国家或城市，或者直接使用旁边的完整下拉列表；选中后会自动填写语言和时区。
4. 如果 VPN 检测网站给出的时区不同，以检测结果为准，从完整时区列表中重新选择。
5. 点击“打开隔离窗口”。
6. 只在新出现的独立窗口中使用目标网站。
7. 需要更多页面时，在控制页点击“新建隔离标签页”，然后在新标签页地址栏输入网址。一个窗口内的标签页使用同一配置；需要另一套配置时重新创建隔离窗口。
8. 可以回到控制页点击“检查环境”，核对页面实际读取的语言、语言列表、Locale、时区和偏移。
9. 使用结束后点击“关闭整个窗口”。

示例：

| 目标环境 | 浏览器语言 | 时区 |
| --- | --- | --- |
| 美国纽约 | `en-US` | `America/New_York` |
| 美国洛杉矶 | `en-US` | `America/Los_Angeles` |
| 英国伦敦 | `en-GB` | `Europe/London` |
| 日本东京 | `ja-JP` | `Asia/Tokyo` |

## 权限说明

| 权限 | 用途 |
| --- | --- |
| `debugger` | 只对用户创建的专用标签页应用 CDP 环境覆盖 |
| `tabs` | 创建、聚焦、列出和关闭受控标签页与窗口 |
| `storage` | 保存上一次环境选择和当前受控会话状态 |

扩展不包含遥测、广告、跟踪器或远程可执行代码。具体数据处理方式见 [PRIVACY.md](PRIVACY.md)。

## 独立验证

可以在专用窗口中打开以下检测页面：

- [BrowserLeaks JavaScript](https://browserleaks.com/javascript)：检查 `navigator.language`、`languages`、Locale 和时区；
- [BrowserLeaks IP](https://browserleaks.com/ip)：检查 VPN 出口位置和 `Accept-Language`；
- [BrowserLeaks WebRTC](https://browserleaks.com/webrtc)：检查是否存在其他公网 IP 泄漏。

## 重要边界

- 不要在普通标签页中直接打开目标网站。
- 请优先通过控制页的“新建隔离标签页”增加页面，不要把普通窗口中已加载的标签页拖入隔离窗口。
- 不要在受控标签页打开开发者工具；这可能断开扩展的调试连接并触发整个隔离窗口关闭。
- 浏览器重启、扩展停用或扩展重新加载后，必须从控制页重新创建专用页面。不要直接恢复之前的网站标签页。
- 当前扩展会自动接管同一隔离窗口内的新标签页、子 iframe 和相关子目标；网站主动打开的独立外部窗口仍不属于原窗口，应单独确认。
- 扩展采用 fail-closed 行为：调试连接意外断开时，会关闭对应专用窗口，防止网站继续读取本机真实语言和时区。
- 网站还可能检查 IP、DNS、WebRTC、Cookie、账号注册地区、地理位置权限、系统字体或其他设备特征。本扩展只负责语言和时区的一致性。
- 使用时应遵守目标网站的服务条款及适用规则。

## Windows 与 macOS 兼容性

| 平台 | Chrome 125+ | Microsoft Edge 125+ | 状态 |
| --- | --- | --- | --- |
| Windows 10/11 | 支持 | 支持 | 已在 Windows 实际使用 |
| macOS 13 Ventura+ | 支持 | 支持 | 使用相同 Chromium 扩展 API；需在目标浏览器版本做人工冒烟测试 |

项目不包含 Windows 专属路径、注册表、原生程序或系统调用。CI 会在 Windows、macOS 和 Linux 上执行语法、配置及纯逻辑测试；由于 CI 不启动真实桌面浏览器，发布前仍应分别在 Chrome 和 Edge 中人工加载扩展，验证权限提示、新建标签页与环境检查。

## 开发与本地检查

需要 Node.js。若 PowerShell 禁止运行 `npm.ps1`，可以直接执行下面两组命令：

```powershell
node --test
node --check background.js
node --check control.js
node --check lib\config.js
node --check lib\environment-data.js
node --check lib\inspection.js
```

贡献流程见 [CONTRIBUTING.md](CONTRIBUTING.md)，安全问题请按照 [SECURITY.md](SECURITY.md) 私下报告。

## 许可证

本项目采用 [MIT License](LICENSE)。
