# Dedicated Locale Tab

[![CI](https://github.com/huangzh317272-blip/dedicated-locale-tab/actions/workflows/ci.yml/badge.svg)](https://github.com/huangzh317272-blip/dedicated-locale-tab/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

English | [简体中文](README.md)

Dedicated Locale Tab is a Manifest V3 extension for Chrome and Microsoft Edge. It creates dedicated windows for web internationalization development, language-compatibility testing, and privacy research. It changes only the controlled tabs' browser languages, default `Intl` locale, IANA timezone, and HTTP `Accept-Language`.

**It must not be used to bypass geographic restrictions, account bans, or security measures.**

## v1.0.0 highlights

- Up to five explicit `navigator.languages` preferences with the actual Chromium `Accept-Language` serialization.
- Runtime ICU/IANA timezone discovery plus searchable country/city convenience presets.
- Attach, configure, mark, and only then navigate to the target URL.
- Recursive configuration of cross-process iframes and dedicated/shared workers.
- Fail-closed handling for debugger detach, prerender replacement, tab moves, and restored sessions.
- Inspection of the real main-document request header, current offset, a full-year DST matrix, and Temporal when available.
- An Intl matrix covering dates, numbers, percent, collation, plurals, relative time, lists, display names, and segmentation.
- Portable profile import/export, environment batch launch, and redacted JSON/Markdown comparison reports.
- Unit checks on Windows, macOS, and Linux; real browser E2E on Chrome/Edge Stable and Beta.

## Scope

The extension does not modify IP routing, VPNs, DNS, WebRTC, cookies, account region, the browser profile, OS settings, fonts, screen properties, Canvas/WebGL, or other hardware characteristics. An IP test and a JavaScript timezone test measure different sources and may legitimately show different regions.

## Install

1. Download the ZIP and matching SHA-256 file from [Releases](https://github.com/huangzh317272-blip/dedicated-locale-tab/releases), or clone the repository.
2. Extract it.
3. Open `chrome://extensions` or `edge://extensions`.
4. Enable **Developer mode**, select **Load unpacked**, and choose the directory containing `manifest.json`.

The debugger permission warning is expected: native per-target locale and timezone overrides require Chromium CDP access.

## Safe workflow

Enter a URL, choose explicit language preferences and a timezone, then open a controlled window. Use **New isolated tab** on the running-session card for more pages in the same environment. Use a separate window for a different environment. Run **Strict inspection** to validate the actual request and JavaScript values.

Dragging an already-loaded ordinary tab into a controlled window closes that tab. Opening DevTools on a controlled page, reloading the extension, or restoring a stale session can detach the debugger and therefore closes the controlled window by design.

## Moving from Windows to Mac

Export profiles as JSON on the old computer, load the same extension ZIP in Chrome or Edge 125+ on the Mac, and import the JSON. The file contains profile names, language preferences, and IANA timezones only. It does not contain URLs, cookies, login state, history, IP information, or VPN settings.

## Permissions

| Permission | Purpose |
| --- | --- |
| `debugger` | Apply and verify CDP locale/language/timezone settings on controlled targets |
| `tabs` | Safely create, enumerate, focus, and close controlled tabs and windows |
| `tabGroups` | Mark controlled windows and recover stale groups after restart |
| `storage` | Store preferences, portable profiles, and temporary session health |

There are no host permissions, telemetry, ads, trackers, or remotely hosted executable code. See [PRIVACY.md](PRIVACY.md).

## Development

Node.js 22 or 24:

```powershell
npm ci
npm test
npm run check
npm run package
```

For the real-browser test, set `PUPPETEER_EXECUTABLE_PATH` to Chrome for Testing or Edge and run `npm run test:e2e`. The test uses a local HTTP fixture only.

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and [Web Store materials](docs/CHROME_WEB_STORE.md).

## License

[MIT](LICENSE)
