[🇨🇳 中文开发说明](DEVELOPMENT.zh-CN.md) · [🇺🇸 English README](README.md) · [🇨🇳 中文 README](README.zh-CN.md)

# Development

> This document is for developers: the local test package, translation build, and release procedure. End users should read [README.md](README.md) (English) or [README.zh-CN.md](README.zh-CN.md) (Chinese).

---

## 1. `changes_package/` local test package

`changes_package/` is a deployment bundle for **manually uploading to the router for local testing only**. It is **never pushed to the GitHub repo** (blocked by `.gitignore`). It must stay **byte-for-byte identical** to the files under `files/` — the official release path is the in-panel "Check panel update → Upgrade panel" flow; `changes_package/` is only for local verification when network access is inconvenient.

After any change to `files/`, you must `cp` it into the matching `changes_package/` file, confirm with `diff -q`, then deploy to the router via `changes_package/deploy_atomic.sh`. Otherwise the router runs the old version and your test does not reflect your change.

`changes_package/` contains: `adguardhome.lua`, `dashboard.js`, `*.lmo`, `*.po`, `deploy_atomic.sh`, each corresponding one-to-one to the main files in `files/`.

---

## 2. Editing translations

Translation sources are `files/luci/i18n/adguardhome.po` (English) and `files/luci/i18n/adguardhome.zh-cn.po` (Chinese). After editing a `.po` you must recompile it into the LuCI binary format `.lmo`:

```sh
python3 tools/po2lmo.py files/luci/i18n/adguardhome.po files/luci/i18n/adguardhome.lmo
python3 tools/po2lmo.py files/luci/i18n/adguardhome.zh-cn.po files/luci/i18n/adguardhome.zh-cn.lmo
```

> `po2lmo.py` is dev-only and is not deployed to the router.

---

## 3. Releasing a new version

1. Edit source files under `files/`.
2. Recompile `.po` → `.lmo` (see above).
3. **Regenerate the content-fingerprint manifest** (required after ANY change to files under `files/`; otherwise install/panel-upgrade will abort with a sha256 mismatch):
   ```sh
   sha256sum files/luci/controller/adguardhome.lua \
             files/luci/menu.d/luci-app-adguardhome-dashboard.json \
             files/luci/acl.json \
             files/view/dashboard.js \
             files/luci/i18n/adguardhome.lmo \
             files/luci/i18n/adguardhome.zh-cn.lmo \
             files/luci/i18n/adguardhome.po \
             files/luci/i18n/adguardhome.zh-cn.po > checksums.sha256
   # append manifest.json separately (key is the repo-root path, matching the download src)
   printf '%s  manifest.json\n' "$(sha256sum manifest.json | awk '{print $1}')" >> checksums.sha256
   ```
4. Bump the `version` field in `manifest.json` using semantic versioning. **The version is a single source of truth**: the router's `adguardhome.lua` reads the locally deployed `/usr/share/adguardhome-dashboard/manifest.json` at runtime to get the installed version (it no longer depends on the hardcoded `DASHBOARD_VERSION` constant, which only serves as a fallback when the local manifest is missing). So a release only requires changing one number in `manifest.json` — no manual lua constant sync.
5. `git add files/ checksums.sha256 manifest.json && git commit -m "bump dashboard to x.y.z" && git push origin main`

After pushing to main, every router can click "Check panel update" to see the new version and upgrade online.
