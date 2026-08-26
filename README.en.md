# Dedicated Locale Tab

[![CI](https://github.com/huangzh317272-blip/dedicated-locale-tab/actions/workflows/ci.yml/badge.svg)](https://github.com/huangzh317272-blip/dedicated-locale-tab/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

English | [简体中文](README.md)

Dedicated Locale Tab is an open-source Chrome and Microsoft Edge Manifest V3 extension for localization testing, timezone-sensitive QA, and isolated regional browser-environment validation.

It opens a website in a dedicated window and overrides only that controlled target:

- `navigator.language` and `navigator.languages`;
- the default JavaScript `Intl` locale;
- the IANA timezone used by `Intl`, `Date`, and timezone offsets;
- the HTTP `Accept-Language` value;
- User-Agent Client Hints while preserving the browser's existing identity.

Ordinary browser tabs are not modified.

## Features

- 175 searchable country and city presets with a synchronized full dropdown;
- 164 common BCP 47 language choices plus validated custom input;
- a complete timezone list loaded dynamically from the browser's ICU/IANA runtime;
- controlled-window status and in-page environment inspection;
- child-target protection for related frames and workers;
- fail-closed behavior that closes a controlled window after an unexpected debugger detach.

## How it works

The extension creates a blank popup window, attaches Chrome DevTools Protocol to that target, applies locale, language, and timezone overrides, and only then navigates to the requested website. The extension does not change the global browser profile or operating-system settings.

## Install from source

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select the repository directory containing `manifest.json`.

Chrome displays a debugger permission warning because CDP access is required for native per-target overrides.

## Usage

1. If relevant to the test, connect the VPN and verify its exit location first.
2. Open the extension control page and enter the target URL.
3. Search for a country/city preset or use the full dropdown.
4. Confirm the language and timezone. Prefer the exact IANA timezone returned by an IP-location test.
5. Select **Open dedicated page**.
6. Use the target site only inside the new controlled window.
7. Return to the control page and run **Inspect environment** when needed.
8. Close the controlled page when finished.

## Permissions

| Permission | Purpose |
| --- | --- |
| `debugger` | Apply CDP environment overrides to the user-created controlled target |
| `tabs` | Create, focus, list, and close controlled tabs and windows |
| `storage` | Remember the last environment selection and temporary session state |

The extension contains no telemetry, ads, trackers, or remotely hosted executable code. See [PRIVACY.md](PRIVACY.md).

## Limitations

- A browser restart, extension reload, or disabled extension invalidates the controlled session. Recreate it from the control page.
- A separately opened external popup should be independently inspected.
- The extension controls language and timezone only. Websites may also evaluate IP, DNS, WebRTC, account region, cookies, geolocation permission, fonts, and other signals.
- Country-language presets are defaults, not claims that every user in a country has the same language preference.

Use the project in compliance with applicable rules and the target website's terms.

## Development

Node.js 24 or newer is recommended. No runtime npm dependencies are required.

```powershell
node --test
node --check background.js
node --check control.js
node --check lib\config.js
node --check lib\environment-data.js
```

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE)
