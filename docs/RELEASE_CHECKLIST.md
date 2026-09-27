# v1.0.0 release checklist

## Automated gates

- [ ] `npm ci`
- [ ] `npm test` passes twice from a clean install
- [ ] `npm run check` passes
- [ ] `npm run test:e2e` passes on Chrome for Testing Stable
- [ ] `npm run test:e2e` passes on Chrome for Testing Beta
- [ ] GitHub Actions passes on Windows/macOS/Linux Node 22/24
- [ ] GitHub Actions passes on Chrome/Edge Stable/Beta
- [ ] `npm run package` produces the same SHA-256 on two consecutive runs

## Manual smoke checks

- [ ] Chrome Stable: install warning, open, inspect, new tab, close
- [ ] Edge Stable: install warning, open, inspect, new tab, close
- [ ] macOS Chrome or Edge: import Windows profile JSON and open environment
- [ ] Open DevTools on a controlled tab and confirm fail-closed behavior
- [ ] Try moving an ordinary loaded tab into the controlled window and confirm it is closed
- [ ] Restart/reload the extension and confirm stale marked groups are not trusted

## Release and store

- [ ] Confirm `manifest.json`, package version, changelog, and Git tag are `1.0.0`
- [ ] Confirm ZIP excludes tests, npm dependencies, local browser caches, and private data
- [ ] Sign/tag the Git commit and upload ZIP plus SHA-256 to GitHub Release
- [ ] Review `PRIVACY.md` and `docs/CHROME_WEB_STORE.md`
- [ ] Publisher completes Chrome Web Store account-only steps
