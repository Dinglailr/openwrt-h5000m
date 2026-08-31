[🇺🇸 English Development](DEVELOPMENT.md) · [🇺🇸 英文 README](README.md) · [🇨🇳 中文 README](README.zh-CN.md)

# 开发说明

> 本文档面向开发者，包含本地测试包说明、翻译编译与发版流程。普通用户请阅读 [README.md](README.md)（英文）或 [README.zh-CN.md](README.zh-CN.md)（中文）。

---

## 1. `changes_package/` 本地测试包

`changes_package/` 是开发机上用于**手动上传到路由器做本地测试**的部署包，**不会推送到 GitHub 仓库**（已在 `.gitignore` 屏蔽）。它必须保持与 `files/` 下文件**逐字节一致**——正式发布走面板内「检查面板更新 → 升级面板」在线完成，`changes_package/` 仅用于不方便联网时的本地验证。

任何修改 `files/` 之后，必须同步 `cp` 到 `changes_package/` 对应文件，再用 `diff -q` 确认一致，然后配合 `changes_package/deploy_atomic.sh` 上传路由器部署。否则路由器拿到的是旧版本，测非所改。

`changes_package/` 内包含：`adguardhome.lua`、`dashboard.js`、`*.lmo`、`*.po`、`deploy_atomic.sh`，与 `files/` 主文件一一对应。

---

## 2. 修改翻译

翻译源文件为 `files/luci/i18n/adguardhome.po`（英文）与 `files/luci/i18n/adguardhome.zh-cn.po`（中文）。修改 `.po` 后必须重新编译为 LuCI 二进制格式 `.lmo`：

```sh
python3 tools/po2lmo.py files/luci/i18n/adguardhome.po files/luci/i18n/adguardhome.lmo
python3 tools/po2lmo.py files/luci/i18n/adguardhome.zh-cn.po files/luci/i18n/adguardhome.zh-cn.lmo
```

> `po2lmo.py` 仅用于开发，不部署到路由器。

---

## 3. 发布新版本

1. 修改 `files/` 下的源文件。
2. 重新编译 `.po` → `.lmo`（见上）。
3. **重新生成内容指纹清单**（任何对 `files/` 下文件的改动都必须执行，否则 install/面板升级会判定 sha256 不匹配而中止）：
   ```sh
   sha256sum files/luci/controller/adguardhome.lua \
             files/luci/menu.d/luci-app-adguardhome-dashboard.json \
             files/luci/acl.json \
             files/view/dashboard.js \
             files/luci/i18n/adguardhome.lmo \
             files/luci/i18n/adguardhome.zh-cn.lmo \
             files/luci/i18n/adguardhome.po \
             files/luci/i18n/adguardhome.zh-cn.po > checksums.sha256
   # manifest.json 单独追加（key 为仓库根路径，与下载 src 一致）
   printf '%s  manifest.json\n' "$(sha256sum manifest.json | awk '{print $1}')" >> checksums.sha256
   ```
4. 在 `manifest.json` 中按语义化版本 bump `version` 字段。**版本号是单一数据源**：路由器上的 `adguardhome.lua` 会在运行时读取本地部署的 `/usr/share/adguardhome-dashboard/manifest.json` 获取已安装版本（不再依赖写死的 `DASHBOARD_VERSION` 常量，该常量仅作为「本地 manifest 缺失」时的兜底）。因此发版**只需改 manifest.json 一个数字**，无需手动同步 lua 常量。
5. `git add files/ checksums.sha256 manifest.json && git commit -m "bump dashboard to x.y.z" && git push origin main`

推到 main 后，所有路由器上点「检查面板更新」即可看到新版本并在线升级。
