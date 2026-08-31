[🇺🇸 English](README.md) · [开发说明 Development](DEVELOPMENT.zh-CN.md)

# AdGuardHome LuCI Dashboard

**LuCI 2.0 标准 AdGuard Home 管理面板** | **LuCI 2.0 AdGuard Home Dashboard**
**v2.5.6**

为 OpenWrt / ImmortalWrt / iStoreOS 提供完整的 AdGuard Home 管理面板。

---

## 安装 / Install

### 一键安装（推荐）

```sh
sh -c "$(curl -fsSL https://raw.githubusercontent.com/imonior/luci-app-adguardhome-dashboard/main/scripts/install.sh)"
```

安装脚本分两步执行：

1. **AdGuard Home 核心** — 检测 `/opt/AdGuardHome/AdGuardHome` 是否已安装，未安装则调用官方脚本自动安装；已安装则可选择覆盖安装（自动停止运行中的服务）或跳过
2. **LuCI Dashboard** — 从 GitHub 下载菜单注册、Lua Controller、JS View、翻译等文件及 `checksums.sha256` 到临时目录，先做 **sha256 内容指纹校验**（命中代理缓存旧版立即中止并提示换代理），再部署到系统对应位置

> install.sh 在覆盖前会自动把现有的面板文件（含 `manifest.json`）备份到 `/root/agh_backup_install_<ts>/`，并在备份目录内生成 `restore.sh`。万一安装失败或想回滚到旧版面板，执行 `sh /root/agh_backup_install_<ts>/restore.sh` 即可（仅恢复面板文件，不动 AGH 核心二进制）。

### 国内加速 / Proxy

脚本启动时自动检测 GitHub 连通性，直连失败会逐个测试代理节点并显示延迟，选择可用的即可：

```
  #   代理节点          状态
  ─────────────────────────────
  1)  直连              ✗ 不可用
  2)  ghfast.top        ✓ 320ms
  3)  gh-proxy.com      ✓ 450ms
  4)  kkgithub.com      ✗ 超时
```

也可通过环境变量直接指定代理（跳过检测）：

```sh
GITHUB_PROXY=https://ghfast.top/ sh -c "$(curl -fsSL https://ghfast.top/https://raw.githubusercontent.com/imonior/luci-app-adguardhome-dashboard/main/scripts/install.sh)"
```

> 注意：`curl` 下载脚本本身的 URL 也需要经过代理，如上面示例中 `curl` 的 URL 已加了 `ghfast.top/` 前缀。

### 从本地项目安装

如果已将项目克隆到路由器，在项目目录内运行会自动使用本地文件（无需联网下载）：

```sh
cd /path/to/luci-app-adguardhome-dashboard
sh scripts/install.sh
```

> `install.sh` 支持安装和更新（幂等），自动清理旧版本文件。

## 卸载 / Uninstall

```sh
sh -c "$(curl -fsSL https://raw.githubusercontent.com/imonior/luci-app-adguardhome-dashboard/main/scripts/uninstall.sh)"
```

---

## 特性 / Features

- **LuCI 2.0 标准架构**：menu.json 注册菜单 + JS View 生命周期管理，非模板渲染
- **后端 RPC**：Lua Controller 提供 13 个 API 端点，无 ACL 越权
- **实时状态监控**：5 秒自动轮询，实时更新版本/运行状态/PID/端口/代理设置/面板版本
- **服务控制台**：启动/停止/重启/注册系统服务，支持 init.d 和二进制双模式
- **混合日志查看器**：分层追加模式，顶部为执行/升级日志（EXEC_LOG），下方追加 AGH 原生日志或系统 logread 的最新 50/100 行；支持手动刷新、升级时 2 秒自动轮询、可选的自动刷新开关（3 秒间隔）、一键清空中间层日志
- **核心版本管理**：检查更新 + 一键升级 + 强制重装，升级进度 2 秒快速轮询实时滚动
- **全局代理选择**：内置 4 候选（直连 / ghfast.top / gh-proxy.com / kkgithub.com）+ 自定义输入，点选模式立即持久化到 `/etc/adguardhome-dashboard.proxy`
- **代理延迟测试**：单点测试 / 批量测试所有候选，测试目标与实际下载域名一致（`raw.githubusercontent.com`），先持久化再测试
- **面板自升级**：检查面板版本（读 `manifest.json`） → 一键升级（在线下载 7 个面板文件（含 manifest.json）覆盖本地），无需手动上传
- **两阶段提交 + 自动回滚**：核心升级和面板升级都采用「下载到临时目录 + 完整性校验 → 备份 + 原子 mv 覆盖」模式，任一步骤失败自动从备份还原已部署文件
- **完整性校验（双重防线）**：① 类型校验 lmo magic `LMO\0` / lua 含 `function` / js 含 `view.extend` / po 含 `msgid`，防止空文件 / 404 HTML / 截断；② **sha256 内容指纹**：install 与面板升级都先下载 `checksums.sha256`，对面板文件逐一比对 sha256，任何与发布清单不一致的内容（尤其是代理/CDN 缓存的旧版本）都会被拦截并中止升级，避免装上残缺面板
- **备份管理**：列出 `/root/agh_backup_*` 所有备份目录（install/core/dashboard 三类），显示类型/时间戳/文件数/大小/含核心/含 restore.sh；支持一键恢复（仅 install/dashboard 类备份有 restore.sh）、显示恢复命令、删除备份释放空间
- **install 自带备份**：install.sh 部署前自动备份现有面板文件（含 manifest.json）+ 生成 restore.sh，与面板升级的备份机制完全一致
- **国际化支持**：中英文自动切换，基于 LuCI 系统语言设置（124 条翻译）
- **跨平台**：OpenWrt / ImmortalWrt / iStoreOS

---

## 项目结构 / Structure

```text
luci-app-adguardhome-dashboard/
├── scripts/
│   ├── install.sh        # 安装/更新脚本（Part1: AGH核心 Part2: Dashboard文件 + 自动备份 + 生成 restore.sh）
│   └── uninstall.sh      # 卸载脚本
├── files/
│   ├── luci/
│   │   ├── menu.d/
│   │   │   └── luci-app-adguardhome-dashboard.json  # LuCI 2.0 菜单注册
│   │   ├── acl.json      # rpcd 访问控制权限
│   │   ├── controller/
│   │   │   └── adguardhome.lua  # 后端 Lua Controller (13 个 API 端点)
│   │   └── i18n/
│   │       ├── adguardhome.po       # 英文翻译源文件
│   │       ├── adguardhome.zh-cn.po # 中文翻译源文件
│   │       ├── adguardhome.lmo      # 英文编译翻译（LuCI 二进制格式）
│   │       └── adguardhome.zh-cn.lmo# 中文编译翻译
│   └── view/
│       └── dashboard.js  # LuCI 2.0 JS View (view.extend)
├── tools/
│   └── po2lmo.py         # .po → .lmo 编译工具（开发用，不部署到路由器）
├── checksums.sha256      # 发布用 sha256 清单（install / 面板升级的内容指纹来源）
├── manifest.json         # 包清单（面板自升级版本号来源）
└── README.md             # 项目说明（英文默认）
└── README.zh-CN.md       # 项目说明（中文）
```

---

## API 接口 / API Endpoints

| 路径 | 方法 | 功能 |
|------|------|------|
| `/admin/services/adguardhome/status` | GET | 获取状态（版本/运行/PID/端口/路径/代理/面板版本） |
| `/admin/services/adguardhome/action` | POST | 执行操作（start/stop/restart/install_service/install_core） |
| `/admin/services/adguardhome/set_proxy` | POST | 立即持久化代理到 `/etc/adguardhome-dashboard.proxy` |
| `/admin/services/adguardhome/proxy_test` | POST | 测试代理延迟（目标：`raw.githubusercontent.com`） |
| `/admin/services/adguardhome/check_update` | POST | 检查 AGH 核心 GitHub 最新版本（用持久化代理） |
| `/admin/services/adguardhome/upgrade` | POST | 启动 AGH 核心升级（force=0 用 `--update` / force=1 用安装脚本 `-r`） |
| `/admin/services/adguardhome/check_dashboard_update` | GET | 检查面板自身最新版本（读 GitHub `manifest.json`） |
| `/admin/services/adguardhome/upgrade_dashboard` | POST | 启动面板自升级（在线下载 7 个文件（含 manifest.json）覆盖本地） |
| `/admin/services/adguardhome/log` | GET | 获取混合日志（顶部 EXEC_LOG + 下部 AGH 原生/logread + 头部摘要） |
| `/admin/services/adguardhome/clear_log` | POST | 清空中间层执行/升级日志（EXEC_LOG） |
| `/admin/services/adguardhome/backups` | GET | 列出 `/root/agh_backup_*` 所有备份目录 |
| `/admin/services/adguardhome/restore_backup` | POST | 从指定备份恢复（执行 `<dir>/restore.sh`） |
| `/admin/services/adguardhome/delete_backup` | POST | 删除指定备份目录 |

---

## 升级流程 / Upgrade Flow

### AGH 核心升级（两阶段提交 + 自动回滚）

```
阶段1: 备份当前二进制 → /root/agh_backup_core_<ts>/AdGuardHome
阶段2: 执行升级
       ├─ force=1: 多代理下载 install.sh → 停服 → sh install.sh -r
       ├─ force=0 + 有二进制: AdGuardHome --update
       └─ 无二进制: 多代理下载 install.sh → sh install.sh
阶段3: 完整性校验（新二进制存在 + 可执行 + 能输出版本）
阶段4: 校验失败 → 从备份恢复旧二进制 + 重启服务 → 写 FAILED 标记
阶段5: 重启服务 → 写 done 标记
```

### 面板自升级（两阶段提交 + 自动回滚）

```
阶段1: 7 个文件全部下载到 /tmp/agh_dash_new_<ts>/ + 完整性校验
       ├─ 先下载 checksums.sha256（内容指纹清单，来自 GitHub main）
       ├─ 每个文件 sha256 比对（与发布清单一致才放行；代理缓存旧版会被直接拦下）
       ├─ lmo: 校验尾字节 magic 4c4d6f00 (LMO\0)
       ├─ lua: 校验含 'function' + 'list_backups'
       ├─ js:  校验含 'view.extend' + 'fetchBackups'
       └─ po:  校验含 'msgid'
       任一失败 → 写 FAILED 标记 + 自动回滚 → 不动任何目标文件
阶段2: 逐文件备份 + mv 原子覆盖
       任一失败 → 从 /root/agh_backup_dashboard_<ts>/ 还原已部署的 → 写 FAILED 标记
阶段2.5: 在备份目录生成 restore.sh（与 install.sh restore 逻辑一致，恢复 7 个面板文件（含 manifest.json））
阶段3: 清 LuCI 缓存 + 重启 rpcd/uhttpd → 写 done 标记
```

---

## 代理缓存与内容指纹校验 / Proxy Cache & Content Fingerprint

GitHub 镜像/CDN（如 `ghfast.top`、`gh-proxy.com`）会对 `raw.githubusercontent.com` 的内容做缓存，且往往忽略 `?_cb=` 时间戳参数。如果缓存里是**更早、缺少某些功能的旧版本**，安装/升级会静默装上残缺面板（本项目曾因此导致「备份管理」与「清空日志」按钮不显示）。

为彻底防住这类问题，install 与面板升级都采用 **双重校验**：

1. **sha256 内容指纹（主防线）**：先从 GitHub main 下载 `checksums.sha256`（记录面板文件的 sha256），再对下载到的每个文件逐一比对 sha256。任何与发布清单不一致的内容（含代理缓存旧版、截断、被替换）都会**立即中止并提示换代理**，不会装上残缺面板。
2. **语义特征（兜底防线）**：当 `checksums.sha256` 因网络等原因不可用时，降级为关键字校验 —— `dashboard.js` 必须含 `fetchBackups`、`adguardhome.lua` 必须含 `list_backups`。

### 本地验证已部署面板是否为最新版

```sh
# 路由器上：面板 JS 是否含备份管理（返回 >0 即正常）
grep -c fetchBackups /www/luci-static/resources/view/adguardhome/dashboard.js

# 仓库内：用发布清单校验本地文件（全部 OK 即与发布一致）
sha256sum -c checksums.sha256
```

### 安装/升级时命中旧版本怎么办

安装日志会出现 `sha256 不匹配` / `内容校验失败`，并提示更换代理：

```sh
# 换用其它代理后重跑
GITHUB_PROXY=https://kkgithub.com/ sh -c "$(curl -fsSL https://kkgithub.com/https://raw.githubusercontent.com/imonior/luci-app-adguardhome-dashboard/main/scripts/install.sh)"
# 或直接直连 raw.githubusercontent.com（绕过镜像缓存）
curl -fsSL https://raw.githubusercontent.com/imonior/luci-app-adguardhome-dashboard/main/files/view/dashboard.js -o /www/luci-static/resources/view/adguardhome/dashboard.js
```

---

## 备份与恢复 / Backup & Restore

### 三类备份目录

| 类型 | 产生时机 | 路径 | 含 restore.sh | 恢复内容 |
|------|------|------|:---:|------|
| install | 安装/更新面板 | `/root/agh_backup_install_<ts>` | ✓ | 面板文件（含 manifest.json，不动 AGH 核心） |
| dashboard | 面板自升级 | `/root/agh_backup_dashboard_<ts>` | ✓ | 面板文件（含 manifest.json，不动 AGH 核心） |
| core | AGH 核心升级 | `/root/agh_backup_core_<ts>` | ✗ | 仅含旧二进制（手动 `cp` 恢复） |

### 恢复方式

**面板内**：进入 LuCI → 服务 → AdGuard Home → 备份管理 → 找到对应备份 → 点击「恢复」或「命令」

**命令行**：
```sh
# install / dashboard 类备份
sh /root/agh_backup_install_<ts>/restore.sh
sh /root/agh_backup_dashboard_<ts>/restore.sh

# core 类备份（手动）
/etc/init.d/AdGuardHome stop 2>/dev/null || /etc/init.d/adguardhome stop 2>/dev/null
cp /root/agh_backup_core_<ts>/AdGuardHome /opt/AdGuardHome/AdGuardHome
chmod 755 /opt/AdGuardHome/AdGuardHome
/etc/init.d/AdGuardHome start 2>/dev/null || /etc/init.d/adguardhome start 2>/dev/null
```

> 清理备份：在面板「备份管理」点击「删除」，或手动 `rm -rf /root/agh_backup_*`

---

## 混合日志 / Layered Log

```
┌─────────────────────────────────────────┐
│ === AdGuardHome 状态 ===                │  ← 头部摘要
│ AdGuard Home v0.107.52                  │
│ PID: 1234 (running)                     │
│ ========================...             │
│                                         │
│ === 执行/升级日志 ===                    │  ← 中间层 EXEC_LOG
│ [升级/启动/停止动作的输出]                │
│                                         │
│ === 系统/运行日志 (最新) ===             │  ← 运行日志层
│ [AGH 原生日志 tail -n 100]              │
│ 或 [logread -e AdGuardHome tail -n 50]  │
└─────────────────────────────────────────┘
```

**操作**：
- 「刷新日志」按钮：覆盖重刷最新内容，自动滚到底
- 「清空日志」按钮：清空 EXEC_LOG（运行日志由 AGH/系统管理，不受影响）
- 「自动刷新」开关：3 秒间隔自动拉取（升级进行中时让位给升级轮询，避免冲突）

---

## 系统要求 / Requirements

- OpenWrt / ImmortalWrt / iStoreOS
- LuCI 2.0（OpenWrt 21.02+）
- curl（大多数固件已内置）
- 至少 8MB 剩余空间

---

## 注意事项 / Notes

- 安装完成后，在 LuCI → **服务** → **AdGuard Home** 进入仪表盘
- 代理持久化文件：`/etc/adguardhome-dashboard.proxy`
- 执行/升级日志：`/tmp/agh_exec.log`（EXEC_LOG，含 `done` / `FAILED` 标记供前端轮询判定结果）
- 安装日志：`/etc/adguardhome-dashboard.log`
- 备份目录：`/root/agh_backup_{install,core,dashboard}_<ts>`（按时间戳保留，可在面板「备份管理」清理）

---

## 架构 / Architecture

```
浏览器 JS View  ──HTTP──▸  Lua Controller  ──exec──▸  系统命令
(view.extend)              (util.exec)               (pgrep/init.d/binary)
     │                          │
     │ 5s 轮询 status           │ 读取持久化代理
     │ 2s 轮询 log (升级时)     │ 调用 GitHub raw / API
     │ 3s 轮询 log (自动刷新)   │ 写 EXEC_LOG / 备份目录
     └──────────────────────────┘
```

---

## 变更记录 / Changelog

- **v2.5.6**
  - 将代理感知的 GitHub Releases 兜底（此前仅为 `AdGuardHome --update` 增加）扩展到强制重装（`install.sh -r`）与全新安装路径。这两条路径此前直接从 `static.adtidy.org` 拉取二进制包（绕过所选代理）且失败无兜底；现在当 `install.sh` 失败时自动回退到代理感知的包下载 + 覆盖写入
  - `fallback_upgrade_via_proxy` 现接受显式目标路径参数（默认 `BIN_PATH`，为空时取首个 `BIN_PATHS` 条目），使全新安装路径也能正确落盘二进制

- **v2.5.5**
  - 代理选型简化为：先测试连通性 → 按结果选择（install 输入序号 / dashboard 点选）→ 当次下载固定使用 → 仅当所选连接在下载中确实失败时，才用新的连通测试结果交互提示用户改选（install.sh）
  - 自定义代理延迟测试现在稳定可用（`proxify()` 规范化缺失的结尾斜杠）
  - 面板代理测试交互：页面加载自动测 + 手动每个代理单点测试 + 「测试所有」按钮；移除了 60s 后台轮询与升级 FAILED 时的自动重测（用户可手动点测试）

- **v2.5.1**
  - 修复安装脚本校验根因：`verify_one()` 返回语义反转，导致合法文件被误判为失败（中止安装）、陈旧/缓存文件被静默放行。该问题自 2.3.1 引入指纹校验时存在，现已修正（通过→0、失败→1）
  - 面板自升级现在严格遵守 UI 代理选择（选 direct 仅直连；选某代理则仅该代理+直连兜底），不再无条件追加内置代理
  - 面板自升级下载加固：每次 `curl -o` 前先创建目标目录，消除 `curl: (23)` 写失败
  - 安装脚本 GitHub 直连连通性探针改为重试（3 次、每次 12s），避免 `raw.githubusercontent.com` 偶发慢连被误报为「直连不可用」
  - 安装脚本交互改为英文为默认并开头可选语言（English / 中文）；非首次安装备份文案已明确

- **v2.5.0**
  - 版本号提升至 **2.5.0**（版本单一数据源 = `manifest.json`，路由器运行时读取本地部署的 `/usr/share/adguardhome-dashboard/manifest.json`）
  - 修复面板自升级「点升级后下载全失败、只留下空备份目录」：
    - 升级脚本原将 `$TMPDIR` 当作字面量写入被单引号包裹的 shell 参数，`curl -o` 写到假路径导致 `curl: (23)` 写失败；改为使用 Lua 计算出的真实绝对路径
    - 备份目录改为按文件惰性创建，下载/校验失败时不再残留空备份目录
  - 「清空日志」明确语义：仅清空中间层执行/升级日志（EXEC_LOG）；系统/AGH 运行日志层只清视图、刷新后继续显示（不删系统/AGH 自身日志）
- **v2.4.0**
  - 新增备份管理、面板自升级、sha256 内容指纹双重校验、代理缓存防护等（详见「代理缓存与内容指纹校验」一节）

---

**MIT License** | 轻量 · 稳定 · 标准 LuCI 2.0
