# Privacy Policy

Last updated: 2026-08-26

Dedicated Locale Tab is designed to operate locally in the user's browser.

## Data handled by the extension

The extension stores the following configuration in `chrome.storage.local` so the control page can restore the last selection:

- the target website URL;
- the selected browser language;
- the selected IANA timezone.

While a controlled window is open, its tab identifier, window identifier, environment configuration, and current User-Agent metadata are stored temporarily in `chrome.storage.session`. Session data is cleared by the browser and is not intended as persistent account data.

## Data not collected

The extension does not include analytics, telemetry, advertising, tracking pixels, or an extension-operated server. It does not collect or transmit browsing history, page contents, credentials, cookies, or form data to the project maintainers.

The websites opened by the user remain independent third parties and may collect data under their own privacy policies. VPN providers, browser vendors, DNS providers, and network operators may also process connection data independently of this extension.

## Permissions

- `debugger`: applies Chrome DevTools Protocol environment overrides to the specific controlled tab.
- `tabs`: creates, focuses, lists, and closes controlled tabs and windows.
- `storage`: saves the last environment selection and temporary controlled-session state.

The extension contains no remotely hosted executable code. All JavaScript shipped with the extension is included in this repository.

## Deleting local data

Removing the extension through the browser's extension manager deletes its extension storage. Users can also clear extension storage through browser developer tools before removal.

## Changes

Material changes to this policy will be documented in the repository changelog.
