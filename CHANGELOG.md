# Changelog

## [1.0.0] - 2026-09-27

### Security and lifecycle

- Added an explicit attachment/application/healthy/closing state machine.
- Made all required parent and child target coverage fail-closed.
- Added recursive iframe/worker target protection, debugger health checks, stale tab-group recovery, and tab move/replacement/discard handling.
- Added clear Chrome 155 enterprise-policy and debugger-conflict diagnostics.
- Session records are removed only after the controlled window is confirmed closed.

### Verification

- Added main-document request header capture through CDP Network events.
- Added four-state diagnostics, a 13-point annual DST matrix, optional Temporal validation, and an Intl sample matrix.
- Added a real Chrome for Testing E2E fixture covering the top page, cross-origin iframe, dedicated worker, and server-observed request header.
- Added Chrome/Edge Stable and Beta E2E jobs plus Node 22/24 checks on Windows, macOS, and Linux.

### Workbench and portability

- Added explicit multi-language preferences, profile save/import/export, batch environment launch, and redacted JSON/Markdown reports.
- Persisted target URLs are reduced to origins; portable profiles never contain URLs or login state.
- Added deterministic SVG-derived extension icons and reproducible ZIP/SHA-256 packaging.
- Added updated privacy, permissions, migration, Web Store, and release documentation.

## [0.3.0] - 2026-08-26

- Added window-level multi-tab isolation, a safe new-tab action, cross-platform unit CI, and stricter JavaScript environment inspection.

## [0.2.1] - 2026-08-26

- Added a visible region dropdown synchronized with searchable presets.

## [0.2.0] - 2026-08-26

- Added country/city presets, common BCP 47 language options, and runtime ICU/IANA timezones.

## [0.1.0] - 2026-08-26

- Added per-window language, locale, timezone, request-language overrides, and controlled-window management.
