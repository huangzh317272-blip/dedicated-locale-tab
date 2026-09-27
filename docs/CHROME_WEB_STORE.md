# Chrome Web Store submission materials

Prepared for v1.0.0 on 2026-09-27. The repository and ZIP are ready for submission, but the final dashboard upload requires the publisher's Chrome Web Store developer account, registration fee, identity verification, declarations, and manual approval.

## Listing identity

- Name: `Dedicated Locale Tab — 语言与时区测试`
- Category: Developer Tools
- Language: Chinese (Simplified), with English copy below
- Homepage: `https://github.com/huangzh317272-blip/dedicated-locale-tab`
- Support: `https://github.com/huangzh317272-blip/dedicated-locale-tab/issues`
- Privacy policy: `https://github.com/huangzh317272-blip/dedicated-locale-tab/blob/main/PRIVACY.md`

## Short description

Chinese:

> 在独立窗口中测试浏览器语言、Intl Locale、IANA 时区和真实 Accept-Language；支持配置迁移与去敏报告。

English:

> Test browser languages, Intl locale, IANA timezone, and actual Accept-Language in dedicated windows.

## Detailed description

> Dedicated Locale Tab 是网页国际化开发和语言兼容性测试工具。它在用户主动创建的独立窗口中，按标签页设置显式浏览器语言、默认 Intl Locale、IANA 时区和 HTTP Accept-Language，并检查顶层页面、跨域 iframe 与 worker 的一致性。
>
> 控制页提供可搜索预设、完整运行时时区列表、多语言优先级、配置导入导出、批量环境和去敏诊断报告。严格检查读取实际主文档请求头、全年 DST 偏移矩阵和可用时的 Temporal 时区。
>
> 本扩展不改变 IP、VPN、DNS、WebRTC、Cookie、账号地区、系统设置或其他设备特征。不得用于绕过网站地区限制、账号封禁或安全措施。
>
> 无遥测、广告、跟踪器、远程代码或 host permissions。源码和可复现打包脚本公开可审计。

## Single purpose

Browser localization and timezone-isolation testing for web internationalization development, language compatibility testing, and privacy research.

## Permission justifications

### debugger

Required to use Chromium DevTools Protocol for per-target timezone, default Intl locale, explicit language preferences, and request-language configuration. It also reads the controlled page's localization request headers locally for verification. It is attached only to windows created by the user through the extension.

### tabs

Required to create a blank tab, apply all required settings before navigation, enumerate controlled windows, focus them, and close any tab/window whose protection is lost.

### tabGroups

Required to visibly mark controlled tabs and recognize stale restored groups after browser restart or extension reload. Stale groups are closed because their debugger protection cannot be trusted.

### storage

Required for the last origin/language/timezone selection, named localization profiles, temporary controlled-session state, and the last fail-closed diagnostic. See `PRIVACY.md` for exact fields and retention.

### No host permissions

The extension requests no host patterns. It does not inject content scripts across websites.

## Data-use declarations

- Web browsing activity: processed locally only to retain the selected origin and manage the user-created controlled tab. Full paths/query strings are not persisted in settings or exported reports.
- Website content: not collected. The debugger permission is used for environment commands and localization metadata, not page content.
- Authentication, personal communications, financial/health data, location, and user-generated content: not collected.
- Data sale, advertising, credit decisions, unrelated use, or human review: none.
- Transfer to third parties or maintainer servers: none.
- Remote code: none.

Use the affirmative Limited Use statement already included in `PRIVACY.md`.

## Assets

- Store icon: `assets/icon-128.png`
- Screenshot: `store-assets/screenshot-control-1280x800.png`
- Small promotional tile: `store-assets/promo-small-440x280.png`

The screenshot is produced from the actual extension UI with `npm run store:screenshot`. Do not add account dashboards, IP addresses, private URLs, or claims about evading detection to screenshots.

## Reviewer test instructions

1. Load/install the extension and click its toolbar action.
2. Enter a local or public test URL.
3. Select `fr-FR`, optional `en-US`, and `America/New_York`.
4. Open the isolated window and return to the control page.
5. Run **严格检查 / Strict inspection**.
6. Confirm language, `Intl` locale, timezone, DST matrix, and main-document request header.
7. Use **新建隔离标签页 / New isolated tab** to verify same-window inheritance.
8. Export a profile and report; confirm the profile has no URL and the report URL is reduced to an origin.

## Final dashboard checklist

- Upload `dist/dedicated-locale-tab-v1.0.0.zip`.
- Verify SHA-256 against the release `.sha256` file.
- Add the privacy-policy URL.
- Complete the data-use questionnaire exactly as described above.
- Upload the icon, screenshot, and optional promotional tile.
- Verify developer identity/contact email.
- Submit first as unlisted if a limited reviewer test is preferred; publication remains a publisher decision.
