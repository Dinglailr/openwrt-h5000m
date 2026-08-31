#!/bin/sh
set -e

# ── i18n: default English, optional language selection ──
# 默认英文交互；开始时可选择中文 / Default interaction is English; a language can be chosen at start.
_lang="en"
_t() {
    # _t "english text" "中文文本" — pick string by _lang
    if [ "$_lang" = "zh" ]; then printf '%s' "$2"; else printf '%s' "$1"; fi
}

REPO="imonior/luci-app-adguardhome-dashboard"
BRANCH="main"
RAW_BASE="https://raw.githubusercontent.com/${REPO}/${BRANCH}"
_gh_raw="$RAW_BASE"   # pure direct URL; never gets a proxy prefix / 纯直连地址，永不被代理前缀修改

AGH_DIR="/opt/AdGuardHome"
AGH_BIN="/opt/AdGuardHome/AdGuardHome"
AGH_INSTALL_URL_BASE="https://raw.githubusercontent.com/AdguardTeam/AdGuardHome/master/scripts/install.sh"
AGH_INSTALL_URL="$AGH_INSTALL_URL_BASE"

# GitHub acceleration proxy list (optional for users in mainland CN) / GitHub 加速代理列表（国内用户可选）
PROXY_LIST="
https://ghfast.top/
https://gh-proxy.com/
https://kkgithub.com/
"

log() {
    ts=$(date '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "0000-00-00 00:00:00")
    echo "[$ts] $1"
}

_now_ms() {
    # BusyBox date lacks %N nanoseconds; use seconds × 1000 (1s granularity suffices for proxy latency display and is cross-platform)
    # BusyBox date 不支持 %N 纳秒，用秒×1000（粒度 1s 足够代理延迟显示，且跨平台兼容）
    echo $(( $(date +%s 2>/dev/null || echo 0) * 1000 ))
}
_elapsed_ms() { echo $(( $(_now_ms) - $1 )); }

echo ""
echo "========================================================="
echo " AdGuardHome LuCI Dashboard"
echo "========================================================="
echo ""
echo "$(_t "Language / 语言:" "语言 / Language:")"
echo "  1) English (default)"
echo "  2) 中文"
printf "$(_t "Select [1/2, default 1]: " "请选择 [1/2，默认 1]: ")"
read -r _lang_choice
case "$_lang_choice" in
    2) _lang="zh" ;;
    *) _lang="en" ;;
esac
echo ""

# ── GitHub connectivity test & connection selection ──
# Always test every candidate (direct + proxies) and show a table, letting the user pick ONE connection.
# Downloads FIXEDLY use the selected connection (no silent proxy hop); only if the chosen connection
# is unreachable do we re-run the test and let the user pick again.
# 始终测试所有候选（直连 + 各代理）并展示表格，让用户选定「一个」连接。
# 下载「固定」使用该连接（不再静默跳代理）；仅当选定连接不可达时，才重新测试并让用户改选。
TEST_URL="https://raw.githubusercontent.com/${REPO}/${BRANCH}/manifest.json"

PROXY_PREFIX=""
CONNECTION_LABEL="$(_t "Direct" "直连")"

# Apply the selected connection to all GitHub URLs (idempotent: always recomputed from base, never double-prefixed)
# 将选定连接应用到所有 GitHub URL（幂等：始终基于基址重算，不会重复加前缀）
gh_apply_conn() {
    if [ -n "$PROXY_PREFIX" ]; then
        RAW_BASE="${PROXY_PREFIX}https://raw.githubusercontent.com/${REPO}/${BRANCH}"
        AGH_INSTALL_URL="${PROXY_PREFIX}${AGH_INSTALL_URL_BASE}"
        GH_API_BASE="${PROXY_PREFIX}https://api.github.com"
        echo "proxy=${PROXY_PREFIX}" > /etc/adguardhome-dashboard.proxy 2>/dev/null || true
    else
        RAW_BASE="https://raw.githubusercontent.com/${REPO}/${BRANCH}"
        AGH_INSTALL_URL="$AGH_INSTALL_URL_BASE"
        GH_API_BASE="https://api.github.com"
        rm -f /etc/adguardhome-dashboard.proxy 2>/dev/null || true
    fi
}

# 提示输入自定义代理并测试；循环直到可用或留空（中止）。
# Prompt for a custom proxy and test it; loop until reachable or empty (abort).
gh_prompt_custom() {
    while true; do
        printf "$(_t "All known nodes unreachable. Enter a custom proxy URL (e.g. https://gh.proxy.com/), or leave empty to abort: " "所有已知节点均不可用。请输入自定义代理 URL（如 https://gh.proxy.com/），留空则中止: ")"
        read -r USER_PROXY || true
        USER_PROXY=$(echo "$USER_PROXY" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        [ -z "$USER_PROXY" ] && return 1
        case "$USER_PROXY" in
            */) PROXY_PREFIX="$USER_PROXY" ;;
            *)  PROXY_PREFIX="${USER_PROXY}/" ;;
        esac
        CONNECTION_LABEL="$PROXY_PREFIX"
        log "$(_t "Testing custom proxy: $PROXY_PREFIX" "正在测试自定义代理: $PROXY_PREFIX")"
        if curl -fsSL -m 10 -o /dev/null "${PROXY_PREFIX}${TEST_URL}" 2>/dev/null; then
            log "$(_t "Custom proxy reachable" "自定义代理可用")"
            return 0
        fi
        log "$(_t "Custom proxy unreachable, please try another" "自定义代理不可用，请换一个")"
    done
}

# 已移除自动顺序探测逻辑（auto-pick）：改为「测试后由用户按序号选择 → 当次固定使用 → 下载中确不可用才重新测试并交互改选」。
# Auto-sequential probing (auto-pick) removed: now it is test -> user picks by number -> fixed for the session
# -> re-test and let the user re-pick only when the chosen connection proves unusable during download.

# Test connectivity and prompt the user to select ONE connection
# 测试连通性并提示用户选择「一个」连接
gh_select_connection() {
    echo ""
    log "$(_t "Testing GitHub connectivity (direct + proxies)..." "正在测试 GitHub 连通性（直连 + 各代理）...")"

    # Direct (lenient: retry up to 3× so a single slow probe isn't a false negative)
    # 直连（宽松：重试 3 次，避免单次慢连接被误判为不可用）
    _direct_ok="0"; _direct_ms="0"
    _t0=$(_now_ms); _attempt=0
    while [ "$_attempt" -lt 3 ]; do
        if curl -fsSL -m 12 -o /dev/null "$TEST_URL" 2>/dev/null; then _direct_ok="1"; break; fi
        _attempt=$((_attempt + 1))
    done
    if [ "$_direct_ok" = "1" ]; then _direct_ms=$(_elapsed_ms $_t0); fi

    # Each proxy (single attempt) / 各代理（单次探测）
    _results_file=$(mktemp 2>/dev/null || echo "/tmp/agh_proxy_results_$$")
    : > "$_results_file"
    for _proxy in $PROXY_LIST; do
        _t1=$(_now_ms)
        if curl -fsSL -m 10 -o /dev/null "${_proxy}${TEST_URL}" 2>/dev/null; then
            echo "${_proxy}|ok|$(_elapsed_ms $_t1)" >> "$_results_file"
        else
            echo "${_proxy}|fail|0" >> "$_results_file"
        fi
    done

    # Build the table / 展示表格
    echo ""
    echo "  #   $(_t "Node" "节点")                  $(_t "Status" "状态")"
    echo "  --------------------------------------------"
    if [ "$_direct_ok" = "1" ]; then
        printf "  1)  %-18s ✓ %sms\n" "$(_t "Direct" "直连")" "$_direct_ms"
    else
        printf "  1)  %-18s ✗ %s\n" "$(_t "Direct" "直连")" "$(_t "unavailable" "不可用")"
    fi
    _idx=2
    while IFS='|' read -r _p _s _ms; do
        [ -z "$_p" ] && continue
        _domain=$(echo "$_p" | sed 's|https\{0,1\}://||;s|/$||')
        if [ "$_s" = "ok" ]; then
            printf "  %d)  %-18s ✓ %sms\n" "$_idx" "$_domain" "$_ms"
        else
            printf "  %d)  %-18s ✗ %s\n" "$_idx" "$_domain" "$(_t "timeout" "超时")"
        fi
        _idx=$((_idx + 1))
    done < "$_results_file"
    _custom_opt=$_idx
    echo "  ${_custom_opt})  $(_t "Custom proxy URL" "自定义代理 URL")"
    echo ""
    echo "  $(_t "Note: connectivity test is for reference only; DNS hijacking/transparent proxy may affect accuracy" "注意：连通性测试仅供参考，DNS 劫持/透明代理可能导致测试不准")"
    echo ""

    # 默认：直连可达则默认直连；否则默认第一个可达代理；都不可达则默认自定义（回车即提示输入）
    # Default: Direct if reachable, else first reachable proxy, else custom (Enter prompts for a URL)
    if [ "$_direct_ok" = "1" ]; then
        _default_choice=1
    else
        _default_choice=$_custom_opt
        _i=2
        while IFS='|' read -r _p _s _ms; do
            [ -z "$_p" ] && continue
            if [ "$_s" = "ok" ]; then _default_choice=$_i; break; fi
            _i=$((_i + 1))
        done < "$_results_file"
    fi

    # 交互选择：选中某节点则固定使用（不静默跳到其它节点）；下载失败可交互重选 / Interactive: fixed-use of chosen node; re-pick on failure
    while true; do
        printf "$(_t "Select connection [1-%d, default %d]: " "请选择连接 [1-%d，默认 %d]: ")" "$_custom_opt" "$_default_choice"
        read -r CONN_CHOICE || true
        CONN_CHOICE=${CONN_CHOICE:-$_default_choice}

        if [ "$CONN_CHOICE" = "$_custom_opt" ]; then
            gh_prompt_custom
            if [ $? -eq 0 ]; then break
            elif [ -t 0 ]; then
                # 交互模式下留空 → 回到选择菜单，可改选直连/内置代理（不强制中止）
                # Interactive: empty input -> back to the menu so they can pick Direct/built-in instead
                log "$(_t "Custom proxy empty, please choose another option" "自定义代理为空，请选择其他选项")"
            else
                # 非交互（stdin 非 TTY，如管道为空）下留空 → 直接中止，避免无限循环
                # Non-interactive (non-TTY stdin, e.g. empty pipe): abort to avoid an infinite loop
                rm -f "$_results_file" 2>/dev/null
                return 1
            fi
        elif [ "$CONN_CHOICE" = "1" ]; then
            if [ "$_direct_ok" = "1" ]; then
                PROXY_PREFIX=""; CONNECTION_LABEL="$(_t "Direct" "直连")"; break
            else
                log "$(_t "Direct is unavailable, please choose another" "直连不可用，请重新选择")"
            fi
        else
            _i=2; _picked=""
            while IFS='|' read -r _p _s _ms; do
                if [ "$_i" = "$CONN_CHOICE" ] && [ "$_s" = "ok" ]; then
                    PROXY_PREFIX="$_p"; _picked="yes"; CONNECTION_LABEL="$PROXY_PREFIX"; break
                fi
                _i=$((_i + 1))
            done < "$_results_file"
            if [ "$_picked" = "yes" ]; then break
            else
                log "$(_t "Selected node is unavailable, please choose another" "所选节点不可用，请重新选择")"
            fi
        fi
    done

    rm -f "$_results_file" 2>/dev/null
    gh_apply_conn
    log "$(_t "Using connection: $CONNECTION_LABEL" "使用的连接: $CONNECTION_LABEL")"
}

# If GITHUB_PROXY env is explicitly set, honor it without prompting (override)
# 若显式设置 GITHUB_PROXY 环境变量，则直接使用（覆盖交互选择）
if [ -n "$GITHUB_PROXY" ]; then
    PROXY_PREFIX="$GITHUB_PROXY"
    CONNECTION_LABEL="$PROXY_PREFIX"
    gh_apply_conn
    log "$(_t "Using proxy from GITHUB_PROXY env: $PROXY_PREFIX" "使用环境变量指定代理: $PROXY_PREFIX")"
else
    gh_select_connection || { log "$(_t "Connection setup aborted." "连接设置已中止。")"; exit 1; }
fi

# ═══════════════════════════════════════════════════════════
# Part 1: install the AdGuard Home core / 第一部分：安装 AdGuard Home 核心
# ═══════════════════════════════════════════════════════════

log "$(_t "── Part 1: AdGuard Home core ──" "── 第一部分：AdGuard Home 核心 ──")"

if [ -f "$AGH_BIN" ]; then
    log "$(_t "Detected AdGuard Home installed ($AGH_BIN)" "检测到已安装 AdGuard Home ($AGH_BIN)")"

    CURRENT_VER=$("$AGH_BIN" --version 2>&1 | awk '{print $NF}')
    case "$CURRENT_VER" in v*) ;; *) CURRENT_VER="v$CURRENT_VER" ;; esac

    LATEST_VER=$(curl -fsSL -m 5 "https://api.github.com/repos/AdguardTeam/AdGuardHome/releases/latest" 2>/dev/null \
        | awk -F'"' '/tag_name/{print $4; exit}')
    if [ -z "$LATEST_VER" ] && [ "$GH_API_BASE" != "https://api.github.com" ]; then
        LATEST_VER=$(curl -fsSL -m 8 "${GH_API_BASE}/repos/AdguardTeam/AdGuardHome/releases/latest" 2>/dev/null \
            | awk -F'"' '/tag_name/{print $4; exit}')
    fi
    if [ -z "$LATEST_VER" ]; then
        for _p in $PROXY_LIST; do
            LATEST_VER=$(curl -fsSL -m 8 "${_p}https://api.github.com/repos/AdguardTeam/AdGuardHome/releases/latest" 2>/dev/null \
                | awk -F'"' '/tag_name/{print $4; exit}')
            [ -n "$LATEST_VER" ] && break
        done
    fi

    if [ -n "$CURRENT_VER" ] && [ -n "$LATEST_VER" ]; then
        log "$(_t "Current: $CURRENT_VER    Latest: $LATEST_VER" "当前版本: $CURRENT_VER    最新版本: $LATEST_VER")"
        if [ "$CURRENT_VER" = "$LATEST_VER" ]; then
            log "$(_t "Already the latest version" "已是最新版本")"
        fi
    elif [ -n "$CURRENT_VER" ]; then
        log "$(_t "Current: $CURRENT_VER (could not fetch online version)" "当前版本: $CURRENT_VER (无法获取在线版本)")"
    elif [ -n "$LATEST_VER" ]; then
        log "$(_t "Current: unknown    Latest: $LATEST_VER" "当前版本: 未知    最新版本: $LATEST_VER")"
    fi

    echo ""
    echo "  1) $(_t "Re-download from official (overwrite current)" "从官方重新下载安装（覆盖当前版本）")"
    echo "  2) $(_t "Skip, keep current version" "跳过，保留当前版本")"
    echo ""
    printf "$(_t "Select [1/2, default 2]: " "请选择 [1/2，默认 2]: ")"
    read -r CHOICE
    CHOICE=${CHOICE:-2}

    if [ "$CHOICE" = "1" ]; then
        if pgrep -f 'AdGuardHome' > /dev/null 2>&1; then
            log "$(_t "Detected AdGuard Home running, stopping service first..." "检测到 AdGuard Home 正在运行，先停止服务...")"
            if [ -f /etc/init.d/AdGuardHome ]; then
                /etc/init.d/AdGuardHome stop 2>/dev/null || true
            elif [ -f /etc/init.d/adguardhome ]; then
                /etc/init.d/adguardhome stop 2>/dev/null || true
            else
                "$AGH_BIN" -s stop 2>/dev/null || true
            fi
            sleep 2
            if pgrep -f 'AdGuardHome' > /dev/null 2>&1; then
                log "$(_t "Warning: service did not stop cleanly, forcing termination..." "警告: 服务未能正常停止，尝试强制终止...")"
                killall AdGuardHome 2>/dev/null || true
                sleep 1
            fi
            log "$(_t "AdGuard Home stopped" "AdGuard Home 已停止")"
        fi

        log "$(_t "Reinstalling AdGuard Home from official script..." "从官方脚本重新安装 AdGuard Home...")"
        curl -fsSL "$AGH_INSTALL_URL" | sh -s -- -r
        log "$(_t "AdGuard Home installation complete" "AdGuard Home 安装完成")"
    else
        log "$(_t "Skipped AdGuard Home core install, keeping current version" "跳过 AdGuard Home 核心安装，保留当前版本")"
    fi
else
    log "$(_t "AdGuard Home not detected, installing from official script..." "未检测到 AdGuard Home，开始从官方脚本安装...")"
    curl -fsSL "$AGH_INSTALL_URL" | sh
    log "$(_t "AdGuard Home installation complete" "AdGuard Home 安装完成")"
fi

echo ""

# ═══════════════════════════════════════════════════════════
# Part 2: install the LuCI Dashboard management panel / 第二部分：安装 LuCI Dashboard 管理面板
# ═══════════════════════════════════════════════════════════

log "$(_t "── Part 2: LuCI Dashboard management panel ──" "── 第二部分：LuCI Dashboard 管理面板 ──")"

SCRIPT_DIR="$(cd "$(dirname "$0" 2>/dev/null && pwd)" 2>/dev/null || pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR" 2>/dev/null)"
LOCAL_FILES="$PROJECT_ROOT/files"

TMPDIR=$(mktemp -d)
DOWNLOAD_DIR="$TMPDIR/download"
mkdir -p "$DOWNLOAD_DIR/luci/controller" "$DOWNLOAD_DIR/luci/menu.d" "$DOWNLOAD_DIR/luci/i18n" "$DOWNLOAD_DIR/view"

download_from_github() {
    log "$(_t "Downloading Dashboard files from GitHub..." "从 GitHub 下载 Dashboard 文件...")"
    _cb=$(date +%s 2>/dev/null || echo 0)
    _gh_raw="https://raw.githubusercontent.com/${REPO}/${BRANCH}"

    dl() {
        local path="$1" dest="$2"
        local fname=$(basename "$dest")
        if curl -fsSL -m 30 --connect-timeout 10 --retry 1 \
            -o "$dest" "${RAW_BASE}/${path}?_cb=${_cb}" 2>/dev/null; then
            log "  ✓ $fname"
            return 0
        fi
        log "  ✗ $(_t "Download failed: $fname (connection '$CONNECTION_LABEL' unreachable)" "下载失败: $fname（连接 '$CONNECTION_LABEL' 不可达）")"
        return 1
    }
    _fail=0
    dl "files/luci/controller/adguardhome.lua"                     "$DOWNLOAD_DIR/luci/controller/adguardhome.lua" || _fail=1
    dl "files/luci/menu.d/luci-app-adguardhome-dashboard.json"     "$DOWNLOAD_DIR/luci/menu.d/luci-app-adguardhome-dashboard.json" || _fail=1
    dl "files/luci/acl.json"                                       "$DOWNLOAD_DIR/luci/acl.json" || _fail=1
    dl "files/view/dashboard.js"                                   "$DOWNLOAD_DIR/view/dashboard.js" || _fail=1
    dl "files/luci/i18n/adguardhome.lmo"                           "$DOWNLOAD_DIR/luci/i18n/adguardhome.lmo" || _fail=1
    dl "files/luci/i18n/adguardhome.zh-cn.lmo"                     "$DOWNLOAD_DIR/luci/i18n/adguardhome.zh-cn.lmo" || _fail=1
    dl "manifest.json"                                             "$DOWNLOAD_DIR/manifest.json" || _fail=1
    # checksums: use the selected connection only (no silent proxy hop)
    # 校验和清单：仅使用选定的连接（不静默跳代理）
    if curl -fsSL -m 30 --connect-timeout 10 --retry 1 \
        -o "$DOWNLOAD_DIR/checksums.sha256" "${RAW_BASE}/checksums.sha256?_cb=${_cb}" 2>/dev/null; then
        log "  ✓ checksums.sha256"
    else
        log "  $(_t "Warning: checksums.sha256 download failed via '$CONNECTION_LABEL', will use semantic feature check only" "警告: checksums.sha256 经 '$CONNECTION_LABEL' 下载失败，将仅做语义特征校验")"
    fi
    log "$(_t "All files downloaded" "所有文件下载完成")"
    return $_fail
}

# 固定使用所选连接下载；仅当该连接在下载中确实不可用时，才重新测试并交互让用户改选
# （重选会同步重新测连通性并把结果显示在交互界面）。
# FIXEDLY use the chosen connection; only if it proves unusable during download do we re-test
# and let the user re-pick (re-selection re-tests connectivity and shows the results).
do_github_download() {
    _re=0; _max_re=5
    while true; do
        if download_from_github; then return 0; fi
        _re=$((_re + 1))
        if [ "$_re" -ge "$_max_re" ]; then
            log "$(_t "Download failed after $_max_re connection attempts. Aborting." "已尝试 $_max_re 次连接仍下载失败，终止。")"
            rm -rf "$TMPDIR"; exit 1
        fi
        log "$(_t "Selected connection '$CONNECTION_LABEL' failed during download. Re-selecting a connection (re-testing connectivity)..." "所选连接 '$CONNECTION_LABEL' 在下载中失败，正在重新测试并选择连接...")"
        if ! gh_select_connection; then
            log "$(_t "No connection selected; aborting." "未选择连接，终止。")"
            rm -rf "$TMPDIR"; exit 1
        fi
    done
}

if [ -f "$LOCAL_FILES/luci/controller/adguardhome.lua" ]; then
    log "$(_t "Detected local project files ($PROJECT_ROOT)" "检测到本地项目文件 ($PROJECT_ROOT)")"
    echo ""
    echo "  1) $(_t "Install using local files" "使用本地文件安装")"
    echo "  2) $(_t "Delete local project then re-download from GitHub" "删除本地项目后从 GitHub 重新下载")"
    echo ""
    printf "$(_t "Select [1/2, default 1]: " "请选择 [1/2，默认 1]: ")"
    read -r SRC_CHOICE
    SRC_CHOICE=${SRC_CHOICE:-1}

    if [ "$SRC_CHOICE" = "2" ]; then
        log "$(_t "Deleting local project directory: $PROJECT_ROOT" "删除本地项目目录: $PROJECT_ROOT")"
        rm -rf "$PROJECT_ROOT"
        do_github_download
    else
        log "$(_t "Copying local files..." "使用本地文件复制...")"
        cp "$LOCAL_FILES/luci/controller/adguardhome.lua" "$DOWNLOAD_DIR/luci/controller/"
        cp "$LOCAL_FILES/luci/menu.d/luci-app-adguardhome-dashboard.json" "$DOWNLOAD_DIR/luci/menu.d/"
        cp "$LOCAL_FILES/luci/acl.json" "$DOWNLOAD_DIR/luci/"
        cp "$LOCAL_FILES/view/dashboard.js" "$DOWNLOAD_DIR/view/"
        cp "$LOCAL_FILES/luci/i18n/adguardhome.lmo" "$DOWNLOAD_DIR/luci/i18n/"
        cp "$LOCAL_FILES/luci/i18n/adguardhome.zh-cn.lmo" "$DOWNLOAD_DIR/luci/i18n/"
        cp "$PROJECT_ROOT/manifest.json" "$DOWNLOAD_DIR/manifest.json"
    fi
else
    do_github_download
fi

# ── Helper: compute sha256 (falls back to openssl where sha256sum is unavailable) ──
# 辅助：计算 sha256（兼容无 sha256sum 的环境降级到 openssl）
sha256_of() {
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$1" 2>/dev/null | awk '{print $1}'
    elif command -v openssl >/dev/null 2>&1; then
        openssl sha256 "$1" 2>/dev/null | awk '{print $NF}'
    fi
}

# ── Content verification: sha256 fingerprint (primary) + semantic feature (fallback) ──
# 内容校验：sha256 指纹（主） + 语义特征（兜底）
# Prevent proxies/CDNs from serving a cached old build (ghfast.top once cached an old dashboard.js, dropping the backup feature).
# 防止代理/CDN 返回缓存中的旧版本（曾因 ghfast.top 缓存旧 dashboard.js 导致备份管理缺失）。
# sha256 comparison blocks ANY content diverging from the release manifest (not limited to a missing feature);
# 若 checksums.sha256 不可用，则降级为语义特征校验（fetchBackups / list_backups）。
verify_one() {
    _src="$1"; _f="$2"
    _ok=1
    if [ -f "$DOWNLOAD_DIR/checksums.sha256" ]; then
        _exp=$(grep -F " $_src" "$DOWNLOAD_DIR/checksums.sha256" 2>/dev/null | awk '{print $1}' | head -n1)
        if [ -n "$_exp" ]; then
            _act=$(sha256_of "$_f")
            if [ -n "$_act" ] && [ "$_exp" != "$_act" ]; then
                log "  ✗ $(_t "sha256 mismatch: $_src" "sha256 不匹配: $_src")"
                log "    $(_t "expected: $_exp" "期望: $_exp")"
                log "    $(_t "actual:   $_act" "实际: $_act")"
                log "    → $(_t "likely a cached old build from proxy/CDN" "极可能是代理/CDN 缓存的旧版本")"
                _ok=0
            fi
        fi
    fi
    case "$_src" in
        files/view/dashboard.js)
            grep -q 'fetchBackups' "$_f" 2>/dev/null || { log "  ✗ $(_t "dashboard.js missing backup feature (cached old build?)" "dashboard.js 缺少备份管理功能（代理缓存旧版？）")"; _ok=0; } ;;
        files/luci/controller/adguardhome.lua)
            grep -q 'list_backups' "$_f" 2>/dev/null || { log "  ✗ $(_t "adguardhome.lua missing backup API (cached old build?)" "adguardhome.lua 缺少备份 API（代理缓存旧版？）")"; _ok=0; } ;;
        manifest.json)
            grep -q '"version"' "$_f" 2>/dev/null || { log "  ✗ $(_t "manifest.json missing version field (cached old build?)" "manifest.json 缺少 version 字段（代理缓存旧版？）")"; _ok=0; } ;;
    esac
    # _ok=1 means pass, _ok=0 means fail; shell return 0=success, 1=failure, so invert: pass->0, fail->1.
    # _ok=1 表示通过、_ok=0 表示失败；但 shell 中 return 0=成功、return 1=失败，故需取反：通过→0，失败→1。
    # Never use `return $_ok` directly (it would mark valid files as failed and let bad files through).
    # 切勿直接 `return $_ok`（会导致合法文件被判失败、坏文件被放行）。
    return $((1 - $_ok))
}

log "$(_t "Verifying downloaded files (sha256 fingerprint + semantic features, to block proxy-cached old builds)..." "校验下载文件内容（sha256 指纹 + 语义特征，防止代理缓存旧版本）...")"
_fail=0
verify_one "files/luci/controller/adguardhome.lua"                  "$DOWNLOAD_DIR/luci/controller/adguardhome.lua" || _fail=1
verify_one "files/luci/menu.d/luci-app-adguardhome-dashboard.json" "$DOWNLOAD_DIR/luci/menu.d/luci-app-adguardhome-dashboard.json" || _fail=1
verify_one "files/luci/acl.json"                                    "$DOWNLOAD_DIR/luci/acl.json" || _fail=1
verify_one "files/view/dashboard.js"                                "$DOWNLOAD_DIR/view/dashboard.js" || _fail=1
verify_one "files/luci/i18n/adguardhome.lmo"                        "$DOWNLOAD_DIR/luci/i18n/adguardhome.lmo" || _fail=1
verify_one "files/luci/i18n/adguardhome.zh-cn.lmo"                 "$DOWNLOAD_DIR/luci/i18n/adguardhome.zh-cn.lmo" || _fail=1
verify_one "manifest.json"                                          "$DOWNLOAD_DIR/manifest.json" || _fail=1
if [ "$_fail" = "1" ]; then
    log "$(_t "Content verification failed (likely proxy/CDN cached an old build); re-downloading via direct and re-verifying..." "内容校验失败，疑似代理/CDN 缓存了旧版本，正在改用直连重新下载并复验...")"
    _cb=$(date +%s 2>/dev/null || echo 0)
    # re-fetch checksums via direct (authoritative) / 直连重新拉取校验和清单（权威、无缓存）
    curl -fsSL -m 30 --connect-timeout 10 --retry 2 \
        -o "$DOWNLOAD_DIR/checksums.sha256" "${_gh_raw}/checksums.sha256?_cb=${_cb}" 2>/dev/null \
        || log "  $(_t "Warning: direct re-fetch of checksums.sha256 failed, re-verifying with the original file" "警告: 直连拉取 checksums.sha256 失败，仍用原文件复验")"
    # re-fetch all files via direct (bypass proxy cache) / 直连重新拉取全部文件（排除代理/CDN 缓存）
    for _line in \
        "files/luci/controller/adguardhome.lua|$DOWNLOAD_DIR/luci/controller/adguardhome.lua" \
        "files/luci/menu.d/luci-app-adguardhome-dashboard.json|$DOWNLOAD_DIR/luci/menu.d/luci-app-adguardhome-dashboard.json" \
        "files/luci/acl.json|$DOWNLOAD_DIR/luci/acl.json" \
        "files/view/dashboard.js|$DOWNLOAD_DIR/view/dashboard.js" \
        "files/luci/i18n/adguardhome.lmo|$DOWNLOAD_DIR/luci/i18n/adguardhome.lmo" \
        "files/luci/i18n/adguardhome.zh-cn.lmo|$DOWNLOAD_DIR/luci/i18n/adguardhome.zh-cn.lmo" \
        "manifest.json|$DOWNLOAD_DIR/manifest.json" ; do
        _fp=${_line%%|*}; _fd=${_line##*|}
        if curl -fsSL -m 30 --connect-timeout 10 --retry 2 \
            -o "$_fd" "${_gh_raw}/${_fp}?_cb=${_cb}" 2>/dev/null; then
            log "  ↻ $(_t "re-downloaded via direct: $(basename "$_fd")" "已用直连重新下载: $(basename "$_fd")")"
        else
            log "  $(_t "Warning: direct re-download failed (kept original): $(basename "$_fd")" "警告: 直连重新下载失败（保留原文件）: $(basename "$_fd")")"
        fi
    done
    # re-verify / 复验
    _fail=0
    verify_one "files/luci/controller/adguardhome.lua"                  "$DOWNLOAD_DIR/luci/controller/adguardhome.lua" || _fail=1
    verify_one "files/luci/menu.d/luci-app-adguardhome-dashboard.json" "$DOWNLOAD_DIR/luci/menu.d/luci-app-adguardhome-dashboard.json" || _fail=1
    verify_one "files/luci/acl.json"                                    "$DOWNLOAD_DIR/luci/acl.json" || _fail=1
    verify_one "files/view/dashboard.js"                                "$DOWNLOAD_DIR/view/dashboard.js" || _fail=1
    verify_one "files/luci/i18n/adguardhome.lmo"                        "$DOWNLOAD_DIR/luci/i18n/adguardhome.lmo" || _fail=1
    verify_one "files/luci/i18n/adguardhome.zh-cn.lmo"                 "$DOWNLOAD_DIR/luci/i18n/adguardhome.zh-cn.lmo" || _fail=1
    verify_one "manifest.json"                                          "$DOWNLOAD_DIR/manifest.json" || _fail=1
    if [ "$_fail" = "1" ]; then
        log "$(_t "Content verification failed: direct re-verification still did not pass" "内容校验失败：直连复验仍未通过")"
        log "$(_t "Fix: check your network and retry; or manually download the release package from https://github.com/${REPO}" "解决: 请检查网络后重试；或手动从 https://github.com/${REPO} 下载发布包安装")"
        rm -rf "$TMPDIR"
        exit 1
    fi
    log "  ✓ $(_t "Passed direct re-verification (proxy/CDN cached old build excluded)" "已通过直连复验（已排除代理/CDN 缓存的旧版本）")"
fi
log "  ✓ $(_t "Content verification passed (sha256 fingerprint + semantic features)" "内容校验通过（sha256 指纹 + 语义特征）")"

# ── Back up currently-installed files (kept consistent with the panel-upgrade two-phase commit) ──
# 备份当前安装的文件（与面板升级的两阶段提交保持一致）
TS=$(date '+%Y%m%d_%H%M%S' 2>/dev/null || date +%s 2>/dev/null || echo 0)
BACKUP_DIR="/root/agh_backup_install_${TS}"

# Backup targets: the existing files that map exactly to the cleanup/deploy below
# 备份目标：与下面清理/部署完全对应的现有文件
BACKUP_PAIRS="
/usr/lib/lua/luci/controller/adguardhome.lua|controller/adguardhome.lua
/usr/share/luci/menu.d/luci-app-adguardhome-dashboard.json|menu.d/luci-app-adguardhome-dashboard.json
/usr/share/rpcd/acl.d/luci-app-adguardhome-dashboard.json|acl.d/luci-app-adguardhome-dashboard.json
/usr/lib/lua/luci/i18n/adguardhome.lmo|i18n/adguardhome.lmo
/usr/lib/lua/luci/i18n/adguardhome.zh-cn.lmo|i18n/adguardhome.zh-cn.lmo
/www/luci-static/resources/view/adguardhome/dashboard.js|view/adguardhome/dashboard.js
/usr/share/adguardhome-dashboard/manifest.json|adguardhome-dashboard/manifest.json
"

_backup_count=0
for pair in $BACKUP_PAIRS; do
    src=$(echo "$pair" | cut -d'|' -f1)
    rel=$(echo "$pair" | cut -d'|' -f2)
    if [ -f "$src" ]; then
        mkdir -p "$BACKUP_DIR/$(dirname "$rel")"
        cp -a "$src" "$BACKUP_DIR/$rel" 2>/dev/null || cp "$src" "$BACKUP_DIR/$rel"
        _backup_count=$((_backup_count + 1))
        log "  $(_t "backed up: $src  ->  $BACKUP_DIR/$rel" "备份: $src  ->  $BACKUP_DIR/$rel")"
    fi
done

# Note: install does NOT back up the AdGuardHome core binary; core rollback is handled separately by AGH's official script and the core-upgrade flow
# 注意：install 不备份 AdGuardHome 核心二进制，核心安装/升级的回滚由 AGH 官方安装脚本和核心升级流程单独管理

if [ "$_backup_count" -gt 0 ]; then
    log "$(_t "Reinstall detected: backed up $_backup_count existing panel file(s) to: $BACKUP_DIR" "检测到非首次安装：已备份 $_backup_count 个现有面板文件至: $BACKUP_DIR")"

    # Generate restore.sh: one-click restore to the pre-install state (panel files only, no AGH core)
    # 生成 restore.sh：用户可一键恢复到本次安装前的状态（仅面板文件，不含 AGH 核心）
    cat > "$BACKUP_DIR/restore.sh" <<EOF
#!/bin/sh
# One-click restore of the LuCI Dashboard to its pre-install state / 一键恢复 LuCI Dashboard 到安装前的状态
# Backup dir: $BACKUP_DIR / 备份目录: $BACKUP_DIR
# Restore panel files only; does not touch the AdGuardHome core binary / 仅恢复面板文件，不涉及 AdGuardHome 核心二进制
set -u
BACKUP_DIR='$BACKUP_DIR'

restore_one() {
    r_rel="\$1"
    r_dst="\$2"
    r_src="\$BACKUP_DIR/\$r_rel"
    if [ -f "\$r_src" ]; then
        mkdir -p "\$(dirname "\$r_dst")"
        cp -a "\$r_src" "\$r_dst" 2>/dev/null || cp "\$r_src" "\$r_dst"
        chmod 644 "\$r_dst" 2>/dev/null
        echo "  restored: \$r_dst"
    else
        echo "  (skip) no backup: \$r_rel"
    fi
}

echo "=== Restoring LuCI Dashboard from \$BACKUP_DIR ==="

echo ">> Restoring panel files..."
restore_one 'controller/adguardhome.lua'                                   '/usr/lib/lua/luci/controller/adguardhome.lua'
restore_one 'menu.d/luci-app-adguardhome-dashboard.json'                  '/usr/share/luci/menu.d/luci-app-adguardhome-dashboard.json'
restore_one 'acl.d/luci-app-adguardhome-dashboard.json'                   '/usr/share/rpcd/acl.d/luci-app-adguardhome-dashboard.json'
restore_one 'i18n/adguardhome.lmo'                                         '/usr/lib/lua/luci/i18n/adguardhome.lmo'
restore_one 'i18n/adguardhome.zh-cn.lmo'                                   '/usr/lib/lua/luci/i18n/adguardhome.zh-cn.lmo'
restore_one 'view/adguardhome/dashboard.js'                                '/www/luci-static/resources/view/adguardhome/dashboard.js'
restore_one 'adguardhome-dashboard/manifest.json'                      '/usr/share/adguardhome-dashboard/manifest.json'

echo ">> Clearing cache and restarting services..."
rm -rf /tmp/luci-* 2>/dev/null
rm -f /tmp/luci-indexcache.* /tmp/luci-modulecache.* 2>/dev/null
find /tmp -name '*.luac' -delete 2>/dev/null
/etc/init.d/rpcd restart 2>/dev/null
/etc/init.d/uhttpd restart 2>/dev/null

echo "=== Restore complete (panel files only; AGH core untouched) ==="
echo "Please refresh your browser to see the changes."
EOF
    chmod 755 "$BACKUP_DIR/restore.sh" 2>/dev/null
    log "$(_t "Restore script generated: $BACKUP_DIR/restore.sh" "恢复脚本已生成: $BACKUP_DIR/restore.sh")"
else
    log "$(_t "Fresh install detected: no existing panel files to back up" "本次安装为全新部署，无旧文件可备份")"
fi

# ── Clean up old-version files ── / 清理旧版本文件
log "$(_t "Cleaning old-version files..." "清理旧版本文件...")"
rm -f /usr/lib/lua/luci/controller/adguardhome.lua
rm -f /usr/share/luci/controller/adguardhome.lua
rm -rf /usr/lib/lua/luci/view/adguardhome
rm -rf /www/luci-static/resources/view/adguardhome
rm -f /usr/share/luci/menu.d/luci-app-adguardhome-dashboard.json
rm -f /usr/share/luci/menu.d/luci-app-adguardhome.json
rm -f /usr/share/rpcd/acl.d/luci-app-adguardhome.json
rm -f /usr/share/rpcd/acl.d/luci-app-adguardhome-dashboard.json
rm -f /usr/lib/lua/luci/i18n/adguardhome.lmo
rm -f /usr/lib/lua/luci/i18n/adguardhome.zh-cn.lmo

# ── Create target directories ── / 创建目标目录
mkdir -p /usr/lib/lua/luci/controller
mkdir -p /usr/share/luci/menu.d
mkdir -p /usr/share/rpcd/acl.d
mkdir -p /usr/lib/lua/luci/i18n
mkdir -p /www/luci-static/resources/view/adguardhome
mkdir -p /usr/share/adguardhome-dashboard

# ── Deploy files ── / 部署文件
log "$(_t "Deploying files to system directories..." "部署文件到系统目录...")"
cp "$DOWNLOAD_DIR/luci/controller/adguardhome.lua"                     /usr/lib/lua/luci/controller/adguardhome.lua
cp "$DOWNLOAD_DIR/luci/menu.d/luci-app-adguardhome-dashboard.json"     /usr/share/luci/menu.d/
cp "$DOWNLOAD_DIR/luci/acl.json"                                       /usr/share/rpcd/acl.d/luci-app-adguardhome-dashboard.json
cp "$DOWNLOAD_DIR/view/dashboard.js"                                   /www/luci-static/resources/view/adguardhome/dashboard.js
cp "$DOWNLOAD_DIR/luci/i18n/adguardhome.lmo"                           /usr/lib/lua/luci/i18n/
cp "$DOWNLOAD_DIR/luci/i18n/adguardhome.zh-cn.lmo"                     /usr/lib/lua/luci/i18n/
cp "$DOWNLOAD_DIR/manifest.json"                                       /usr/share/adguardhome-dashboard/manifest.json

# ── Set permissions ── / 设置权限
chmod 644 /usr/lib/lua/luci/controller/adguardhome.lua \
          /usr/share/luci/menu.d/luci-app-adguardhome-dashboard.json \
          /usr/share/rpcd/acl.d/luci-app-adguardhome-dashboard.json \
          /usr/lib/lua/luci/i18n/adguardhome.lmo \
          /usr/lib/lua/luci/i18n/adguardhome.zh-cn.lmo \
          /usr/share/adguardhome-dashboard/manifest.json \
          /www/luci-static/resources/view/adguardhome/dashboard.js

# ── Clear cache & restart services ── / 清除缓存 & 重启服务
log "$(_t "Clearing LuCI cache and restarting services..." "清除 LuCI 缓存并重启服务...")"
rm -rf /tmp/luci-* 2>/dev/null || true
rm -rf /tmp/luci-indexcache.* /tmp/luci-modulecache.* 2>/dev/null || true
find /tmp -name '*.luac' -delete 2>/dev/null || true
/etc/init.d/rpcd restart 2>/dev/null || true
/etc/init.d/uhttpd restart 2>/dev/null || true

# ── Deployment verification ── / 部署验证
log "$(_t "Verifying deployed files..." "验证部署文件...")"
if grep -q 'loadc' /usr/lib/lua/luci/controller/adguardhome.lua 2>/dev/null; then
    log "$(_t "Warning: controller.lua still contains old code (i18n.loadc)" "⚠ 警告: controller.lua 仍包含旧代码 (i18n.loadc)")"
    log "  $(_t "Possibly GitHub CDN cache not refreshed. Try:" "可能是 GitHub CDN 缓存未刷新，请尝试以下方法:")"
    log "  1) $(_t "wait a few minutes then re-run the installer" "等待几分钟后重新运行安装")"
    log "  2) $(_t "use a proxy: GITHUB_PROXY=https://ghfast.top/ sh install.sh" "使用代理: GITHUB_PROXY=https://ghfast.top/ sh install.sh")"
    log "  3) $(_t "verify manually: curl -fsSL '${RAW_BASE}/files/luci/controller/adguardhome.lua' | grep loadc" "手动验证: curl -fsSL '${RAW_BASE}/files/luci/controller/adguardhome.lua' | grep loadc")"
else
    log "  ✓ $(_t "controller.lua verified" "controller.lua 验证通过")"
fi
if grep -q 'fetchBackups' /www/luci-static/resources/view/adguardhome/dashboard.js 2>/dev/null; then
    log "  ✓ $(_t "dashboard.js verified (includes backup management)" "dashboard.js 验证通过（含备份管理）")"
else
    log "$(_t "Warning: dashboard.js missing backup management (possibly a cached old build)" "⚠ 警告: dashboard.js 缺少备份管理功能（可能是代理缓存的旧版本）")"
    log "  $(_t "Re-pull manually: curl -fsSL '${RAW_BASE}/files/view/dashboard.js' -o /www/luci-static/resources/view/adguardhome/dashboard.js" "手动重拉: curl -fsSL '${RAW_BASE}/files/view/dashboard.js' -o /www/luci-static/resources/view/adguardhome/dashboard.js")"
fi
if [ -f /usr/share/adguardhome-dashboard/manifest.json ] && grep -q '"version"' /usr/share/adguardhome-dashboard/manifest.json 2>/dev/null; then
    log "  ✓ $(_t "manifest.json verified" "manifest.json 验证通过")"
else
    log "$(_t "Warning: manifest.json not deployed or missing version field" "⚠ 警告: manifest.json 未部署或缺少 version 字段")"
fi

rm -rf "$TMPDIR"

echo ""
echo "========================================================="
echo " $(_t "Installation complete!" "安装完成！")"
echo ""
echo " $(_t "AdGuard Home core:" "AdGuard Home 核心:")"
[ -f "$AGH_BIN" ] && echo "   ✓ $AGH_BIN" || echo "   ✗ $(_t "not installed" "未安装")"
echo ""
echo " $(_t "LuCI Dashboard:" "LuCI Dashboard:")"
echo "   Controller:  /usr/lib/lua/luci/controller/adguardhome.lua"
echo "   Menu:        /usr/share/luci/menu.d/luci-app-adguardhome-dashboard.json"
echo "   ACL:         /usr/share/rpcd/acl.d/luci-app-adguardhome-dashboard.json"
echo "   JS View:     /www/luci-static/resources/view/adguardhome/dashboard.js"
echo "   i18n (en):   /usr/lib/lua/luci/i18n/adguardhome.lmo"
echo "   i18n (zh):   /usr/lib/lua/luci/i18n/adguardhome.zh-cn.lmo"
echo ""
if [ "$_backup_count" -gt 0 ] 2>/dev/null; then
    echo " $(_t "Backup info:" "备份信息:")"
    echo "   $(_t "Backup dir:   " "备份目录:   ")$BACKUP_DIR"
    echo "   $(_t "Backup files: " "备份文件数: ")$_backup_count"
    echo "   $(_t "Restore script:" "恢复脚本:   ")$BACKUP_DIR/restore.sh"
    echo ""
    echo "   $(_t "To restore to the pre-install state:" "恢复到安装前状态:")"
    echo "     sh $BACKUP_DIR/restore.sh"
    echo ""
    echo "   $(_t "Or via panel → Services → AdGuard Home → Backup Management" "或在面板 → 服务 → AdGuard Home → 备份管理 中操作")"
fi
echo ""
echo " $(_t "Please refresh your browser → LuCI → Services → AdGuard Home" "请刷新浏览器 → LuCI → 服务 → AdGuard Home")"
echo "========================================================="
