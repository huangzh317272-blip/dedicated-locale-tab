# Contributing

Contributions are welcome for bug fixes, browser compatibility, accessibility, documentation, tests, and environment-data corrections.

## Development setup

Requirements:

- Chrome or Microsoft Edge 125 or newer;
- Node.js 24 or newer for local checks;
- no runtime npm dependencies.

Run the checks before opening a pull request:

```powershell
node --test
node --check background.js
node --check control.js
node --check lib\config.js
node --check lib\environment-data.js
```

Then load the repository folder as an unpacked extension and verify:

1. search and dropdown presets remain synchronized;
2. the selected language and timezone appear in the preview;
3. a controlled window opens only after overrides are applied;
4. the environment inspector reports the selected values;
5. ordinary browser tabs remain unaffected;
6. an unexpected debugger detach closes the controlled window.

## Pull requests

- Keep changes focused and explain their user-visible effect.
- Add or update tests for behavior and data changes.
- Do not add remote executable code, telemetry, trackers, credentials, or private test URLs.
- Preserve fail-closed behavior unless a security review justifies a change.
- Update `CHANGELOG.md` for user-visible changes.

By contributing, you agree that your contribution is licensed under the MIT License.
