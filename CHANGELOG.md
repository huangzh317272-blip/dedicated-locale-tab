# Changelog

All notable changes to this project are documented here.

## [0.3.0] - 2026-08-26

### Added

- Window-level isolation: one controlled window can contain multiple tabs that inherit the same language and timezone configuration.
- A safe “new isolated tab” action on each running-window card.
- Cross-platform CI jobs for Windows, macOS, and Linux.

### Changed

- `navigator.languages` now contains only BCP 47 language tags, while the HTTP `Accept-Language` header retains quality weights.
- Environment inspection now validates the complete language list, Intl locale, IANA timezone, and DST-aware timezone offset.

## [0.2.1] - 2026-08-26

### Added

- A complete visible region dropdown while retaining searchable presets.
- Bidirectional synchronization between search, dropdown, language, and timezone fields.
- Repository-ready tests for the searchable and dropdown controls.

## [0.2.0] - 2026-08-26

### Added

- 175 country and city presets.
- 164 common BCP 47 language options.
- A dynamic timezone list sourced from the browser's supported ICU/IANA values.

## [0.1.0] - 2026-08-26

### Added

- Per-window language, locale, timezone, and `Accept-Language` overrides.
- Controlled-window management and environment inspection.
- Child-target protection and fail-closed debugger-detach handling.
