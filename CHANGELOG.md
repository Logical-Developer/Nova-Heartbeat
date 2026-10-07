# Changelog

All notable changes to Nova Heartbeat will be documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/).
Versioning follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- External plugin structure: `plugins/<Name>/<Name>.user.js` (standalone userscripts that talk to the core via `window.TC`)
- `Nova Builder` moved to `plugins/Nova-Builder/Nova-Builder.user.js` as the first external plugin
- `docs/EXTERNAL-PLUGINS.md` — external plugin development guide
- `plugins/Nova-Builder/README.md`
- `npm run check` / `npm run check:plugins` syntax-check scripts
- CI syntax-check step for external plugins (`.github/workflows/build.yml`)

### Changed
- `Nova-Builder` userscript header: clean `@name`/`@namespace`, numeric `@version`, added `@updateURL`/`@downloadURL`

## [0.0.1] - 2026-10-07

### Added
- Initial modular release
- Automatic village rotation
- Construct-to-upgrade conversion
- Freeze pages system
- Plugin system
- Plugin development guide (`docs/PLUGINS.md`)
- Plugin template (`src/plugins/_template.js`)
- Debug panel

### Changed
- Migrated from single-file (Nova-HB-2.0.2.21) to modular structure
- Renamed project to "Nova Heartbeat"
- Started fresh versioning from 0.0.1
