# Contributing

Contributions are welcome for localization accuracy, browser compatibility, accessibility, documentation, and tests. Do not add fingerprint spoofing, remote code, analytics, credentials, private URLs, or functionality intended to bypass geographic or security controls.

## Setup

- Node.js 22 or 24;
- Chrome for Testing or Microsoft Edge 125+ for E2E;
- `npm ci` after checkout.

Run before submitting:

```powershell
npm test
npm run check
npm run package
$env:PUPPETEER_EXECUTABLE_PATH = "C:\path\to\browser.exe"
npm run test:e2e
```

The E2E test must verify top-level pages, cross-origin iframe reporting, worker reporting, and the server-observed `Accept-Language`. Do not replace it with JavaScript-only mocks.

## Design rules

- Preserve the `ATTACHING → APPLYING → HEALTHY` lifecycle.
- Required coverage failures must remain fail-closed.
- Delete session records only after the affected window is confirmed closed.
- `navigator.languages` contains explicit user preferences only. Expected request headers must be based on observed Chromium serialization.
- Preserve the real User-Agent and UA Client Hints; do not imitate another OS or device.
- Treat IP, VPN, DNS, WebRTC, cookies, fonts, screen, and hardware as out of scope.
- Any persisted/exported data change requires a privacy review and test.
- Update CHANGELOG and user documentation for visible changes.

By contributing, you agree that your contribution is licensed under the MIT License.
