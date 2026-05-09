# PingGateway Toolkit

Pre-upgrade compatibility scanner for **ForgeRock / Ping Identity Gateway** (formerly OpenIG, now PingGateway). Runs as a native VSCode extension with an Activity Bar tool launcher and inline diagnostics.

## What it does

The current release ships the **PingGateway Upgrade Analyzer** — scans an IG configuration directory and reports:

- **Groovy breaking changes** — removed classes (XmlSlurper, AntBuilder, GroovyTestCase, etc.), wildcard imports, behavior shifts (intersect, getProperties, 0.0f equality).
- **PingGateway API deprecations** — blocking `Promise.get()` calls, deprecated `request.form`, `JwtSession`, `TokenResolver`, `_token()`, `LdapClient`, `org.forgerock.util.time.Duration`, and more.
- **Route JSON config issues** — duplicate keys, missing required config fields (`UserProfileFilter` / `AmService` / etc.), duplicate route names, deprecated `matches()` in conditions and `${...}` expressions.
- **Cross-file integrity** — orphan scripts (no route references them) and dangling references (route points to a nonexistent script).
- **Security & path concerns** — hardcoded credentials, `secret.id` literal values, Tomcat-era paths, absolute filesystem paths that may not survive migration.

Output channels:

- **HTML report** — embedded in a webview panel; export to a standalone file for audit / email distribution.
- **VSCode Problems panel** + **inline red/yellow/blue squiggles** — click any issue to jump to the offending line.
- **Activity Bar tool launcher** — the PingGateway Toolkit icon hosts the PingGateway Upgrade Analyzer (and future tools).

## Usage

1. Click the **PingGateway Toolkit** icon in the Activity Bar.
2. Click **PingGateway Upgrade Analyzer** — the tool panel opens in the editor area.
3. Click **Browse…** to pick your IG configuration directory (e.g. an `openig/` directory containing `config/` and `scripts/`).
4. Click **Run scan**.

Results appear in three places simultaneously:
- The HTML report inside the tool panel
- The Problems panel (auto-opens if any issues found — toggle in Settings)
- Red/yellow/blue squiggles in any open `.groovy` or route `.json` file

Alternative entry points:
- `Cmd+Shift+P` → **PingGateway Toolkit: Run PingGateway Upgrade Scan**
- Right-click any folder in the Explorer → **Run PingGateway Upgrade Scan** (auto-runs on the chosen folder)

## Settings

Configure via `Cmd+,` → search "PingGateway Toolkit", or via the **Settings** panel inside the tool itself:

| Setting | Effect |
|---|---|
| `iamToolkit.igUpgrade.disabledRules` | List of rule IDs to skip during scan (e.g. `["G4-201", "PATH-102"]`). |
| `iamToolkit.igUpgrade.ignorePaths` | Absolute path prefixes to ignore for PATH-102 (e.g. `["/opt/logs", "/var/log"]`). |
| `iamToolkit.igUpgrade.autoOpenProblems` | Auto-open the Problems panel after a scan if any issues are found. Default `true`. |

All settings persist via VSCode workspace settings; they sync via Settings Sync and travel with `.vscode/settings.json`.

## Rule reference

See the full rule specification at [docs/ig-upgrade-rules.md](docs/ig-upgrade-rules.md). All rules are documented with severity, intent, and remediation guidance.

## Roadmap

- PingGateway Upgrade Analyzer (current).
- Quick fixes (one-click migration of removed imports, deprecated APIs).
- Future: additional Identity Gateway operations tools — log analyzer, route visualizer, runtime helpers.

## Building from source

```bash
git clone https://github.com/bostonidentity/pinggateway-toolkit-vscode.git
cd pinggateway-toolkit-vscode
npm install
npm run compile     # one-shot
npm run watch       # incremental during dev
npm run package     # produce pinggateway-toolkit-<version>.vsix
```

Press **F5** in VSCode to launch an Extension Development Host with the extension loaded.

## License

MIT — see [LICENSE](LICENSE).
