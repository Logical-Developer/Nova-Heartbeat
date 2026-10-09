# Nova Heartbeat

Automated page rotation and construct-to-upgrade conversion userscript.

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/)
2. Install the core: **[Nova-Heartbeat.user.js](https://raw.githubusercontent.com/Logical-Developer/Nova-Heartbeat/main/Nova-Heartbeat.user.js)** — `Nova Heartbeat (V 0.0.4)`
3. Install the plugins you need (each one is optional and independent):
   - **[Nova-Builder.user.js](https://raw.githubusercontent.com/Logical-Developer/Nova-Heartbeat/main/plugins/Nova-Builder/Nova-Builder.user.js)** — `Nova Builder (V 2.0.3.16)`
   - **[FarmManager.user.js](https://raw.githubusercontent.com/Logical-Developer/Nova-Heartbeat/main/plugins/FarmManager/FarmManager.user.js)** — `Nova Farm Manager (V 2.1.2)`
   - **[AttackReportAnalyzer.user.js](https://raw.githubusercontent.com/Logical-Developer/Nova-Heartbeat/main/plugins/AttackReportAnalyzer/AttackReportAnalyzer.user.js)** — `Nova Attack Report Analyzer - Alliance (V 1.6.1)`
4. Done. Every script name ends with its version (`(V x.y.z)`) — remove the old
   entry if Tampermonkey keeps both.

## Features

- Automatic village rotation
- Construct-to-upgrade conversion
- Configurable freeze pages
- Plugin system for extensibility (exclusive queue lock via `TC.pluginLock`)
- Debug panel

## External Plugins

| Plugin | Install | Source | Description |
| ------ | ------- | ------ | ----------- |
| Nova Heartbeat | [Nova-Heartbeat.user.js](https://raw.githubusercontent.com/Logical-Developer/Nova-Heartbeat/main/Nova-Heartbeat.user.js) | `src/` | Core — rotation, freeze, plugin API, plugin lock |
| Nova Builder | [Nova-Builder.user.js](https://raw.githubusercontent.com/Logical-Developer/Nova-Heartbeat/main/plugins/Nova-Builder/Nova-Builder.user.js) | `plugins/Nova-Builder/` | Construct-to-upgrade automation |
| Attack Report Analyzer | [AttackReportAnalyzer.user.js](https://raw.githubusercontent.com/Logical-Developer/Nova-Heartbeat/main/plugins/AttackReportAnalyzer/AttackReportAnalyzer.user.js) | `plugins/AttackReportAnalyzer/` | Attack report scanner (`/alliance/reports` + `/report/offensive`) + farm-list export |
| Farm Manager | [FarmManager.user.js](https://raw.githubusercontent.com/Logical-Developer/Nova-Heartbeat/main/plugins/FarmManager/FarmManager.user.js) | `plugins/FarmManager/` | Automated farming (lists, cooldown, run report) |

### Current versions

| Script | Version | Requires |
| ------ | ------- | -------- |
| Nova Heartbeat | `0.0.4` | — |
| Nova Builder | `2.0.3.16` | Nova `>= 0.0.1` |
| Nova Farm Manager | `2.1.2` | Nova `>= 0.0.3` (`FM_REQUIRES_NOVA_MIN`) |
| Attack Report Analyzer | `1.6.1` | standalone (no `window.TC`) |


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

Current: **v0.0.4** (early development)

## License

MIT
