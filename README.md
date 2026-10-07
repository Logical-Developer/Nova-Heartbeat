# Nova Heartbeat

Automated page rotation and construct-to-upgrade conversion userscript.

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/)
2. Install the core: **[Nova-Heartbeat.user.js](https://raw.githubusercontent.com/Logical-Developer/Nova-Heartbeat/main/Nova-Heartbeat.user.js)**
3. Install the Builder plugin (optional): **[Nova-Builder.user.js](https://raw.githubusercontent.com/Logical-Developer/Nova-Heartbeat/main/plugins/Nova-Builder/Nova-Builder.user.js)**
4. Done.

## Features

- Automatic village rotation
- Construct-to-upgrade conversion
- Configurable freeze pages
- Plugin system for extensibility
- Debug panel

## Development

### Prerequisites
- Node.js 18+
- VS Code (recommended)

### Setup
```bash
git clone https://github.com/Logical-Developer/Nova-Heartbeat.git
cd Nova-Heartbeat
npm run build
```

### Development workflow
```bash
npm run watch     # auto-rebuild on save
```

Edit files in `src/`. **Never edit `Nova-Heartbeat.user.js` directly** — it's auto-generated.

### Project structure
- `src/` — modular core source files (assembled into the core userscript)
- `build.js` — concatenates src/ → Nova-Heartbeat.user.js
- `watch.js` — file watcher for auto-build
- `plugins/` — external plugins, each a standalone userscript (e.g. `plugins/Nova-Builder/`)
- `docs/` — `PLUGINS.md` (internal plugins) and `EXTERNAL-PLUGINS.md` (external plugins)

## Version

Current: **v0.0.1** (early development)

## License

MIT
