# Privacy Policy

Last updated: 2026-09-27

Dedicated Locale Tab operates locally in the user's Chromium browser. It has no project-operated server, analytics, telemetry, advertising, tracking pixels, or remote executable code.

## Data processed locally

- `chrome.storage.local` remembers only the target website origin (scheme, host, and port), the last language preferences, and the last IANA timezone. Paths, query strings, fragments, usernames, and passwords are not persisted.
- Saved test profiles contain a user-provided profile name, language preferences, and timezone. The extension first attempts `chrome.storage.sync` for convenience and falls back to local storage. Browser sync is operated by the browser vendor under the user's browser-account settings.
- `chrome.storage.session` temporarily holds controlled tab/window identifiers, the active configuration, real User-Agent metadata needed to preserve the browser identity, the most recently observed request language headers, health state, and the last fail-closed reason.
- Strict inspection reads locale, timezone, language, User-Agent metadata, and fixed Intl formatting samples from the controlled page. It does not read the page's business content, form values, cookies, credentials, or local storage.

## User-triggered files

- Exported profile JSON excludes URLs, cookies, login state, browsing history, IP data, and VPN configuration.
- Exported diagnostics reduce page URLs to their origin. They include expected/actual localization values, browser/version metadata, and session health. Reports are created only after the user clicks an export button and are saved by the browser to the user's device.

## Data not collected or transmitted to the maintainer

The extension does not transmit data to the project maintainer or any third party. It does not collect or sell browsing history, page content, credentials, authentication cookies, personal communications, location coordinates, IP addresses, DNS results, or device fingerprints.

Websites the user opens, browser vendors, VPN providers, DNS providers, and network operators remain independent parties and may process data under their own policies.

## Permissions

- `debugger`: applies and verifies CDP environment settings on user-created controlled targets and observes their localization request headers locally.
- `tabs`: creates, enumerates, focuses, and closes controlled tabs and windows.
- `tabGroups`: marks controlled groups so stale restored sessions can be recognized and closed.
- `storage`: stores the local/synced configuration and temporary session state described above.

The extension does not request host permissions.

## Retention and deletion

Session state is temporary and is removed as controlled windows close or the browser discards extension session storage. Saved settings and profiles remain until the user changes them, deletes profiles, clears extension storage, or removes the extension. Removing the extension through the browser's extension manager deletes its extension storage according to browser behavior.

The use of information received from browser APIs is limited to the extension's disclosed single purpose and follows the Chrome Web Store User Data Policy, including Limited Use requirements.

Material policy changes will be documented in [CHANGELOG.md](CHANGELOG.md).
