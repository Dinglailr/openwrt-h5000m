[🇨🇳 中文文档 / Chinese](README.zh-CN.md) · [Development](DEVELOPMENT.md)

# AdGuardHome LuCI Dashboard

**Standard AdGuard Home management panel for LuCI 2.0** | **LuCI 2.0 AdGuard Home Dashboard**
**v2.5.6**

A complete AdGuard Home management panel for OpenWrt / ImmortalWrt / iStoreOS.

---

## Install

### One-click install (recommended)

```sh
sh -c "$(curl -fsSL https://raw.githubusercontent.com/imonior/luci-app-adguardhome-dashboard/main/scripts/install.sh)"
```

The install script runs in two steps:

1. **AdGuard Home core** — detects whether `/opt/AdGuardHome/AdGuardHome` is installed; if not, it calls the official script to auto-install. If already installed, you can choose to overwrite (auto-stops the running service) or skip.
2. **LuCI Dashboard** — downloads menu registration, Lua Controller, JS View, translations and `checksums.sha256` from GitHub into a temp dir, performs **sha256 content-fingerprint verification** (aborts immediately and prompts to switch proxy if a stale cached version is hit), then deploys to the corresponding system locations.

> Before overwriting, install.sh automatically backs up the existing panel files (including `manifest.json`) to `/root/agh_backup_install_<ts>/` and generates `restore.sh` inside the backup dir. If the install fails or you want to roll back to the old panel, run `sh /root/agh_backup_install_<ts>/restore.sh` (restores panel files only, does not touch the AGH core binary).

### Domestic acceleration / Proxy

On startup the script auto-detects GitHub connectivity; if a direct connection fails it tests each proxy node in turn and shows latency, so you can pick a working one:

```
  #   proxy node         status
  ─────────────────────────────
  1)  direct             ✗ unavailable
  2)  ghfast.top         ✓ 320ms
  3)  gh-proxy.com       ✓ 450ms
  4)  kkgithub.com       ✗ timeout
```

You can also set the proxy via an environment variable (skips detection):

```sh
GITHUB_PROXY=https://ghfast.top/ sh -c "$(curl -fsSL https://ghfast.top/https://raw.githubusercontent.com/imonior/luci-app-adguardhome-dashboard/main/scripts/install.sh)"
```

> Note: the `curl` URL that downloads the script itself must also go through the proxy — as shown above, the `curl` URL already has the `ghfast.top/` prefix.

### Install from a local clone

If you have cloned the project onto the router, running it from the project directory uses local files automatically (no network download needed):

```sh
cd /path/to/luci-app-adguardhome-dashboard
sh scripts/install.sh
```

> `install.sh` is idempotent for both install and update, and auto-cleans old version files.

## Uninstall

```sh
sh -c "$(curl -fsSL https://raw.githubusercontent.com/imonior/luci-app-adguardhome-dashboard/main/scripts/uninstall.sh)"
```

---

## Features

- **LuCI 2.0 standard architecture**: menu.json registration + JS View lifecycle management (not template rendering)
- **Backend RPC**: Lua Controller exposes 13 API endpoints, no ACL privilege escalation
- **Real-time status monitoring**: 5-second polling, live version/running state/PID/ports/proxy/panel version
- **Service console**: start/stop/restart/register system service, supports both init.d and binary modes
- **Layered log viewer**: stacked mode — top is the exec/upgrade log (EXEC_LOG), bottom appends AGH native log or system `logread` (latest 50/100 lines); supports manual refresh, 2-second auto-polling during upgrade, optional auto-refresh toggle (3s), and one-click clear of the middle-layer log
- **Core version management**: check update + one-click upgrade + force reinstall, with 2-second progress polling
- **Global proxy selection**: 4 built-in candidates (direct / ghfast.top / gh-proxy.com / kkgithub.com) + custom input, persisted immediately to `/etc/adguardhome-dashboard.proxy` on selection
- **Proxy latency test**: single-point / batch test of all candidates, target matches the actual download domain (`raw.githubusercontent.com`), persist-before-test
- **Panel self-upgrade**: check panel version (reads `manifest.json`) → one-click upgrade (downloads 7 panel files including `manifest.json` and overwrites locally), no manual upload needed
- **Two-phase commit + auto rollback**: both core and panel upgrades use "download to temp dir + integrity check → backup + atomic mv overwrite"; any step failure auto-restores deployed files from backup
- **Integrity verification (two layers)**: ① type check — lmo magic `LMO\0` / lua contains `function` / js contains `view.extend` / po contains `msgid`, preventing empty files / 404 HTML / truncation; ② **sha256 content fingerprint**: both install and panel upgrade first download `checksums.sha256` and compare each panel file's sha256; any content inconsistent with the release manifest (especially stale proxy/CDN caches) is blocked and the upgrade aborts, avoiding a broken panel
- **Backup management**: lists all `/root/agh_backup_*` backup dirs (install/core/dashboard), showing type/timestamp/file count/size/contains-core/contains-restore.sh; supports one-click restore (only install/dashboard backups have restore.sh), shows restore command, and delete to free space
- **install self-backup**: install.sh auto-backs-up existing panel files (including `manifest.json`) + generates restore.sh, identical to the panel-upgrade backup mechanism
- **i18n support**: auto switch between Chinese and English based on LuCI system language (124 translations)
- **Cross-platform**: OpenWrt / ImmortalWrt / iStoreOS

---

## Project Structure

```text
luci-app-adguardhome-dashboard/
├── scripts/
│   ├── install.sh        # install/update script (Part1: AGH core  Part2: Dashboard files + auto-backup + restore.sh)
│   └── uninstall.sh      # uninstall script
├── files/
│   ├── luci/
│   │   ├── menu.d/
│   │   │   └── luci-app-adguardhome-dashboard.json  # LuCI 2.0 menu registration
│   │   ├── acl.json      # rpcd access control
│   │   ├── controller/
│   │   │   └── adguardhome.lua  # backend Lua Controller (13 API endpoints)
│   │   └── i18n/
│   │       ├── adguardhome.po       # English translation source
│   │       ├── adguardhome.zh-cn.po # Chinese translation source
│   │       ├── adguardhome.lmo      # compiled English translation (LuCI binary format)
│   │       └── adguardhome.zh-cn.lmo# compiled Chinese translation
│   └── view/
│       └── dashboard.js  # LuCI 2.0 JS View (view.extend)
├── tools/
│   └── po2lmo.py         # .po → .lmo compiler (dev only, not deployed)
├── checksums.sha256      # release sha256 manifest (source of content fingerprint for install / panel upgrade)
├── manifest.json         # package manifest (panel self-upgrade version source)
├── README.md             # project docs (English, default)
└── README.zh-CN.md       # project docs (Chinese)
```

---

## API Endpoints

| Path | Method | Function |
|------|--------|----------|
| `/admin/services/adguardhome/status` | GET | get status (version/running/PID/ports/path/proxy/panel version) |
| `/admin/services/adguardhome/action` | POST | run action (start/stop/restart/install_service/install_core) |
| `/admin/services/adguardhome/set_proxy` | POST | persist proxy immediately to `/etc/adguardhome-dashboard.proxy` |
| `/admin/services/adguardhome/proxy_test` | POST | test proxy latency (target: `raw.githubusercontent.com`) |
| `/admin/services/adguardhome/check_update` | POST | check latest AGH core version on GitHub (uses persisted proxy) |
| `/admin/services/adguardhome/upgrade` | POST | start AGH core upgrade (force=0 uses `--update` / force=1 uses install script `-r`) |
| `/admin/services/adguardhome/check_dashboard_update` | GET | check latest panel version (reads GitHub `manifest.json`) |
| `/admin/services/adguardhome/upgrade_dashboard` | POST | start panel self-upgrade (download 7 files incl. `manifest.json` and overwrite locally) |
| `/admin/services/adguardhome/log` | GET | get layered log (top EXEC_LOG + bottom AGH-native/logread + header summary) |
| `/admin/services/adguardhome/clear_log` | POST | clear middle-layer exec/upgrade log (EXEC_LOG) |
| `/admin/services/adguardhome/backups` | GET | list all `/root/agh_backup_*` backup dirs |
| `/admin/services/adguardhome/restore_backup` | POST | restore from a specified backup (runs `<dir>/restore.sh`) |
| `/admin/services/adguardhome/delete_backup` | POST | delete a specified backup dir |

---

## Upgrade Flow

### AGH core upgrade (two-phase commit + auto rollback)

```
Phase 1: backup current binary → /root/agh_backup_core_<ts>/AdGuardHome
Phase 2: run upgrade
       ├─ force=1: multi-proxy download install.sh → stop service → sh install.sh -r
       ├─ force=0 + binary present: AdGuardHome --update
       └─ no binary: multi-proxy download install.sh → sh install.sh
Phase 3: integrity check (new binary exists + executable + can print version)
Phase 4: check failed → restore old binary from backup + restart service → write FAILED marker
Phase 5: restart service → write done marker
```

### Panel self-upgrade (two-phase commit + auto rollback)

```
Phase 1: download all 7 files to /tmp/agh_dash_new_<ts>/ + integrity check
       ├─ first download checksums.sha256 (content-fingerprint manifest, from GitHub main)
       ├─ compare each file's sha256 (pass only if consistent with release manifest; stale proxy cache is blocked)
       ├─ lmo: check trailing magic 4c4d6f00 (LMO\0)
       ├─ lua: check contains 'function' + 'list_backups'
       ├─ js:  check contains 'view.extend' + 'fetchBackups'
       └─ po:  check contains 'msgid'
       any failure → write FAILED marker + auto rollback → no target file touched
Phase 2: per-file backup + atomic mv overwrite
       any failure → restore deployed files from /root/agh_backup_dashboard_<ts>/ → write FAILED marker
Phase 2.5: generate restore.sh in backup dir (consistent with install.sh restore logic, restores 7 panel files incl. manifest.json)
Phase 3: clear LuCI cache + restart rpcd/uhttpd → write done marker
```

---

## Proxy Cache & Content Fingerprint

GitHub mirrors/CDNs (such as `ghfast.top`, `gh-proxy.com`) cache `raw.githubusercontent.com` content and often ignore the `?_cb=` timestamp parameter. If the cache holds an **older version missing some features**, install/upgrade silently installs a broken panel (this once caused the "Backup management" and "Clear log" buttons to disappear).

To fully guard against this, both install and panel upgrade use **two-layer verification**:

1. **sha256 content fingerprint (primary)**: first download `checksums.sha256` from GitHub main (records panel file sha256), then compare each downloaded file's sha256. Any content inconsistent with the release manifest (stale proxy cache, truncation, tampering) is **immediately aborted with a prompt to switch proxy** — a broken panel is never installed.
2. **Semantic feature (fallback)**: when `checksums.sha256` is unavailable (network etc.), degrade to keyword checks — `dashboard.js` must contain `fetchBackups`, `adguardhome.lua` must contain `list_backups`.

### Verify locally whether the deployed panel is up to date

```sh
# On the router: does the panel JS contain backup management? ( >0 means OK)
grep -c fetchBackups /www/luci-static/resources/view/adguardhome/dashboard.js

# In the repo: verify local files against the release manifest (all OK = matches release)
sha256sum -c checksums.sha256
```

### Hit an old version during install/upgrade?

The install log shows `sha256 mismatch` / `content verification failed` and prompts to switch proxy:

```sh
# Re-run with another proxy
GITHUB_PROXY=https://kkgithub.com/ sh -c "$(curl -fsSL https://kkgithub.com/https://raw.githubusercontent.com/imonior/luci-app-adguardhome-dashboard/main/scripts/install.sh)"
# Or connect directly to raw.githubusercontent.com (bypass mirror cache)
curl -fsSL https://raw.githubusercontent.com/imonior/luci-app-adguardhome-dashboard/main/files/view/dashboard.js -o /www/luci-static/resources/view/adguardhome/dashboard.js
```

---

## Backup & Restore

### Three backup types

| Type | Created when | Path | Has restore.sh | Restores |
|------|------|------|:---:|------|
| install | install/update panel | `/root/agh_backup_install_<ts>` | ✓ | panel files (incl. manifest.json, core untouched) |
| dashboard | panel self-upgrade | `/root/agh_backup_dashboard_<ts>` | ✓ | panel files (incl. manifest.json, core untouched) |
| core | AGH core upgrade | `/root/agh_backup_core_<ts>` | ✗ | old binary only (manual `cp`) |

### How to restore

**In-panel**: LuCI → Services → AdGuard Home → Backup management → find the backup → click "Restore" or "Command"

**Command line**:
```sh
# install / dashboard backups
sh /root/agh_backup_install_<ts>/restore.sh
sh /root/agh_backup_dashboard_<ts>/restore.sh

# core backup (manual)
/etc/init.d/AdGuardHome stop 2>/dev/null || /etc/init.d/adguardhome stop 2>/dev/null
cp /root/agh_backup_core_<ts>/AdGuardHome /opt/AdGuardHome/AdGuardHome
chmod 755 /opt/AdGuardHome/AdGuardHome
/etc/init.d/AdGuardHome start 2>/dev/null || /etc/init.d/adguardhome start 2>/dev/null
```

> Clean backups: click "Delete" in panel Backup management, or manually `rm -rf /root/agh_backup_*`

---

## Layered Log

```
┌─────────────────────────────────────────┐
│ === AdGuardHome status ===             │  ← header summary
│ AdGuard Home v0.107.52                 │
│ PID: 1234 (running)                    │
│ ========================...             │
│                                         │
│ === Exec/Upgrade log ===               │  ← middle layer EXEC_LOG
│ [output of upgrade/start/stop actions]  │
│                                         │
│ === System/Runtime log (latest) ===     │  ← runtime layer
│ [AGH native log tail -n 100]            │
│ or [logread -e AdGuardHome tail -n 50]  │
└─────────────────────────────────────────┘
```

**Operations**:
- "Refresh log" button: re-fetch latest content, auto-scroll to bottom
- "Clear log" button: clears EXEC_LOG (runtime log is managed by AGH/system and is unaffected)
- "Auto refresh" toggle: 3s interval auto-fetch (yields to upgrade polling while an upgrade is in progress)

---

## Requirements

- OpenWrt / ImmortalWrt / iStoreOS
- LuCI 2.0 (OpenWrt 21.02+)
- curl (built into most firmwares)
- At least 8MB free space

---

## Notes

- After install, open the dashboard at LuCI → **Services** → **AdGuard Home**
- Proxy persistence file: `/etc/adguardhome-dashboard.proxy`
- Exec/upgrade log: `/tmp/agh_exec.log` (EXEC_LOG, contains `done` / `FAILED` markers for frontend polling)
- Install log: `/etc/adguardhome-dashboard.log`
- Backup dirs: `/root/agh_backup_{install,core,dashboard}_<ts>` (kept by timestamp, cleanable in panel Backup management)

---

## Architecture

```
Browser JS View  ──HTTP──▸  Lua Controller  ──exec──▸  System commands
(view.extend)              (util.exec)               (pgrep/init.d/binary)
     │                          │
     │ 5s poll status           │ read persisted proxy
     │ 2s poll log (upgrading)  │ call GitHub raw / API
     │ 3s poll log (auto-refresh)│ write EXEC_LOG / backup dirs
     └──────────────────────────┘
```

---

## Changelog

- **v2.5.6**
  - Extended the proxy-aware GitHub Releases fallback (previously added for `AdGuardHome --update`) to the force-reinstall (`install.sh -r`) and fresh-install paths. These previously fetched the binary package directly from `static.adtidy.org` (bypassing the selected proxy) with no fallback on failure; now they fall back to a proxy-aware package download + overwrite when `install.sh` fails
  - `fallback_upgrade_via_proxy` now takes an explicit destination argument (defaults to `BIN_PATH`, or the first `BIN_PATHS` entry when unset), so the fresh-install path can place the binary correctly

- **v2.5.5**
  - Proxy selection simplified to: test connectivity → pick by result (install: enter number; dashboard: click) → fixed for the session; only if the chosen connection actually fails mid-download does it re-prompt with a fresh connectivity test (install.sh)
  - Custom proxy latency test now works reliably (`proxify()` normalizes the missing trailing slash)
  - Dashboard proxy test UX: page-load auto-test + manual per-proxy single test + "Test All" button; removed the 60s background polling and the auto re-test on upgrade FAILED (user can click test manually)

- **v2.5.1**
  - Fixed install.sh verification root cause: `verify_one()` returned the boolean inverted, so valid files were flagged as failed (aborting install) and stale/cached files were silently accepted. Present since the 2.3.1 fingerprint check; now corrected (pass → 0, fail → 1)
  - Panel self-upgrade now strictly honors the UI proxy choice (direct = direct only; selected proxy = that proxy + direct fallback) instead of always appending built-in proxies
  - Panel self-upgrade download hardened: target dir is created before each `curl -o`, eliminating the `curl: (23)` write failure
  - install.sh GitHub direct connectivity probe now retries (3×, 12s each) so a merely-slow `raw.githubusercontent.com` is no longer misreported as "direct unavailable"
  - install.sh interaction is now English by default with a language picker (English / 中文); reinstall backup messaging clarified

- **v2.5.0**
  - Bumped version to **2.5.0** (single version source = `manifest.json`; the router reads the locally deployed `/usr/share/adguardhome-dashboard/manifest.json` at runtime)
  - Fixed panel self-upgrade "all downloads fail after clicking upgrade, leaving only an empty backup dir":
    - The upgrade script previously passed `$TMPDIR` as a literal into a single-quoted shell argument, so `curl -o` wrote to a fake path causing `curl: (23)` write failure; now uses the real absolute path computed by Lua
    - The backup dir is now created lazily per file, so no empty backup dir is left behind when download/verify fails
  - Clarified "Clear log" semantics: only clears the middle-layer exec/upgrade log (EXEC_LOG); the system/AGH runtime log layer is view-only cleared and re-shows after refresh (system/AGH's own logs are never deleted)
- **v2.4.0**
  - Added backup management, panel self-upgrade, sha256 content-fingerprint two-layer verification, proxy-cache protection, etc. (see "Proxy Cache & Content Fingerprint")

---

**MIT License** | Lightweight · Stable · Standard LuCI 2.0
