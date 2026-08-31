module("luci.controller.adguardhome", package.seeall)

local util = require "luci.util"
local fs = require "nixio.fs"
local http = require "luci.http"

local BIN_PATHS = {
    "/opt/AdGuardHome/AdGuardHome",
    "/usr/bin/AdGuardHome",
    "/usr/local/bin/AdGuardHome"
}

local INIT_SCRIPTS = {
    "/etc/init.d/AdGuardHome",
    "/etc/init.d/adguardhome"
}

local CONFIG_PATHS = {
    "/opt/AdGuardHome/AdGuardHome.yaml",
    "/etc/AdGuardHome.yaml",
    "/etc/adguardhome/adguardhome.yaml"
}

-- 统一运行时日志路径（挂载于 /tmp tmpfs 内存文件系统） / Unified runtime log path (mounted on /tmp tmpfs in-memory fs)
local EXEC_LOG = "/tmp/agh_exec.log"
local PROXY_CONF = "/etc/adguardhome-dashboard.proxy"
local DASHBOARD_VERSION = "2.5.0"   -- 兜底默认值：仅当本地 manifest.json 缺失（老版本升级前）时使用
local DASH_REPO = "imonior/luci-app-adguardhome-dashboard"
local DASH_BRANCH = "main"
-- 已安装版本统一从本地部署的 manifest.json 读取（单一数据源，避免与 manifest 漂移）； / Installed version is read from the locally-deployed manifest.json (single source of truth, avoids drift from the manifest);
-- 本地文件缺失时（老版本未部署 manifest）回落到 DASHBOARD_VERSION 常量。 / Falls back to the DASHBOARD_VERSION constant when the local file is missing (older versions without a deployed manifest).
local MANIFEST_LOCAL = "/usr/share/adguardhome-dashboard/manifest.json"
local function get_installed_version()
    local c = util.exec("cat " .. MANIFEST_LOCAL .. " 2>/dev/null")
    if c and #c > 0 then
        local v = c:match('"version"%s*:%s*"([^"]+)"')
        if v and #v > 0 then return v end
    end
    return DASHBOARD_VERSION
end

-- 面板文件清单 / Dashboard file manifest
local DASH_FILES = {
    { src = "files/view/dashboard.js",                  dst = "/www/luci-static/resources/view/adguardhome/dashboard.js", base = "dashboard.js", kind = "js",  min_size = 10000 },
    { src = "files/luci/i18n/adguardhome.po",           dst = "/usr/lib/lua/luci/i18n/adguardhome.po",           base = "adguardhome.po",        kind = "po",  min_size = 500 },
    { src = "files/luci/i18n/adguardhome.zh-cn.po",     dst = "/usr/lib/lua/luci/i18n/adguardhome.zh-cn.po",     base = "adguardhome.zh-cn.po",  kind = "po",  min_size = 500 },
    { src = "files/luci/i18n/adguardhome.lmo",           dst = "/usr/lib/lua/luci/i18n/adguardhome.lmo",           base = "adguardhome.lmo",       kind = "lmo", min_size = 100 },
    { src = "files/luci/i18n/adguardhome.zh-cn.lmo",     dst = "/usr/lib/lua/luci/i18n/adguardhome.zh-cn.lmo",     base = "adguardhome.zh-cn.lmo", kind = "lmo", min_size = 100 },
    { src = "files/luci/controller/adguardhome.lua",    dst = "/usr/lib/lua/luci/controller/adguardhome.lua",    base = "adguardhome.lua",       kind = "lua", min_size = 5000 },
    { src = "manifest.json",                            dst = "/usr/share/adguardhome-dashboard/manifest.json",  base = "manifest.json",          kind = "json", min_size = 20 }
}

local PRIMARY_PROXY = ""
local PROXY_LIST = {}

local function get_persisted_proxy()
    if fs.access(PROXY_CONF) then
        local content = fs.readfile(PROXY_CONF) or ""
        local saved = content:match("proxy%s*=%s*(%S*)")
        if saved then return saved end
    end
    return ""
end

local function load_proxies()
    -- 严格遵守 UI 中的代理选择：只使用用户持久化的代理，不再无条件追加内置代理。
    -- Strictly honor the UI proxy selection: only use the persisted proxy; do NOT
    -- unconditionally append built-in proxies.
    --   - 选择 direct(空)  → 仅直连，不使用任何代理
    --   - 指定某代理       → 仅该代理（下载循环另含直连兜底），不使用其他未选代理
    -- 此前无论选什么都会把 3 个内置代理塞进候选列表，导致选 direct 时后台仍走代理。
    -- Previously all 3 built-in proxies were always appended, so even "direct" used proxies.
    PRIMARY_PROXY = get_persisted_proxy()
    PROXY_LIST = {}
    if PRIMARY_PROXY ~= "" then
        PROXY_LIST[#PROXY_LIST + 1] = PRIMARY_PROXY
    end
end

-- 解析本次请求实际使用的代理：优先采用 UI 实时选择（请求携带的 proxy 参数），
-- 否则回退到持久化代理（install 写入 /etc/adguardhome-dashboard.proxy）。
-- Resolve the effective proxy for THIS request: prefer the UI selection carried in the
-- request, else fall back to the persisted proxy. Honors "切换代理实时生效" (immediate effect).
local function resolve_proxy()
    local p = http.formvalue("proxy")
    if p and is_safe_proxy(p) then
        PRIMARY_PROXY = p
        PROXY_LIST = { p }
        return
    end
    load_proxies()
end

-- 当指向一个文件路径时，try_with_proxies 会把每次探测尝试写入该日志（仅 check 端点使用，
-- 用于在前端日志查看器里展示"测试过程"）。/ When set to a file path, try_with_proxies logs
-- each attempt to it (used only by check endpoints, to show the test process in the log viewer).
local TRY_LOG = nil

local function is_safe_proxy(p)
    if p == nil then return false end
    if p == "" then return true end
    if p:match("['\"`$;|&()<>%s\\]") then return false end
    if not p:match("^https?://[%w%.%-/_:]+$") then return false end
    return true
end

-- 把代理前缀规范化为「以 / 结尾」，避免用户漏写结尾斜杠导致拼接出非法 URL
-- （如 https://ghfast.tophttps://...）。用于代理测试与版本/升级下载。
-- Normalize a proxy prefix to end with '/', so a missing trailing slash can't produce
-- an invalid concatenated URL (e.g. https://ghfast.tophttps://...). Used by proxy_test and try_with_proxies.
local function proxify(p, url)
    if p == nil or p == "" then return url end
    if p:sub(-1) == "/" then return p .. url end
    return p .. "/" .. url
end

local function try_with_proxies(url, expect_json)
    local expect = expect_json or false   -- true = 必须是合法 JSON（非 HTML/404 页）
    local tried = {}
    local function attempt(target, timeout)
        if TRY_LOG then
            util.exec("echo '  trying: " .. target .. "' >> " .. TRY_LOG)
        end
        local out = util.exec("curl -m " .. timeout .. " -fsSL '" .. target .. "' 2>/dev/null")
        if not out or #out < 10 then return nil end
        -- 过滤掉 GitHub 返回的 403/404 HTML 错误页（curl -f 应该拦截但某些代理会篡改响应码） / Drop 403/404 HTML error pages returned by GitHub (curl -f should block these, but some proxies tamper with the status code)
        if out:find("^<!DOCTYPE HTML", 1, true)
            or out:find("^<!doctype html", 1, true)
            or out:find("^<html", 1, true)
            or out:find("<title>403</title>", 1, true)
            or out:find("<title>404</title>", 1, true) then
            return nil
        end
        if expect then
            -- JSON 健壮性：以 { 或 [ 开头，至少包含一个 "key" : 形式或纯数组内容 / JSON robustness: must start with { or [ and contain at least one "key": pair or be a pure array
            local s = out:gsub("^%s+", ""):gsub("%s+$", "")
            if not (s:sub(1, 1) == '{' or s:sub(1, 1) == '[') then return nil end
        end
        return out
    end
    -- 严格使用用户选定的代理：选中某代理则只走该代理，选中直连(direct/空)则只走直连，
    -- 不再静默回退到直连或其它代理（避免“已选定的 proxy 自己跳”）。
    -- 失败时返回空串，由调用方（check/upgrade 端点）明确报错，用户可改选代理重试。
    if PRIMARY_PROXY ~= "" then
        local r = attempt(proxify(PRIMARY_PROXY, url), 10)
        if r then return r end
        return ""
    end
    local r = attempt(url, 5)
    if r then return r end
    return ""
end

local function find_binary()
    for _, p in ipairs(BIN_PATHS) do
        if fs.access(p, 'r') then
            return p
        end
    end
    local which_out = util.exec("which AdGuardHome 2>/dev/null")
    which_out = which_out and which_out:gsub("^%s+", ""):gsub("%s+$", "") or ""
    if which_out ~= "" and fs.access(which_out, 'r') then
        return which_out
    end
    return nil
end

local function find_init_script()
    for _, p in ipairs(INIT_SCRIPTS) do
        if fs.access(p) then
            return p
        end
    end
    return nil
end

function index()
    entry({"admin", "services", "adguardhome", "status"}, call("get_status"), nil, true)
    entry({"admin", "services", "adguardhome", "action"}, call("do_action"), nil, true)
    entry({"admin", "services", "adguardhome", "set_proxy"}, call("set_proxy"), nil, true)
    entry({"admin", "services", "adguardhome", "proxy_test"}, call("proxy_test"), nil, true)
    entry({"admin", "services", "adguardhome", "check_update"}, call("check_update"), nil, true)
    entry({"admin", "services", "adguardhome", "upgrade"}, call("do_upgrade"), nil, true)
    entry({"admin", "services", "adguardhome", "check_dashboard_update"}, call("check_dashboard_update"), nil, true)
    entry({"admin", "services", "adguardhome", "upgrade_dashboard"}, call("do_upgrade_dashboard"), nil, true)
    entry({"admin", "services", "adguardhome", "backups"}, call("list_backups"), nil, true)
    entry({"admin", "services", "adguardhome", "restore_backup"}, call("restore_backup"), nil, true)
    entry({"admin", "services", "adguardhome", "delete_backup"}, call("delete_backup"), nil, true)
    entry({"admin", "services", "adguardhome", "log"}, call("get_log"), nil, true)
    entry({"admin", "services", "adguardhome", "clear_log"}, call("clear_log"), nil, true)
end

function get_status()
    local status = {
        installed = false,
        service_installed = false,
        running = false,
        pid = nil,
        version = "",
        port = 3000,
        bin_path = "",
        init_script = "",
        proxy = "",
        dashboard_version = get_installed_version()
    }

    status.proxy = get_persisted_proxy()

    local bin_path = find_binary()
    local init_script = find_init_script()

    status.installed = bin_path ~= nil
    status.service_installed = init_script ~= nil
    status.bin_path = bin_path or ""
    status.init_script = init_script or ""

    local pid_out = util.exec("pgrep -f 'AdGuardHome' 2>/dev/null")
    local pid = pid_out and pid_out:match("(%d+)") or nil
    if pid then
        status.running = true
        status.pid = tonumber(pid)
    elseif init_script then
        local svc_out = util.exec(init_script .. " status 2>&1")
        if svc_out and svc_out:match("[Rr]unning") then
            status.running = true
        end
    end

    if bin_path then
        local ver = util.exec(bin_path .. " --version 2>&1")
        if ver then
            local v = ver:match("version v?([%d%.]+)")
            if not v then v = ver:match("([%d%.]+)") end
            if v then status.version = "v" .. v end
        end
    end

    for _, p in ipairs(CONFIG_PATHS) do
        if fs.access(p) then
            local content = fs.readfile(p)
            if content then
                local port = content:match("bind_port:%s*(%d+)")
                if not port then
                    -- 匹配 IPv4 + 端口 (0.0.0.0:3000 / 127.0.0.1:3000) / Match IPv4 + port (0.0.0.0:3000 / 127.0.0.1:3000)
                    port = content:match("http:.-address:%s*[%d%.]+:(%d+)")
                end
                if not port then
                    -- 匹配 IPv6 + 端口 ([::]:3000 / [::1]:3000 / [fd00::1]:3000) / Match IPv6 + port ([::]:3000 / [::1]:3000 / [fd00::1]:3000)
                    port = content:match("http:.-address:%s*%[[%x:]-%]:(%d+)")
                end
                if not port then
                    -- 匹配无 IP，只写端口的情况 (:3000) / Match the no-IP, port-only case (:3000)
                    port = content:match("http:.-address:%s*:(%d+)")
                end
                if port then
                    status.port = tonumber(port)
                    break
                end
            end
        end
    end

    http.prepare_content("application/json")
    http.write_json(status)
end

local function post_value(key)
    local val = http.formvalue(key)
    if val and val ~= "" then return val end
    local content_type = http.getenv("CONTENT_TYPE") or ""
    if content_type:match("json") then
        local body = http.content()
        if body then
            local v = body:match('"' .. key .. '"%s*:%s*"(.-)"')
            if v then return v end
            v = body:match('"' .. key .. '"%s*:%s*(%d+)')
            if v then return v end
        end
    end
    return nil
end

function do_action()
    local action = post_value("action")

    if action ~= "start" and action ~= "stop" and action ~= "restart" and action ~= "install_service" and action ~= "install_core" then
        http.prepare_content("application/json")
        http.write_json({ success = false, error = "invalid action" })
        return
    end

    if action == "install_core" then
        load_proxies()
        launch_core_upgrade(true)
        http.prepare_content("application/json")
        http.write_json({ success = true })
        return
    end

    local bin_path = find_binary()
    local init_script = find_init_script()
    local cmd

    if action == "install_service" then
        if bin_path then
            cmd = bin_path .. " -s install"
        else
            http.prepare_content("application/json")
            http.write_json({ success = false, error = "binary not found" })
            return
        end
    else
        if init_script then
            cmd = init_script .. " " .. action
        elseif bin_path then
            cmd = bin_path .. " -s " .. action
        else
            http.prepare_content("application/json")
            http.write_json({ success = false, error = "no init script or binary found" })
            return
        end
    end

    local time_str = os.date("%Y-%m-%d %H:%M:%S")
    -- 单次同步动作重置清空日志文件（>），并将运行标准输出重定向回日志 / Single sync action truncates the log file (>) and redirects stdout back into the log
    util.exec("echo '[" .. time_str .. "] Executing action: " .. action .. "' > " .. EXEC_LOG)
    local result = util.exec(cmd .. " 2>&1 | tee -a " .. EXEC_LOG)
    
    http.prepare_content("application/json")
    http.write_json({ success = true, output = result })
end

-- 从 AGH 的 CHANGELOG.md（raw.githubusercontent.com 上的同一 host，与面板版本检查一致）
-- 解析最新「已发布」版本号。跳过 [Unreleased] 与 HTML 注释块（注释里放的是未来预发布版本）。
-- Parse the latest *released* version from AGH's CHANGELOG.md (same host as the dashboard
-- check, so it works on the same connections). Skips [Unreleased] and HTML comment blocks
-- (which hold future/unreleased version headings).
local function parse_agh_version_from_changelog(text)
    if not text or #text == 0 then return "" end
    local in_comment = false
    for line in text:gmatch("([^\n]*)\n?") do
        if in_comment then
            if line:find("-->", 1, true) then in_comment = false end
        else
            if line:find("<!--", 1, true) then
                -- 同行业关闭则不算进入注释块 / if it also closes on the same line, stay out
                if not line:find("-->", 1, true) then in_comment = true end
            else
                local v = line:match("^##%s*%[(v?[%d]+%.[%d]+%.[%d]+)%]")
                if v then return v end
            end
        end
    end
    return ""
end

function check_update()
    resolve_proxy()
    local time_str = os.date("%Y-%m-%d %H:%M:%S")
    local pinfo = (PRIMARY_PROXY ~= "") and PRIMARY_PROXY or "direct"
    TRY_LOG = EXEC_LOG
    util.exec("echo '[" .. time_str .. "] Check AdGuardHome update (proxy=" .. pinfo .. ")' > " .. EXEC_LOG)

    local latest = ""

    -- 优先：GitHub API（结构化、准确；适用于 api.github.com 可达的网络）
    -- Primary: GitHub API (structured, accurate; for networks where api.github.com is reachable)
    local out_api = try_with_proxies("https://api.github.com/repos/AdguardTeam/AdGuardHome/releases/latest", true)
    if out_api and #out_api > 0 then
        latest = out_api:match('"tag_name"%s*:%s*"(.-)"') or ""
    end

    -- 回退：raw.githubusercontent.com 上的 CHANGELOG.md（适用于 api.github.com 被墙、但 raw 可达的网络，
    -- 与面板版本检查走同一 host，体验一致）/ Fallback: CHANGELOG.md on raw.githubusercontent.com
    -- (for networks where api.github.com is blocked but raw is reachable, same host as the dashboard check)
    if latest == "" then
        local out_cl = try_with_proxies("https://raw.githubusercontent.com/AdguardTeam/AdGuardHome/master/CHANGELOG.md", false)
        if out_cl and #out_cl > 0 then
            latest = parse_agh_version_from_changelog(out_cl)
        end
    end

    TRY_LOG = nil
    if latest == "" then
        util.exec("echo '  result: fetch failed (no reachable connection returned valid version)' >> " .. EXEC_LOG)
    else
        util.exec("echo '  result: latest = " .. latest .. "' >> " .. EXEC_LOG)
    end
    util.exec("echo '=== check done ===' >> " .. EXEC_LOG)
    http.prepare_content("application/json")
    http.write_json({ latest_version = latest })
end

function launch_core_upgrade(force)
    local bin_path = find_binary()
    local ts = os.date("%Y%m%d_%H%M%S") or ("t" .. os.time())
    local backup_dir = "/root/agh_backup_core_" .. ts
    local candidates_str = table.concat(PROXY_LIST, " ")
    local init_scripts_str = table.concat(INIT_SCRIPTS, " ")
    local bin_paths_str = table.concat(BIN_PATHS, " ")
    local install_base = "https://raw.githubusercontent.com/AdguardTeam/AdGuardHome/master/scripts/install.sh"

    local L = {}
    local function add(line) L[#L + 1] = line end

    add("#!/bin/sh")
    add("TS=" .. ts)
    add("BACKUP_DIR='" .. backup_dir .. "'")
    add("LOG='" .. EXEC_LOG .. "'")
    add("BIN_PATH='" .. (bin_path or "") .. "'")
    add("FORCE='" .. (force and "1" or "0") .. "'")
    add("PRIMARY_PROXY='" .. PRIMARY_PROXY .. "'")
    add("PROXY_CANDIDATES='" .. candidates_str .. "'")
    add("INIT_SCRIPTS='" .. init_scripts_str .. "'")
    add("BIN_PATHS='" .. bin_paths_str .. "'")
    add("INSTALL_BASE='" .. install_base .. "'")
    add("")
    add("cleanup() { rm -f /tmp/agh_install_${TS}.sh 2>/dev/null; }")
    add("trap 'cleanup' EXIT INT TERM")
    add("")
    add("get_version() {")
    add("  [ -x \"$1\" ] || return 1")
    add("  \"$1\" --version 2>/dev/null | grep -oE 'v?[0-9]+\\.[0-9]+\\.[0-9]+' | head -n1")
    add("}")
    add("")
    add("svc() {")
    add("  for s_i in $INIT_SCRIPTS; do")
    add("    [ -f \"$s_i\" ] && \"$s_i\" \"$1\" 2>/dev/null && return 0")
    add("  done")
    add("  return 1")
    add("}")
    add("")
    add("fetch_installer() {")
    add("  fi_out=\"$1\"")
    add("  fi_seen='__init__'")
    add("  for fi_p in \"$PRIMARY_PROXY\" \"\" $PROXY_CANDIDATES; do")
    add("    [ \"$fi_p\" = \"$fi_seen\" ] && continue")
    add("    fi_seen=\"$fi_p\"")
    add("    if [ -n \"$fi_p\" ]; then fi_url=\"${fi_p}${INSTALL_BASE}\"; else fi_url=\"$INSTALL_BASE\"; fi")
    add("    echo \"   try: $fi_url\" >> \"$LOG\"")
    add("    if curl -m 30 -fsSL -o \"$fi_out\" \"$fi_url\" 2>>\"$LOG\"; then")
    add("      [ -s \"$fi_out\" ] && return 0")
    add("    fi")
    add("  done")
    add("  return 1")
    add("}")
    add("")
    -- 代理感知的「完整安装包」兜底升级：当 AdGuardHome --update（直连 static.adtidy.org）失败时使用。
    -- 包改从 GitHub Releases 拉取（该域名可被所选 GitHub 代理代理），日志明确写出用了哪个代理/直连。
    add([==[
detect_pkg_suffix() {
  local os cpu
  case "$(uname -s)" in
    Linux) os=linux ;;
    Darwin) os=darwin ;;
    FreeBSD) os=freebsd ;;
    OpenBSD) os=openbsd ;;
    *) os=linux ;;
  esac
  case "$(uname -m)" in
    x86_64|x86-64|x64|amd64) cpu=amd64 ;;
    i386|i486|i686|i786|x86) cpu=386 ;;
    armv5l) cpu=armv5 ;;
    armv6l) cpu=armv6 ;;
    armv7l|armv8l) cpu=armv7 ;;
    aarch64|arm64) cpu=arm64 ;;
    mips|mips64)
      cpu="mips"
      if printf 'I' | hexdump -o 2>/dev/null | awk 'NR==1{print substr($2,6,1); exit}' | grep -q '1'; then
        cpu="mipsle"
      fi
      cpu="${cpu}_softfloat"
      ;;
    riscv64) cpu=riscv64 ;;
    *) cpu=amd64 ;;
  esac
  echo "${os}_${cpu}"
}

get_latest_agh_version() {
  local seen='__init__' out v
  for p in "$PRIMARY_PROXY" "" $PROXY_CANDIDATES; do
    [ "$p" = "$seen" ] && continue
    seen="$p"
    local api; if [ -n "$p" ]; then api="${p}https://api.github.com/repos/AdguardTeam/AdGuardHome/releases/latest"; else api="https://api.github.com/repos/AdguardTeam/AdGuardHome/releases/latest"; fi
    out=$(curl -m 10 -fsSL "$api" 2>/dev/null)
    if [ -n "$out" ]; then
      v=$(printf '%s' "$out" | grep -m1 '"tag_name"' | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
      [ -n "$v" ] && { printf '%s' "$v"; return 0; }
    fi
  done
  local seen2='__init__'
  for p in "$PRIMARY_PROXY" "" $PROXY_CANDIDATES; do
    [ "$p" = "$seen2" ] && continue
    seen2="$p"
    local cl; if [ -n "$p" ]; then cl="${p}https://raw.githubusercontent.com/AdguardTeam/AdGuardHome/master/CHANGELOG.md"; else cl="https://raw.githubusercontent.com/AdguardTeam/AdGuardHome/master/CHANGELOG.md"; fi
    out=$(curl -m 15 -fsSL "$cl" 2>/dev/null)
    if [ -n "$out" ]; then
      v=$(printf '%s' "$out" | awk 'BEGIN{incom=0} /<!--/{if($0 !~ /-->/) incom=1; next} /-->/{incom=0; next} !incom && /^##[[:space:]]*\[v?[0-9]+\.[0-9]+\.[0-9]+\]/{match($0,/v?[0-9]+\.[0-9]+\.[0-9]+/); print substr($0,RSTART,RLENGTH); exit}')
      [ -n "$v" ] && { printf '%s' "$v"; return 0; }
    fi
  done
  return 1
}

download_pkg_via_proxy() {
  local out="$1" ver="$2" os_cpu="$3"
  local base="https://github.com/AdguardTeam/AdGuardHome/releases/download/${ver}/AdGuardHome_${os_cpu}.tar.gz"
  local seen='__init__'
  for p in "$PRIMARY_PROXY" "" $PROXY_CANDIDATES; do
    [ "$p" = "$seen" ] && continue
    seen="$p"
    local url; if [ -n "$p" ]; then url="${p}${base}"; else url="$base"; fi
    echo "   [fallback] try: $url" >> "$LOG"
    if curl -m 60 -fsSL -o "$out" "$url" 2>>"$LOG"; then
      [ -s "$out" ] && return 0
    fi
  done
  return 1
}

fallback_upgrade_via_proxy() {
  local dst="${1:-$BIN_PATH}"
  [ -z "$dst" ] && dst="${BIN_PATHS%% *}"
  local ver os_cpu tmp newbin
  ver=$(get_latest_agh_version)
  if [ -z "$ver" ]; then
    echo '   [fallback] cannot determine latest AGH version via proxy' >> "$LOG"
    return 1
  fi
  os_cpu=$(detect_pkg_suffix)
  echo "   [fallback] target version=$ver pkg=AdGuardHome_${os_cpu}.tar.gz" >> "$LOG"
  tmp=$(mktemp -d 2>/dev/null)
  [ -z "$tmp" ] && { echo '   [fallback] cannot create temp dir' >> "$LOG"; return 1; }
  if download_pkg_via_proxy "$tmp/pkg.tar.gz" "$ver" "$os_cpu"; then
    if tar -xzf "$tmp/pkg.tar.gz" -C "$tmp" 2>>"$LOG"; then
      newbin=$(find "$tmp" -type f -name AdGuardHome 2>/dev/null | head -n1)
      if [ -n "$newbin" ]; then
        svc stop >> "$LOG" 2>&1 || pkill -f AdGuardHome 2>/dev/null
        sleep 2
        mkdir -p "$(dirname "$dst")"
        cp -f "$newbin" "$dst" 2>>"$LOG" && chmod 755 "$dst" 2>/dev/null
        echo "   [fallback] replaced binary at $dst (-> $ver)" >> "$LOG"
        rm -rf "$tmp"
        return 0
      else
        echo '   [fallback] AdGuardHome binary not found in archive' >> "$LOG"
      fi
    else
      echo '   [fallback] extract failed' >> "$LOG"
    fi
  else
    echo '   [fallback] package download failed via all proxies/direct' >> "$LOG"
  fi
  rm -rf "$tmp"
  return 1
}
]==])
    add("")
    add("echo '=== AdGuardHome core upgrade task started ===' > \"$LOG\"")
    add("")
    add("echo '>> Phase 1: backup current binary' >> \"$LOG\"")
    add("OLD_VERSION=''")
    add("if [ -n \"$BIN_PATH\" ] && [ -f \"$BIN_PATH\" ]; then")
    add("  mkdir -p \"$BACKUP_DIR\"")
    add("  cp -a \"$BIN_PATH\" \"$BACKUP_DIR/AdGuardHome\" 2>/dev/null || cp \"$BIN_PATH\" \"$BACKUP_DIR/AdGuardHome\"")
    add("  chmod 755 \"$BACKUP_DIR/AdGuardHome\" 2>/dev/null")
    add("  OLD_VERSION=$(get_version \"$BIN_PATH\")")
    add("  echo \"   backed up: $BIN_PATH (v${OLD_VERSION:-unknown})\" >> \"$LOG\"")
    add("else")
    add("  echo '   no existing binary to backup (fresh install)' >> \"$LOG\"")
    add("fi")
    add("")
    add("echo '>> Phase 2: execute upgrade' >> \"$LOG\"")
    add("UPGRADE_RC=1")
    add("TMP_INST=\"/tmp/agh_install_${TS}.sh\"")
    add("if [ \"$FORCE\" = \"1\" ]; then")
    add("  echo '   mode: force reinstall (install script -r)' >> \"$LOG\"")
    add("  if fetch_installer \"$TMP_INST\"; then")
    add("    svc stop >> \"$LOG\" 2>&1 || pkill -f AdGuardHome 2>/dev/null")
    add("    sleep 2")
    add("    sh \"$TMP_INST\" -r >> \"$LOG\" 2>&1")
    add("    UPGRADE_RC=$?")
    add("    if [ \"$UPGRADE_RC\" != \"0\" ]; then")
    add("      echo '   [fallback] install.sh -r failed (rc='\"$UPGRADE_RC\"'); trying proxy-aware package download + overwrite' >> \"$LOG\"")
    add("      if fallback_upgrade_via_proxy \"$BIN_PATH\"; then UPGRADE_RC=0; else UPGRADE_RC=1; fi")
    add("    fi")
    add("  else")
    add("    echo '   [download failed] install.sh' >> \"$LOG\"")
    add("    UPGRADE_RC=1")
    add("  fi")
    add("elif [ -n \"$BIN_PATH\" ]; then")
    add("  echo '   mode: AdGuardHome --update (proxy NOT applied; package fetched DIRECT from static.adtidy.org)' >> \"$LOG\"")
    add("  \"$BIN_PATH\" --update >> \"$LOG\" 2>&1")
    add("  UPGRADE_RC=$?")
    add("  if [ \"$UPGRADE_RC\" != \"0\" ]; then")
    add("    echo '   [fallback] AdGuardHome --update failed (rc='\"$UPGRADE_RC\"'); trying proxy-aware package download + overwrite' >> \"$LOG\"")
    add("    if fallback_upgrade_via_proxy; then UPGRADE_RC=0; else UPGRADE_RC=1; fi")
    add("  fi")
    add("else")
    add("  echo '   mode: install script (no existing binary)' >> \"$LOG\"")
    add("  if fetch_installer \"$TMP_INST\"; then")
    add("    sh \"$TMP_INST\" >> \"$LOG\" 2>&1")
    add("    UPGRADE_RC=$?")
    add("    if [ \"$UPGRADE_RC\" != \"0\" ]; then")
    add("      echo '   [fallback] install.sh failed (rc='\"$UPGRADE_RC\"'); trying proxy-aware package download' >> \"$LOG\"")
    add("      if fallback_upgrade_via_proxy \"${BIN_PATHS%% *}\"; then UPGRADE_RC=0; else UPGRADE_RC=1; fi")
    add("    fi")
    add("  else")
    add("    echo '   [download failed] install.sh' >> \"$LOG\"")
    add("    UPGRADE_RC=1")
    add("  fi")
    add("fi")
    add("rm -f \"$TMP_INST\" 2>/dev/null")
    add("echo \"   upgrade exit code: $UPGRADE_RC\" >> \"$LOG\"")
    add("")
    add("echo '>> Phase 3: verify new binary' >> \"$LOG\"")
    add("NEW_BIN=''")
    add("for v_p in $BIN_PATHS \"$BIN_PATH\"; do")
    add("  [ -z \"$v_p\" ] && continue")
    add("  if [ -f \"$v_p\" ]; then NEW_BIN=\"$v_p\"; break; fi")
    add("done")
    add("if [ -z \"$NEW_BIN\" ]; then")
    add("  v_w=$(which AdGuardHome 2>/dev/null | tr -d '[:space:]')")
    add("  [ -n \"$v_w\" ] && [ -f \"$v_w\" ] && NEW_BIN=\"$v_w\"")
    add("fi")
    add("VERIFY_OK=1")
    add("if [ -z \"$NEW_BIN\" ] || [ ! -f \"$NEW_BIN\" ]; then")
    add("  echo '   [verify] binary not found after upgrade' >> \"$LOG\"")
    add("  VERIFY_OK=0")
    add("else")
    add("  [ -x \"$NEW_BIN\" ] || chmod 755 \"$NEW_BIN\" 2>/dev/null")
    add("  if [ ! -x \"$NEW_BIN\" ]; then")
    add("    echo \"   [verify] binary not executable: $NEW_BIN\" >> \"$LOG\"")
    add("    VERIFY_OK=0")
    add("  fi")
    add("fi")
    add("NEW_VERSION=''")
    add("if [ \"$VERIFY_OK\" = \"1\" ]; then")
    add("  if \"$NEW_BIN\" --version 2>/dev/null | grep -q '.'; then")
    add("    NEW_VERSION=$(get_version \"$NEW_BIN\")")
    add("    [ -z \"$NEW_VERSION\" ] && NEW_VERSION='unknown'")
    add("    echo \"   new binary: $NEW_BIN (v$NEW_VERSION)\" >> \"$LOG\"")
    add("  else")
    add("    echo \"   [verify] binary cannot run: $NEW_BIN\" >> \"$LOG\"")
    add("    VERIFY_OK=0")
    add("  fi")
    add("fi")
    add("")
    add("if [ \"$VERIFY_OK\" != \"1\" ]; then")
    add("  echo '>> Phase 4: rollback (verify failed)' >> \"$LOG\"")
    add("  if [ -n \"$BIN_PATH\" ] && [ -f \"$BACKUP_DIR/AdGuardHome\" ]; then")
    add("    svc stop >> \"$LOG\" 2>&1 || pkill -f AdGuardHome 2>/dev/null")
    add("    sleep 1")
    add("    mkdir -p \"$(dirname \"$BIN_PATH\")\"")
    add("    cp -a \"$BACKUP_DIR/AdGuardHome\" \"$BIN_PATH\" 2>/dev/null || cp \"$BACKUP_DIR/AdGuardHome\" \"$BIN_PATH\"")
    add("    chmod 755 \"$BIN_PATH\" 2>/dev/null")
    add("    echo \"   restored old binary: $BIN_PATH\" >> \"$LOG\"")
    add("    svc start >> \"$LOG\" 2>&1")
    add("    echo '   service restarted with old binary' >> \"$LOG\"")
    add("  else")
    add("    echo '   no backup to restore (was fresh install)' >> \"$LOG\"")
    add("  fi")
    add("  echo \"=== core upgrade FAILED: verify (exit=$UPGRADE_RC) ===\" >> \"$LOG\"")
    add("  exit 2")
    add("fi")
    add("")
    add("echo '>> Phase 5: restart service' >> \"$LOG\"")
    add("svc restart >> \"$LOG\" 2>&1 || { svc stop >> \"$LOG\" 2>&1; sleep 1; svc start >> \"$LOG\" 2>&1; }")
    add("echo \"=== core upgrade done (v${OLD_VERSION:-none} -> v${NEW_VERSION:-?}) ===\" >> \"$LOG\"")

    local scrpath = "/tmp/agh_core_upgrade_runner.sh"
    local f = io.open(scrpath, "w")
    if not f then return false end
    f:write(table.concat(L, "\n"))
    f:close()
    os.execute("chmod 755 " .. scrpath)
    -- 注意：ShellRunner 脚本执行前清写 EXEC_LOG 由 shell 头部定义 / Note: the pre-exec EXEC_LOG truncation for ShellRunner is defined in the shell header
    os.execute("sh " .. scrpath .. " 2>&1 &")
    return true
end

function do_upgrade()
    resolve_proxy()
    local force = post_value("force")
    launch_core_upgrade(force == "1")
    http.prepare_content("application/json")
    http.write_json({ success = true })
end

function set_proxy()
    local proxy = post_value("proxy") or ""
    if not is_safe_proxy(proxy) then
        http.prepare_content("application/json")
        http.write_json({ success = false, error = "invalid proxy" })
        return
    end
    local tmp = PROXY_CONF .. ".tmp"
    local f = io.open(tmp, "w")
    if not f then
        http.prepare_content("application/json")
        http.write_json({ success = false, error = "write failed" })
        return
    end
    f:write("proxy=" .. proxy .. "\n")
    f:close()
    os.rename(tmp, PROXY_CONF)
    os.execute("chmod 644 " .. PROXY_CONF .. " 2>/dev/null")
    load_proxies()
    http.prepare_content("application/json")
    http.write_json({ success = true, proxy = PRIMARY_PROXY })
end

function proxy_test()
    load_proxies()
    local proxy = post_value("proxy")
    if proxy == nil then proxy = PRIMARY_PROXY end
    if not is_safe_proxy(proxy) then
        http.prepare_content("application/json")
        http.write_json({ ok = false, error = "invalid proxy" })
        return
    end
    local test_url = "https://raw.githubusercontent.com/AdguardTeam/AdGuardHome/master/README.md"
    local target = proxify(proxy, test_url)

    local cmd = "curl -m 8 -fsSL -o /dev/null -w 'TIME:%{time_total}' '" .. target .. "' 2>/dev/null; echo 'EXIT:'$?"
    local out = util.exec(cmd) or ""
    local latency_str = out:match("TIME:([%d%.]+)") or ""
    local exit_str = out:match("EXIT:(%d+)") or "1"
    local ok = (exit_str == "0")
    local latency = tonumber(latency_str)
    if latency then latency = math.floor(latency * 1000) end
    http.prepare_content("application/json")
    http.write_json({ ok = ok, latency = latency })
end

function get_log()
    -- 1. 执行/升级日志 (EXEC_LOG)：面板各按钮后台动作 / 升级过程记录 / 1. Exec/upgrade log: backend actions of each dashboard button + upgrade process
    local exec_content = ""
    if fs.access(EXEC_LOG) then
        local data = fs.readfile(EXEC_LOG)
        if data and #data > 0 then
            exec_content = data
        end
    end

    -- 2. 系统/运行日志：优先 AdGuardHome 原生日志（截尾 100 行），否则从系统 logread 提取 / 2. System/runtime log: prefer AGH native log (last 100 lines), else system logread
    local run_log = ""
    local agh_logs = {
        "/opt/AdGuardHome/data/agh.log",
        "/var/log/AdGuardHome.log",
        "/tmp/AdGuardHome.log"
    }
    for _, lf in ipairs(agh_logs) do
        if fs.access(lf) then
            local data = fs.readfile(lf)
            if data and #data > 50 then
                run_log = util.exec("tail -n 100 '" .. lf .. "' 2>/dev/null") or data
                break
            end
        end
    end
    if run_log == "" then
        run_log = util.exec("logread -e 'AdGuardHome' 2>/dev/null | tail -n 50") or ""
        if run_log == "" then
            run_log = util.exec("logread 2>/dev/null | grep -i 'adguard' | tail -n 50") or ""
        end
    end

    -- 3. AdGuardHome 状态：版本 + 进程运行状态（前端「日志查看器」第一部分展示） / 3. AdGuardHome status: version + process state (shown in part 1 of the log viewer)
    local status = ""
    local bin_path = find_binary()
    if bin_path then
        local ver = util.exec(bin_path .. " --version 2>&1") or ""
        ver = ver:gsub("^%s+", ""):gsub("%s+$", "")
        status = ver
        local pid_out = util.exec("pgrep -f 'AdGuardHome' 2>/dev/null")
        if pid_out and pid_out:match("%d") then
            status = status .. "\nPID: " .. (pid_out:match("(%d+)") or "N/A") .. " (running)"
        else
            status = status .. "\nStatus: stopped"
        end
    end

    -- 分三段独立返回：前端各段固定位置渲染、互不干扰 / Return three separate fields so the frontend renders each in a fixed position, independently
    http.prepare_content("application/json")
    http.write_json({ status = status, exec_log = exec_content, system_log = run_log })
end

-- 清空中间层执行/升级日志（仅 EXEC_LOG）。 / Clear the middle-layer exec/upgrade log (EXEC_LOG only).
-- 注意：「系统/运行日志」（AGH 原生日志 + 系统 logread）属 AGH/系统自身，不在服务端删除； / Note: the "system/runtime log" (AGH native log + system logread) belongs to AGH/the system and is NOT deleted server-side;
-- 前端点击「清空日志」时只清视图显示，刷新后由 fetchLog 重新拉取继续显示。 / When the frontend clicks "Clear Log" it only clears the view; after refresh fetchLog re-pulls and the log shows again.
function clear_log()
    local f = io.open(EXEC_LOG, "w")
    if f then
        f:write("")
        f:close()
    end
    http.prepare_content("application/json")
    http.write_json({ success = true })
end

local function semver_compare(a, b)
    if not a or not b then return nil end
    local at, bt = {}, {}
    for n in string.gmatch(a, "%d+") do at[#at + 1] = tonumber(n) or 0 end
    for n in string.gmatch(b, "%d+") do bt[#bt + 1] = tonumber(n) or 0 end
    if #at == 0 or #bt == 0 then return nil end
    local maxn = #at > #bt and #at or #bt
    for i = 1, maxn do
        local ai = at[i] or 0
        local bi = bt[i] or 0
        if ai < bi then return -1 end
        if ai > bi then return 1 end
    end
    return 0
end

function check_dashboard_update()
    resolve_proxy()
    local time_str = os.date("%Y-%m-%d %H:%M:%S")
    local pinfo = (PRIMARY_PROXY ~= "") and PRIMARY_PROXY or "direct"
    local manifest_url = "https://raw.githubusercontent.com/" .. DASH_REPO .. "/" .. DASH_BRANCH .. "/manifest.json"
    TRY_LOG = EXEC_LOG
    util.exec("echo '[" .. time_str .. "] Check Dashboard update (proxy=" .. pinfo .. ")' > " .. EXEC_LOG)
    local body = try_with_proxies(manifest_url, true)
    TRY_LOG = nil
    if not body or body == "" then
        util.exec("echo '  result: fetch failed' >> " .. EXEC_LOG)
        util.exec("echo '=== check done ===' >> " .. EXEC_LOG)
        http.prepare_content("application/json")
        http.write_json({
            current_version = get_installed_version(),
            latest_version = "",
            need_update = false,
            error = "fetch_failed"
        })
        return
    end
    local ver = body:match('"version"%s*:%s*"([^"]+)"')
    if not ver then
        util.exec("echo '  result: parse failed' >> " .. EXEC_LOG)
        util.exec("echo '=== check done ===' >> " .. EXEC_LOG)
        http.prepare_content("application/json")
        http.write_json({
            current_version = get_installed_version(),
            latest_version = "",
            need_update = false,
            error = "parse_failed"
        })
        return
    end
    util.exec("echo '  result: latest = " .. ver .. "' >> " .. EXEC_LOG)
    util.exec("echo '=== check done ===' >> " .. EXEC_LOG)
    local cmp = semver_compare(get_installed_version(), ver)
    local need = (cmp and cmp < 0) or false
    http.prepare_content("application/json")
    http.write_json({
        current_version = get_installed_version(),
        latest_version = ver,
        need_update = need
    })
end

function do_upgrade_dashboard()
    resolve_proxy()
    local ts = os.date("%Y%m%d_%H%M%S") or ("t" .. os.time())
    local backup_dir = "/root/agh_backup_dashboard_" .. ts
    local tmpdir = "/tmp/agh_dash_new_" .. ts
    local candidates_str = table.concat(PROXY_LIST, " ")

    local L = {}
    local function add(line) L[#L + 1] = line end

    add("#!/bin/sh")
    add("TS=" .. ts)
    add("BACKUP_DIR='" .. backup_dir .. "'")
    add("TMPDIR='" .. tmpdir .. "'")
    add("BASE='https://raw.githubusercontent.com/" .. DASH_REPO .. "/" .. DASH_BRANCH .. "/'")
    add("PRIMARY_PROXY='" .. PRIMARY_PROXY .. "'")
    add("PROXY_CANDIDATES='" .. candidates_str .. "'")
    add("LOG='" .. EXEC_LOG .. "'")
    add("CHECKSUMS=\"$TMPDIR/checksums.sha256\"")
    add("")
    add("mkdir -p \"$TMPDIR\"")
    add("cleanup() { rm -rf \"$TMPDIR\" 2>/dev/null; rm -f \"${TMPDIR}_runner.sh\" 2>/dev/null; }")
    add("trap 'cleanup' EXIT INT TERM")
    add("")
    add("verify_file() {")
    add("  v_path=\"$1\"; v_min=\"$2\"; v_kind=\"$3\"")
    add("  [ -f \"$v_path\" ] || { echo \"   [verify] not exist: $v_path\" >> \"$LOG\"; return 1; }")
    add("  [ -s \"$v_path\" ] || { echo \"   [verify] empty: $v_path\" >> \"$LOG\"; return 1; }")
    add("  v_sz=$(wc -c < \"$v_path\" 2>/dev/null | tr -d '[:space:]')")
    add("  [ -n \"$v_sz\" ] || v_sz=0")
    add("  [ \"$v_sz\" -ge \"$v_min\" ] 2>/dev/null || { echo \"   [verify] size $v_sz < $v_min: $v_path\" >> \"$LOG\"; return 1; }")
    add("  case \"$v_kind\" in")
    add("    lmo)")
    add("      v_hex=$(tail -c 4 \"$v_path\" 2>/dev/null | od -An -tx1 2>/dev/null | tr -d '[:space:]')")
    add("      [ \"$v_hex\" = \"4c4d4f00\" ] || { echo \"   [verify] LMO magic bad: $v_path ($v_hex)\" >> \"$LOG\"; return 1; }")
    add("      ;;")
    add("    lua)")
    add("      grep -q 'function' \"$v_path\" 2>/dev/null || { echo \"   [verify] lua no 'function': $v_path\" >> \"$LOG\"; return 1; }")
    add("      grep -q 'list_backups' \"$v_path\" 2>/dev/null || { echo \"   [verify] lua 缺少备份 API (list_backups)，可能为代理缓存旧版: $v_path\" >> \"$LOG\"; return 1; }")
    add("      ;;")
    add("    js)")
    add("      grep -q 'view.extend' \"$v_path\" 2>/dev/null || { echo \"   [verify] js no 'view.extend': $v_path\" >> \"$LOG\"; return 1; }")
    add("      grep -q 'fetchBackups' \"$v_path\" 2>/dev/null || { echo \"   [verify] js 缺少备份管理功能 (fetchBackups)，可能为代理缓存旧版: $v_path\" >> \"$LOG\"; return 1; }")
    add("      ;;")
    add("    po)")
    add("      grep -q 'msgid' \"$v_path\" 2>/dev/null || { echo \"   [verify] po no 'msgid': $v_path\" >> \"$LOG\"; return 1; }")
    add("      ;;")
    add("    json)")
    add("      grep -q '\"version\"' \"$v_path\" 2>/dev/null || { echo \"   [verify] json no 'version': $v_path\" >> \"$LOG\"; return 1; }")
    add("      ;;")
    add("  esac")
    add("  return 0")
    add("}")
    add("")
    add("sha256_of() {")
    add("  if command -v sha256sum >/dev/null 2>&1; then")
    add("    sha256sum \"$1\" 2>/dev/null | awk '{print $1}'")
    add("  elif command -v openssl >/dev/null 2>&1; then")
    add("    openssl sha256 \"$1\" 2>/dev/null | awk '{print $NF}'")
    add("  fi")
    add("}")
    add("check_sha() {")
    add("  c_src=\"$1\"; c_file=\"$2\"")
    add("  [ -f \"$CHECKSUMS\" ] || return 0")
    add("  c_exp=$(grep -F \" $c_src\" \"$CHECKSUMS\" 2>/dev/null | awk '{print $1}' | head -n1)")
    add("  [ -n \"$c_exp\" ] || return 0")
    add("  c_act=$(sha256_of \"$c_file\")")
    add("  [ -n \"$c_act\" ] || return 0")
    add("  if [ \"$c_exp\" != \"$c_act\" ]; then")
    add("    echo \"   [sha] 不匹配 $c_src (期望 $c_exp 实际 $c_act) — 可能代理缓存旧版\" >> \"$LOG\"")
    add("    return 1")
    add("  fi")
    add("  return 0")
    add("}")
    add("")
    add("download_one() {")
    add("  d_src=\"$1\"; d_out=\"$2\"")
    add("  mkdir -p \"$(dirname \"$d_out\")\"")  -- 确保目标目录存在，避免 curl (23) write error / Ensure target dir exists to avoid curl (23) write error
    add("  d_rel=\"${BASE}${d_src}\"")
    add("  norm_proxy() { case \"$1\" in */) echo \"$1\"; *) echo \"$1/\";; esac; }")
    add("  if [ -n \"$PRIMARY_PROXY\" ]; then")
    add("    d_url=\"$(norm_proxy \"$PRIMARY_PROXY\")${d_rel}\"")
    add("    echo \"   try: $d_url\" >> \"$LOG\"")
    add("    if curl -m 30 -fsSL -o \"$d_out\" \"$d_url\" 2>>\"$LOG\" && [ -s \"$d_out\" ]; then echo \"   ok: $d_src\" >> \"$LOG\"; return 0; fi")
    add("    echo \"   [download failed] proxy '$PRIMARY_PROXY' unreachable: $d_src\" >> \"$LOG\"")
    add("    return 1")
    add("  fi")
    add("  d_url=\"$d_rel\"")
    add("  echo \"   try: $d_url\" >> \"$LOG\"")
    add("  if curl -m 30 -fsSL -o \"$d_out\" \"$d_url\" 2>>\"$LOG\" && [ -s \"$d_out\" ]; then echo \"   ok: $d_src\" >> \"$LOG\"; return 0; fi")
    add("  echo \"   [download failed] direct unreachable: $d_src\" >> \"$LOG\"")
    add("  return 1")
    add("}")
    add("")
    add("DEPLOYED=''")
    add("rollback_all() {")
    add("  echo '>> auto rollback deployed files...' >> \"$LOG\"")
    add("  for r_f in $DEPLOYED; do")
    add("    r_b=\"$BACKUP_DIR$r_f\"")
    add("    if [ -f \"$r_b\" ]; then")
    add("      mkdir -p \"$(dirname \"$r_f\")\"")
    add("      cp -a \"$r_b\" \"$r_f\" 2>/dev/null || cp \"$r_b\" \"$r_f\"")
    add("      chmod 644 \"$r_f\" 2>/dev/null")
    add("      echo \"   restored: $r_f\" >> \"$LOG\"")
    add("    fi")
    add("  done")
    add("}")
    add("")
    add("deploy_one() {")
    add("  e_tmp=\"$1\"; e_dst=\"$2\"")
    add("  if [ -f \"$e_dst\" ]; then")
    add("    e_bdir=\"$BACKUP_DIR$(dirname \"$e_dst\")\"")
    add("    mkdir -p \"$e_bdir\"")
    add("    cp -a \"$e_dst\" \"$e_bdir/$(basename \"$e_dst\")\" 2>/dev/null || cp \"$e_dst\" \"$e_bdir/$(basename \"$e_dst\")\"")
    add("  fi")
    add("  mkdir -p \"$(dirname \"$e_dst\")\"")
    add("  if mv -f \"$e_tmp\" \"$e_dst\" 2>/dev/null; then")
    add("    chmod 644 \"$e_dst\" 2>/dev/null")
    add("    DEPLOYED=\"$DEPLOYED $e_dst\"")
    add("    echo \"   deployed: $e_dst\" >> \"$LOG\"")
    add("    return 0")
    add("  else")
    add("    echo \"   [mv failed]: $e_dst\" >> \"$LOG\"")
    add("    return 1")
    add("  fi")
    add("}")
    add("")
    add("fail_task() {")
    add("  f_reason=\"$1\"")
    add("  rollback_all")
    add("  echo \"=== dashboard upgrade FAILED: $f_reason ===\" >> \"$LOG\"")
    add("  if [ -d \"$BACKUP_DIR\" ] && [ -z \"$(ls -A \"$BACKUP_DIR\" 2>/dev/null)\" ]; then rm -rf \"$BACKUP_DIR\" 2>/dev/null; fi")
    add("  exit 2")
    add("}")
    add("")
    add("echo '=== Dashboard upgrade task started ===' > \"$LOG\"")
    add("echo '>> Phase 1: download & verify' >> \"$LOG\"")
    add("download_one 'checksums.sha256' \"$CHECKSUMS\" 2>/dev/null || echo \"   [warn] checksums.sha256 下载失败，跳过 sha 校验（仅语义校验）\" >> \"$LOG\"")

    for i = 1, #DASH_FILES do
        local f = DASH_FILES[i]
        local tmp_path = tmpdir .. "/" .. f.base
        add("download_one '" .. f.src .. "' '" .. tmp_path .. "' || fail_task 'download " .. f.src .. "'")
        add("verify_file '" .. tmp_path .. "' " .. tostring(f.min_size) .. " " .. f.kind .. " || fail_task 'verify " .. f.src .. "'")
        add("check_sha '" .. f.src .. "' '" .. tmp_path .. "' || fail_task 'sha " .. f.src .. "'")
    end

    add("echo '>> Phase 2: backup & deploy' >> \"$LOG\"")
    for i = 1, #DASH_FILES do
        local f = DASH_FILES[i]
        local tmp_path = tmpdir .. "/" .. f.base
        add("deploy_one '" .. tmp_path .. "' '" .. f.dst .. "' || fail_task 'deploy " .. f.src .. "'")
    end

    -- 阶段2.5: 在备份目录生成 restore.sh（与 install.sh 的 restore 逻辑一致） / Phase 2.5: generate restore.sh in the backup dir (consistent with install.sh's restore logic)
    add("mkdir -p \"$BACKUP_DIR\"")
    add("echo '>> Phase 2.5: generate restore.sh in backup dir' >> \"$LOG\"")
    local restore_lines = {
        "#!/bin/sh",
        "# 一键恢复面板到本次升级前的状态",
        "# 备份目录: " .. backup_dir,
        "# 仅恢复 6 个面板文件，不涉及 AdGuardHome 核心",
        "set -u",
        "BACKUP_DIR='" .. backup_dir .. "'",
        "",
        "restore_one() {",
        "  r_rel=\"$1\"; r_dst=\"$2\"; r_src=\"$BACKUP_DIR/$r_rel\"",
        "  if [ -f \"$r_src\" ]; then",
        "    mkdir -p \"$(dirname \"$r_dst\")\"",
        "    cp -a \"$r_src\" \"$r_dst\" 2>/dev/null || cp \"$r_src\" \"$r_dst\"",
        "    chmod 644 \"$r_dst\" 2>/dev/null",
        "    echo \"  restored: $r_dst\"",
        "  else",
        "    echo \"  (skip) no backup: $r_rel\"",
        "  fi",
        "}",
        "",
        "echo \"=== Restore dashboard from $BACKUP_DIR ===\"",
        "echo '>> 恢复面板文件...'",
    }
    -- 按 DASH_FILES 的 dst -> 相对 BACKUP_DIR 的 rel 映射 / Build the dst -> relative-to-BACKUP_DIR rel mapping from DASH_FILES
    for i = #DASH_FILES, 1, -1 do
        local f = DASH_FILES[i]
        -- dst 形如 /usr/lib/lua/luci/controller/adguardhome.lua / dst looks like /usr/lib/lua/luci/controller/adguardhome.lua
        -- rel 是 BACKUP_DIR 下相对路径（deploy_one 已按原 dst 完整路径备份） / rel is the relative path under BACKUP_DIR (deploy_one already backed up by the full original dst path)
        local rel = f.dst  -- deploy_one 备份时用 "$BACKUP_DIR$e_dst" 作目标，所以 rel = e_dst
        table.insert(restore_lines, string.format("restore_one '%s' '%s'", rel, f.dst))
    end
    table.insert(restore_lines, "")
    table.insert(restore_lines, "echo '>> 清理缓存并重启服务...'")
    table.insert(restore_lines, "rm -rf /tmp/luci-* 2>/dev/null")
    table.insert(restore_lines, "rm -f /tmp/luci-indexcache.* /tmp/luci-modulecache.* 2>/dev/null")
    table.insert(restore_lines, "find /tmp -name '*.luac' -delete 2>/dev/null")
    table.insert(restore_lines, "/etc/init.d/rpcd restart 2>/dev/null")
    table.insert(restore_lines, "/etc/init.d/uhttpd restart 2>/dev/null")
    table.insert(restore_lines, "echo '=== 恢复完成（仅面板文件，AGH 核心未受影响）==='")
    table.insert(restore_lines, "echo '请刷新浏览器查看效果。'")
    local restore_body = table.concat(restore_lines, "\n")
    -- 用 cat <<'EOF' 避免变量被 shell 解析（restore_body 内含 $ 需原样写入） / Use cat <<'EOF' to prevent shell variable expansion (restore_body contains $ that must be written verbatim)
    add("cat > \"$BACKUP_DIR/restore.sh\" <<'AGH_RESTORE_EOF'")
    add(restore_body)
    add("AGH_RESTORE_EOF")
    add("chmod 755 \"$BACKUP_DIR/restore.sh\" 2>/dev/null")
    add("echo \"   restore.sh generated: $BACKUP_DIR/restore.sh\" >> \"$LOG\"")

    add("echo '>> Phase 3: clear cache & restart services' >> \"$LOG\"")
    add("rm -rf /tmp/luci-* 2>/dev/null || true")
    add("rm -f /tmp/luci-indexcache.* /tmp/luci-modulecache.* 2>/dev/null || true")
    add("find /tmp -name '*.luac' -delete 2>/dev/null || true")
    add("/etc/init.d/rpcd restart 2>/dev/null >> \"$LOG\" 2>&1 || true")
    add("/etc/init.d/uhttpd restart 2>/dev/null >> \"$LOG\" 2>&1 || true")
    add("echo '=== dashboard upgrade done (v" .. get_installed_version() .. " -> upstream) ===' >> \"$LOG\"")

    local scrpath = tmpdir .. "_runner.sh"
    local f = io.open(scrpath, "w")
    if not f then
        http.prepare_content("application/json")
        http.write_json({ success = false, error = "script write failed" })
        return
    end
    f:write(table.concat(L, "\n"))
    f:close()
    os.execute("chmod 755 " .. scrpath)
    os.execute("sh " .. scrpath .. " 2>&1 &")
    http.prepare_content("application/json")
    http.write_json({ success = true })
end

-- 备份根目录 / Backup root directory
local BACKUP_ROOT = "/root"
local BACKUP_PREFIX = "agh_backup_"

-- 列出所有 /root/agh_backup_* 备份目录（install / core / dashboard） / List all /root/agh_backup_* backup dirs (install / core / dashboard)
function list_backups()
    local backups = {}
    local handle = io.popen("ls -d " .. BACKUP_ROOT .. "/" .. BACKUP_PREFIX .. "* 2>/dev/null")
    if not handle then
        http.prepare_content("application/json")
        http.write_json({ backups = {} })
        return
    end
    for line in handle:lines() do
        local name = line:match("^.+/" .. BACKUP_PREFIX .. "(.+)$") or ""
        local btype = name:match("^([a-z]+)_") or "unknown"
        -- 时间戳在 <type>_ 前缀之后（如 install_20260826_123501），精确匹配 YYYYMMDD_HHMMSS，并去掉可能带入的前导分隔符 / The timestamp sits after the <type>_ prefix (e.g. install_20260826_123501); match YYYYMMDD_HHMMSS precisely and strip any leading separator
        local ts_raw = name:match("(%d%d%d%d%d%d%d%d_%d%d%d%d%d%d)$")
            or name:match("([0-9_%-]+)$") or ""
        ts_raw = ts_raw:gsub("^[_%-]+", "")
        local ts = ts_raw
        -- 把 20260826_123501 格式化为人读形式 2026-08-26 12:35:01 / format 20260826_123501 -> 2026-08-26 12:35:01
        if ts_raw:match("^%d%d%d%d%d%d%d%d_%d%d%d%d%d%d$") then
            ts = string.sub(ts_raw, 1, 4) .. "-" .. string.sub(ts_raw, 5, 6) .. "-" .. string.sub(ts_raw, 7, 8)
               .. " " .. string.sub(ts_raw, 10, 11) .. ":" .. string.sub(ts_raw, 12, 13) .. ":" .. string.sub(ts_raw, 14, 15)
        end
        local restore = line .. "/restore.sh"
        local has_restore = fs.access(restore) and true or false
        local has_core = fs.access(line .. "/core/AdGuardHome") and true or false
        -- 统计文件数和总大小 / Count files and total size
        local count_out = util.exec("find '" .. line .. "' -type f 2>/dev/null | wc -l") or "0"
        local file_count = tonumber(count_out:match("(%d+)")) or 0
        local size_out = util.exec("du -sh '" .. line .. "' 2>/dev/null | awk '{print $1}'") or "?"
        local size = size_out:gsub("%s+", "")
        table.insert(backups, {
            dir = line,
            name = name,
            type = btype,
            timestamp = ts,
            file_count = file_count,
            size = size,
            has_restore = has_restore,
            has_core = has_core
        })
    end
    handle:close()
    table.sort(backups, function(a, b) return a.dir > b.dir end)
    http.prepare_content("application/json")
    http.write_json({ backups = backups })
end

-- 从指定备份目录恢复（优先执行备份目录内的 restore.sh，没有则报错） / Restore from the given backup dir (prefer the backup's own restore.sh; error if absent)
function restore_backup()
    local dir = post_value("dir") or ""
    -- 安全检查：必须在 /root/agh_backup_* 下，禁止路径穿越 / Security check: must be under /root/agh_backup_*; forbid path traversal
    if not dir:match("^/root/agh_backup_[%w_-]+$") then
        http.prepare_content("application/json")
        http.write_json({ success = false, error = "invalid backup directory" })
        return
    end
    if not fs.access(dir) then
        http.prepare_content("application/json")
        http.write_json({ success = false, error = "backup directory not found" })
        return
    end
    local restore_script = dir .. "/restore.sh"
    if not fs.access(restore_script) then
        http.prepare_content("application/json")
        http.write_json({ success = false, error = "no restore.sh in this backup (可能是面板/核心升级的备份，仅 install 备份支持一键恢复)" })
        return
    end
    -- 后台执行恢复脚本，输出写入执行日志（EXEC_LOG），前端 startLogPolling 轮询检测 / Run the restore script in the background; output goes to EXEC_LOG; the frontend startLogPolling polls for completion
    -- 注意：必须与前端 confirmRestore 的完成判定一致（检测 '=== Restore from /root/agh_backup'） / Note: must match the frontend confirmRestore completion check (detects '=== Restore from /root/agh_backup')
    os.execute("echo '=== Restore from " .. dir .. " ===' > " .. EXEC_LOG)
    os.execute("sh " .. restore_script .. " >> " .. EXEC_LOG .. " 2>&1 &")
    http.prepare_content("application/json")
    http.write_json({ success = true })
end

-- 删除指定备份目录 / Delete the specified backup directory
function delete_backup()
    local dir = post_value("dir") or ""
    if not dir:match("^/root/agh_backup_[%w_-]+$") then
        http.prepare_content("application/json")
        http.write_json({ success = false, error = "invalid backup directory" })
        return
    end
    if not fs.access(dir) then
        http.prepare_content("application/json")
        http.write_json({ success = false, error = "backup directory not found" })
        return
    end
    local out = util.exec("rm -rf '" .. dir .. "' 2>&1")
    local ok = fs.access(dir) and false or true
    http.prepare_content("application/json")
    http.write_json({ success = ok, error = ok and nil or "delete failed" })
end
