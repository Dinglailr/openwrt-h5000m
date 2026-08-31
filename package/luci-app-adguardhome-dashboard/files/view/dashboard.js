'use strict';
'require view';
'require ui';
'require request';

/* ── Client-side translation fallback ── */
var _EN = {
    'AdGuard Home 控制中心': 'AdGuard Home Control Center',
    '实时状态监控 · 服务控制 · 日志查看 · 一键升级': 'Status Monitoring · Service Control · Log Viewer · One-click Upgrade',
    '实时仪表盘': 'Live Dashboard',
    '核心部署': 'Core Deployment',
    '核心版本': 'Core Version',
    '服务状态': 'Service Status',
    '运行状态': 'Running Status',
    'Web 端口': 'Web Port',
    '管理入口': 'Management URL',
    '服务控制台': 'Service Console',
    'AdGuardHome 版本': 'AdGuardHome Version',
    '日志查看器': 'Log Viewer',
    'AdGuardHome 状态': 'AdGuardHome Status',
    '执行 / 升级日志': 'Exec / Upgrade Log',
    '系统 / 运行日志': 'System / Runtime Log',
    '无状态信息': 'No status info',
    '启动服务': 'Start Service',
    '重启服务': 'Restart Service',
    '停止服务': 'Stop Service',
    '注册系统服务': 'Register System Service',
    '检查 AdGuardHome 更新': 'Check AdGuardHome Update',
    '检查 AdGuardHome 更新中...': 'Checking AdGuardHome Update...',
    '检查失败': 'Check failed',
    '升级 AdGuardHome': 'Upgrade AdGuardHome',
    '强制重装核心': 'Force Reinstall Core',
    '刷新日志': 'Refresh Log',
    '执行中...': 'Processing...',
    '操作执行成功': 'Operation succeeded',
    '操作失败: ': 'Operation failed: ',
    '未知错误': 'Unknown error',
    '执行异常: ': 'Execution error: ',
    '确认升级': 'Confirm Upgrade',
    '确认强制重装': 'Confirm Force Reinstall',
    '将下载并安装最新版本的 AdGuard Home 核心。升级期间服务可能短暂中断。': 'Will download and install the latest AdGuard Home core. Service may be briefly interrupted.',
    '将强制下载在线最新版本并覆盖安装当前版本。升级期间服务将中断。': 'Will force download and reinstall the latest version. Service will be interrupted.',
    '取消': 'Cancel',
    '升级任务已启动，请在下方日志查看器中查看进度': 'Upgrade started, check progress in the log viewer below',
    '强制重装任务已启动，请在下方日志查看器中查看进度': 'Force reinstall started, check progress in the log viewer below',
    '升级任务启动失败': 'Upgrade failed to start',
    '升级完成，正在刷新页面...': 'Upgrade completed, reloading page...',
    '未检查': 'Not checked',
    '暂无日志': 'No logs available',
    '获取日志失败': 'Failed to get logs',
    '未知': 'Unknown',
    '服务未启动': 'Service not started',
    '当前控制模式：': 'Control mode: ',
    'Init.d 系统服务级调用': 'Init.d System Service',
    'AdGuardHome 二进制直接控制（命令保底）': 'Binary Direct Control (Fallback)',
    '当前 AdGuardHome 版本：': 'Current AdGuardHome Version: ',
    'AdGuardHome 最新版本：': 'AdGuardHome Latest Version: ',
    '✔ 已下载': '✔ Installed',
    '✖ 未发现程序 (请运行官网命令安装)': '✖ Not found (Run official install command)',
    '✖ 未安装': '✖ Not installed',
    '下载安装': 'Download & Install',
    '下载安装 AdGuard Home': 'Download & Install AdGuard Home',
    '将从 GitHub 官方脚本下载安装 AdGuard Home 核心。安装期间请保持网络连接。': 'Will download and install AdGuard Home core from the official GitHub script. Please keep network connection stable.',
    '确认安装': 'Confirm Install',
    '安装任务已启动，请在下方日志查看器中查看进度': 'Install task started, check progress in the log viewer below',
    '安装任务启动失败': 'Install task failed to start',
    '✔ 已安装系统服务 | ✔ 开机自启已注册': '✔ System service installed | ✔ Auto-start registered',
    '⚠️ 未注册服务 (使用二进制保底控制)': '⚠ Not registered (Using binary fallback)',
    '● 正在运行': '● Running',
    '■ 已停止': '■ Stopped',
    'AdGuardHome 已是最新版本': 'AdGuardHome is up to date',
    '网络代理': 'Network Proxy',
    '切换代理后将实时生效，用于核心与面板的检查/升级请求': 'Selected proxy applies immediately for all update & upgrade requests',
    '直连 (Direct)': 'Direct',
    '自定义': 'Custom',
    '测试': 'Test',
    '测试所有': 'Test All',
    '测试中...': 'Testing...',
    '可用': 'Available',
    '不可用': 'Unavailable',
    '测试失败': 'Test failed',
    '地址不能为空': 'URL cannot be empty',
    '毫秒': 'ms',
    '面板版本': 'Dashboard Version',
    '检查面板更新': 'Check Dashboard',
    '检查面板更新中...': 'Checking Dashboard Update...',
    '升级面板': 'Upgrade Dashboard',
    '面板最新版本：': 'Latest: ',
    '当前面板版本：': 'Current: ',
    '面板已是最新版本': 'Dashboard is up to date',
    '升级面板任务已启动，请在下方日志查看器中查看进度': 'Dashboard upgrade started, check progress in the log viewer below',
    '确认升级面板': 'Confirm Dashboard Upgrade',
    '将从 GitHub 下载并部署最新版面板文件。期间 LuCI 会短暂重启。': 'Will download and deploy the latest dashboard files from GitHub. LuCI will briefly restart.',
    '面板升级任务启动失败': 'Dashboard upgrade failed to start',
    '面板升级完成，正在刷新页面': 'Dashboard upgrade completed, refreshing page',
    '面板升级失败，已自动回滚；请检查日志与代理设置': 'Dashboard upgrade failed and auto-rolled back; please check logs and proxy settings',
    '升级失败，已自动回滚；请检查日志与代理设置': 'Upgrade failed and auto-rolled back; please check logs and proxy settings',
    '备份管理': 'Backup Management',
    '刷新备份': 'Refresh Backups',
    '列出 /root/agh_backup_* 备份目录，可恢复或删除': 'List /root/agh_backup_* backup directories, can restore or delete',
    '点击「刷新备份」加载列表': 'Click "Refresh Backups" to load list',
    '加载中...': 'Loading...',
    '加载失败': 'Load failed',
    '暂无备份目录（/root/agh_backup_*）': 'No backup directories (/root/agh_backup_*)',
    '类型': 'Type',
    '时间戳': 'Timestamp',
    '文件数': 'Files',
    '大小': 'Size',
    '含核心': 'Has Core',
    '操作': 'Actions',
    '清空日志': 'Clear Log',
    '自动刷新': 'Auto Refresh',
    '清空失败': 'Clear Failed',
    '⚠️ 未注册服务': '⚠ Not Registered',
    '安装': 'Install',
    '核心升级': 'Core Upgrade',
    '面板升级': 'Dashboard Upgrade',
    '恢复': 'Restore',
    '命令': 'Cmd',
    '删除': 'Delete',
    '是': 'Yes',
    '否': 'No',
    '恢复命令（在路由器 SSH 执行）：': 'Restore command (run on router via SSH):',
    '提示：也可点击「恢复」让面板自动后台执行': 'Tip: Or click "Restore" to let dashboard run it in background',
    '确定从备份恢复吗？当前文件将被覆盖，恢复后页面会自动刷新。': 'Confirm restore from backup? Current files will be overwritten, page will refresh after restore.',
    '恢复中，请稍候...': 'Restoring, please wait...',
    '恢复失败，请查看日志': 'Restore failed, please check logs',
    '恢复失败': 'Restore failed',
    '确定删除此备份吗？此操作不可撤销。': 'Confirm delete this backup? This action cannot be undone.',
    '删除失败': 'Delete failed',
    '网络错误': 'Network error'
};

var _ZH_CACHE = null;  // _isChinese 结果缓存，页面生命周期内不用重复检测 / cache _isChinese result; no re-detect within page lifetime
function _isChinese() {
    if (_ZH_CACHE !== null) return _ZH_CACHE;
    var isZh = true;
    try {
        var lang = (L.env && (L.env.locale || L.env.language)) || '';
        if (lang) { isZh = (lang.indexOf('zh') !== -1); _ZH_CACHE = isZh; return isZh; }
    } catch(e) {}
    try {
        var h = document.documentElement.lang || navigator.language || '';
        isZh = (h.indexOf('zh') !== -1);
    } catch(e) {}
    _ZH_CACHE = isZh;
    return isZh;
}

function T(s) {
    if (_isChinese()) return s;
    var t = _EN[s];
    return t !== undefined ? t : s;
}

function _isDark() {
    try {
        var html = document.documentElement;
        var cls = (html.className || '') + ' ' + (document.body ? document.body.className || '' : '');
        if (cls.match(/dark|material|argon/i)) return true;
        var bg = getComputedStyle(document.body || html).backgroundColor || '';
        var m = bg.match(/\d+/g);
        if (m && m.length >= 3) {
            var lum = (parseInt(m[0]) * 299 + parseInt(m[1]) * 587 + parseInt(m[2]) * 114) / 1000;
            return lum < 128;
        }
    } catch(e) {}
    return false;
}

function _themeStyles() {
    var dark = _isDark();
    return {
        panelBg: dark ? 'rgba(255,255,255,0.05)' : '#f9f9f9',
        panelBorder: dark ? 'rgba(255,255,255,0.12)' : '#ddd',
        logBg: dark ? '#0d1117' : '#1e1e1e',
        logColor: '#d4d4d4',
        tableStripe: dark ? 'rgba(255,255,255,0.03)' : 'transparent',
        linkColor: dark ? '#58a6ff' : '#007bff',
        mutedColor: dark ? 'rgba(255,255,255,0.55)' : '#888'
    };
}

return view.extend({
    statusData: null,
    pollInterval: null,
    logPollInterval: null,
    rootNode: null,

    versionEl: null,
    runningEl: null,
    portEl: null,
    urlEl: null,
    latestVersionEl: null,
    upgradeBtn: null,
    forceBtn: null,
    checkUpdateBtn: null,
    statusLogEl: null,   /* 第一部分：AdGuardHome 状态（直接清除重载） / part 1: AGH status (clear + reload) */
    execLogEl: null,     /* 第二部分：执行/升级日志（滚动追加） / part 2: exec/upgrade log (scroll-append) */
    sysLogEl: null,      /* 第三部分：系统/运行日志（滚动追加） / part 3: system/runtime log (scroll-append) */
    execAccum: '',       /* 第二部分累计缓冲区（同名段增量合并，避免重复） / part 2 accumulator (incremental merge, no dup) */
    execLast: '',        /* 第二部分上一次服务端原文（用于增量合并判定） / part 2 last raw pulled from server */
    sysAccum: '',        /* 第三部分累计缓冲区 / part 3 accumulator */
    sysLast: '',         /* 第三部分上一次服务端原文 / part 3 last raw from server */
    MAX_LOG_LINES: 400,  /* 各段最多展示的行数（滚动窗口） / max lines per part (scrolling window) */

    /* ── Proxy component ── */
    proxyGroup: 'agh_proxy_' + (Math.floor(Math.random() * 1e9)),
    proxyLatencyEls: null,
    proxyRadioEls: null,
    proxyCustomInput: null,
    proxyCustomRadio: null,
    proxyGlobalTestBtn: null,
    proxyBusy: false,

    /* 客户端防抖（防止用户连点 start/stop/restart/upgrade 等按钮产生重复请求） / Client-side debounce (prevent duplicate requests from rapid clicks on start/stop/restart/upgrade buttons) */
    _actionBusy: false,

    /* ── Panel upgrade component ── */
    dashCurrVerEl: null,
    dashLatestVerEl: null,
    dashCheckBtn: null,
    dashUpgradeBtn: null,

    /* ── Backup management component ── */
    backupsListEl: null,

    fetchBackups: function() {
        var self = this;
        if (this.backupsListEl) {
            this.backupsListEl.innerHTML = '';
            this.backupsListEl.appendChild(E('div', { style: 'color:' + (this.theme ? this.theme.mutedColor : '#888') }, T('加载中...')));
        }
        return request.get(L.url('admin/services/adguardhome/backups')).then(function(res) {
            return res.json();
        }).then(function(d) {
            self.renderBackups((d && d.backups) || []);
        }).catch(function() {
            if (self.backupsListEl) self.backupsListEl.textContent = T('加载失败');
        });
    },

    renderBackups: function(backups) {
        var self = this;
        var el = this.backupsListEl;
        if (!el) return;
        el.innerHTML = '';
        if (!backups || !backups.length) {
            el.appendChild(E('div', { style: 'padding:10px;color:#888' }, T('暂无备份目录（/root/agh_backup_*）')));
            return;
        }
        var table = E('table', { class: 'table cbi-section-table', style: 'width:100%;font-size:12px' }, [
            E('tr', { class: 'tr' }, [
                E('th', { class: 'th', style: 'width:14%' }, T('类型')),
                E('th', { class: 'th', style: 'width:20%' }, T('时间戳')),
                E('th', { class: 'th', style: 'width:9%' }, T('文件数')),
                E('th', { class: 'th', style: 'width:10%' }, T('大小')),
                E('th', { class: 'th', style: 'width:9%' }, T('含核心')),
                E('th', { class: 'th', style: 'width:38%' }, T('操作'))
            ])
        ]);
        backups.forEach(function(b) {
            var typeMap = { install: T('安装'), core: T('核心升级'), dashboard: T('面板升级'), unknown: T('未知') };
            var tr = E('tr', { class: 'tr' }, [
                E('td', { class: 'td' }, typeMap[b.type] || b.type),
                E('td', { class: 'td', style: 'font-family:monospace' }, b.timestamp || '—'),
                E('td', { class: 'td' }, String(b.file_count || 0)),
                E('td', { class: 'td' }, b.size || '?'),
                E('td', { class: 'td' }, b.has_core ? T('是') : T('否')),
                E('td', { class: 'td' }, (function() {
                    var td = E('td', { class: 'td' });
                    if (b.has_restore) {
                        td.appendChild(E('button', {
                            class: 'btn cbi-button cbi-button-action',
                            style: 'margin-right:5px',
                            click: function() { self.confirmRestore(b.dir, b.name); }
                        }, T('恢复')));
                    }
                    td.appendChild(E('button', {
                        class: 'btn cbi-button cbi-button-neutral',
                        style: 'margin-right:5px',
                        click: function() { self.showRestoreCmd(b.dir); }
                    }, T('命令')));
                    td.appendChild(E('button', {
                        class: 'btn cbi-button cbi-button-negative',
                        click: function() { self.confirmDelete(b.dir, b.name); }
                    }, T('删除')));
                    return td;
                })())
            ]);
            table.appendChild(tr);
        });
        el.appendChild(table);
    },

    showRestoreCmd: function(dir) {
        var cmd = 'sh ' + dir + '/restore.sh';
        var box = E('div', { style: 'padding:10px;background:#f5f5f5;border:1px solid #ddd;border-radius:4px;font-family:monospace;word-break:break-all;margin-top:8px' }, [
            E('strong', {}, T('恢复命令（在路由器 SSH 执行）：')),
            E('pre', { style: 'margin:5px 0;white-space:pre-wrap' }, cmd),
            E('div', { style: 'font-size:11px;color:#888;margin-top:5px' }, T('提示：也可点击「恢复」让面板自动后台执行'))
        ]);
        if (this.backupsListEl) {
            var prev = this.backupsListEl.querySelector('.restore-cmd-box');
            if (prev) prev.remove();
            box.classList.add('restore-cmd-box');
            this.backupsListEl.appendChild(box);
        }
    },

    confirmRestore: function(dir, name) {
        var self = this;
        if (!window.confirm(T('确定从备份恢复吗？当前文件将被覆盖，恢复后页面会自动刷新。') + '\n\n' + dir)) return;
        request.post(L.url('admin/services/adguardhome/restore_backup'), { dir: dir }).then(function(res) {
            return res.json();
        }).then(function(d) {
            if (d && d.success) {
                if (self.backupsListEl) self.backupsListEl.appendChild(E('div', { style: 'padding:8px;color:#2dca73' }, T('恢复中，请稍候...')));
                /* startLogPolling 统一处理恢复完成检测（=== Restore from /root/agh_backup / 恢复完成）+ 页面刷新 / startLogPolling uniformly handles restore-completion detection (=== Restore from /root/agh_backup / 恢复完成) + page refresh */
                self.startLogPolling();
            } else {
                alert((d && d.error) || T('恢复失败'));
            }
        }).catch(function() { alert(T('网络错误')); });
    },

    confirmDelete: function(dir, name) {
        var self = this;
        if (!window.confirm(T('确定删除此备份吗？此操作不可撤销。') + '\n\n' + dir)) return;
        request.post(L.url('admin/services/adguardhome/delete_backup'), { dir: dir }).then(function(res) {
            return res.json();
        }).then(function(d) {
            if (d && d.success) {
                self.fetchBackups();
            } else {
                alert((d && d.error) || T('删除失败'));
            }
        }).catch(function() { alert(T('网络错误')); });
    },

    fetchStatus: function() {
        return request.get(L.url('admin/services/adguardhome/status')).then(function(res) {
            return res.json();
        });
    },

    sendAction: function(action) {
        var url = L.url('admin/services/adguardhome/action');
        return request.post(url, { action: action }).then(function(res) {
            return res.json();
        });
    },

    fetchUpdate: function() {
        var proxy = this.getSelectedProxy();
        var url = L.url('admin/services/adguardhome/check_update');
        return request.get(url, { proxy: proxy }).then(function(res) {
            return res.json();
        });
    },

    sendUpgrade: function(force) {
        var proxy = this.getSelectedProxy();
        var url = L.url('admin/services/adguardhome/upgrade');
        return request.post(url, { force: force ? '1' : '0', proxy: proxy }).then(function(res) {
            return res.json();
        });
    },

    sendProxyTest: function(proxy) {
        var url = L.url('admin/services/adguardhome/proxy_test');
        return request.post(url, { proxy: proxy == null ? '' : proxy }).then(function(res) {
            return res.json();
        });
    },

    fetchDashboardUpdate: function() {
        var proxy = this.getSelectedProxy();
        var url = L.url('admin/services/adguardhome/check_dashboard_update');
        return request.get(url, { proxy: proxy }).then(function(res) {
            return res.json();
        });
    },

    sendDashboardUpgrade: function() {
        var proxy = this.getSelectedProxy();
        var url = L.url('admin/services/adguardhome/upgrade_dashboard');
        return request.post(url, { proxy: proxy }).then(function(res) {
            return res.json();
        });
    },

    sendSetProxy: function(proxy) {
        var url = L.url('admin/services/adguardhome/set_proxy');
        return request.post(url, { proxy: proxy == null ? '' : proxy }).then(function(res) {
            return res.json();
        });
    },

    fetchLog: function() {
        return request.get(L.url('admin/services/adguardhome/log')).then(function(res) {
            return res.json();
        });
    },

    load: function() {
        var self = this;
        return Promise.all([
            self.fetchStatus().catch(function() {
                return { installed: false, service_installed: false, running: false, version: T('未知'), port: 3000 };
            }),
            self.fetchLog().catch(function() {
                return { status: '', exec_log: '', system_log: '' };
            })
        ]);
    },

    render: function(data) {
        var status = data[0];
        var logData = data[1];
        this.statusData = status;

        var isBinInstalled = !!status.installed;
        var isServiceInstalled = !!status.service_installed;
        var isRunning = !!status.running;
        var pid = status.pid || '—';
        var versionStr = status.version || T('未知');
        var port = status.port || 3000;
        var targetUrl = isRunning
            ? window.location.protocol + '//' + window.location.hostname + ':' + port
            : '#';

        var self = this;
        var theme = _themeStyles();

        var versionCode = E('code', {}, versionStr);
        this.versionEl = versionCode;

        var runningSpan = E('span', {
            style: isRunning ? 'color:#2dca73;font-weight:bold' : 'color:#e74c3c;font-weight:bold'
        }, isRunning ? T('● 正在运行') + (pid !== '—' ? ' (PID ' + pid + ')' : '') : T('■ 已停止'));
        this.runningEl = runningSpan;

        var portSpan = E('span', {}, String(port));
        this.portEl = portSpan;

        var urlContainer = E('span', {}, isRunning
            ? [E('a', { href: targetUrl, target: '_blank', style: 'font-weight:bold;color:' + theme.linkColor }, targetUrl)]
            : T('服务未启动')
        );
        this.urlEl = urlContainer;

        var latestVersionCode = E('code', { style: 'margin-right:20px' }, T('未检查'));
        this.latestVersionEl = latestVersionCode;

        var checkUpdateBtn = E('button', {
            class: 'btn cbi-button cbi-button-action',
            style: 'margin-right:10px',
            click: function() { self.checkUpdate(); }
        }, T('检查 AdGuardHome 更新'));
        this.checkUpdateBtn = checkUpdateBtn;

        var upgradeBtn = E('button', {
            class: 'btn cbi-button cbi-button-apply',
            style: 'display:none;margin-right:10px',
            click: function() { self.doUpgrade(false); }
        }, T('升级 AdGuardHome'));
        this.upgradeBtn = upgradeBtn;

        var forceBtn = E('button', {
            class: 'btn cbi-button cbi-button-reset',
            style: 'margin-right:10px',
            click: function() { self.doUpgrade(true); }
        }, T('强制重装核心'));
        this.forceBtn = forceBtn;

        /* ── Network proxy control ── */
        var proxyBuiltins = [
            { value: '',                    label: T('直连 (Direct)'), short: 'Direct' },
            { value: 'https://ghfast.top/',   label: 'ghfast.top',       short: 'ghfast.top' },
            { value: 'https://gh-proxy.com/', label: 'gh-proxy.com',     short: 'gh-proxy.com' },
            { value: 'https://kkgithub.com/', label: 'kkgithub.com',     short: 'kkgithub.com' }
        ];
        var proxyRadioEls = [];
        var proxyLatencyEls = {};
        var groupName = this.proxyGroup;

        function makeProxyRow(item, isCustom) {
            var radioEl = E('input', { type: 'radio', name: groupName, value: item.value, 'data-proxy': item.value, 'data-custom': isCustom ? '1' : '0' });
            var latencyEl = E('span', { style: 'font-size:12px; font-weight:bold; margin-left:8px; white-space:nowrap' }, '');
            var testBtn = E('button', {
                class: 'btn cbi-button cbi-button-action',
                style: 'margin-left:8px; padding:2px 8px; font-size:12px'
            }, T('测试'));
            var row;
            if (isCustom) {
                var customInput = E('input', {
                    type: 'text',
                    class: 'cbi-input-text',
                    placeholder: 'https://your-proxy.example.com/',
                    style: 'margin-left:8px; min-width:260px; vertical-align:middle'
                });
                row = E('div', { style: 'display:flex; flex-wrap:wrap; align-items:center; padding:4px 0;' }, [
                    radioEl,
                    E('label', { 'for': groupName + '_custom', style: 'margin-left:4px; margin-right:0' }, T('自定义')),
                    customInput, testBtn, latencyEl
                ]);
                radioEl.id = groupName + '_custom';
                radioEl._customInput = customInput;
                customInput._radioEl = radioEl;
                proxyRadioEls.push({ proxy: '__custom__', radioEl: radioEl, testBtn: testBtn, latencyEl: latencyEl, customInput: customInput });
                proxyLatencyEls['__custom__'] = latencyEl;
                self.proxyCustomInput = customInput;
                self.proxyCustomRadio = radioEl;
            } else {
                row = E('div', { style: 'display:flex; flex-wrap:wrap; align-items:center; padding:4px 0;' }, [
                    radioEl,
                    E('label', { style: 'margin-left:4px; margin-right:0; min-width:140px; display:inline-block' }, item.label),
                    testBtn, latencyEl
                ]);
                proxyRadioEls.push({ proxy: item.value, radioEl: radioEl, testBtn: testBtn, latencyEl: latencyEl });
                proxyLatencyEls[item.value] = latencyEl;
            }
            return row;
        }

        var proxyRows = [];
        for (var i = 0; i < proxyBuiltins.length; i++) { proxyRows.push(makeProxyRow(proxyBuiltins[i], false)); }
        proxyRows.push(makeProxyRow({ value: '', label: T('自定义') }, true));
        this.proxyRadioEls = proxyRadioEls;
        this.proxyLatencyEls = proxyLatencyEls;

        var proxyGlobalTestBtn = E('button', {
            class: 'btn cbi-button cbi-button-action',
            style: 'margin-top:8px'
        }, T('测试所有'));
        this.proxyGlobalTestBtn = proxyGlobalTestBtn;

        var proxyHeader = E('div', { style: 'margin-bottom:10px; font-size:12px; color:#888' },
            T('切换代理后将实时生效，用于核心与面板的检查/升级请求')
        );

        var proxyContainer = E('div', { style: 'padding:15px; background:' + theme.panelBg + '; border:1px solid ' + theme.panelBorder + '; border-radius:4px' }, [proxyHeader]);
        for (var pr = 0; pr < proxyRows.length; pr++) {
            proxyContainer.appendChild(proxyRows[pr]);
        }
        proxyContainer.appendChild(proxyGlobalTestBtn);

        /* ── Panel self-upgrade UI ── */
        var dashCurrVer = status.dashboard_version || T('未知');
        var dashCurrCode = E('code', { style: 'margin-right:20px' }, dashCurrVer);
        this.dashCurrVerEl = dashCurrCode;
        var dashLatestCode = E('code', { style: 'margin-right:20px' }, T('未检查'));
        this.dashLatestVerEl = dashLatestCode;

        var dashCheckBtn = E('button', {
            class: 'btn cbi-button cbi-button-action',
            style: 'margin-right:10px',
            click: function() { self.checkDashboardUpdate(); }
        }, T('检查面板更新'));
        this.dashCheckBtn = dashCheckBtn;

        var dashUpgradeBtn = E('button', {
            class: 'btn cbi-button cbi-button-apply',
            style: 'display:none;margin-right:10px',
            click: function() { self.doDashboardUpgrade(); }
        }, T('升级面板'));
        this.dashUpgradeBtn = dashUpgradeBtn;

        var logPreStyle = 'max-height:240px;overflow-y:auto;padding:10px;background:' + theme.logBg + ';color:' + theme.logColor + ';font-size:12px;line-height:1.4;border-radius:4px;white-space:pre-wrap;word-break:break-all';
        var secStyle = 'margin:16px 0 6px;font-size:13px;font-weight:bold;color:' + theme.mutedColor + ';';

        /* 第一部分：AdGuardHome 状态（固定位置，每次刷新直接清除重载） / Part 1: AGH status (fixed position; cleared + reloaded on every refresh) */
        var statusPre = E('pre', { style: logPreStyle },
            (logData && logData.status && logData.status.trim()) || T('暂无状态'));
        this.statusLogEl = statusPre;

        /* 第二部分：执行/升级日志（固定位置，滚动追加、行数封顶） / Part 2: exec/upgrade log (fixed position; scroll-append, line-capped) */
        var execPre = E('pre', { style: logPreStyle }, (logData && logData.exec_log) || T('暂无日志'));
        this.execLogEl = execPre;
        this.execAccum = (logData && logData.exec_log) || '';
        this.execLast = this.execAccum;

        /* 第三部分：系统/运行日志（固定位置，滚动追加、行数封顶） / Part 3: system/runtime log (fixed position; scroll-append, line-capped) */
        var sysPre = E('pre', { style: logPreStyle }, (logData && logData.system_log) || T('暂无日志'));
        this.sysLogEl = sysPre;
        this.sysAccum = (logData && logData.system_log) || '';
        this.sysLast = this.sysAccum;

        var refreshLogBtn = E('button', {
            class: 'btn cbi-button cbi-button-action',
            style: 'margin-bottom:10px',
            click: function() { self.refreshLog(); }
        }, T('刷新日志'));

        var clearLogBtn = E('button', {
            class: 'btn cbi-button cbi-button-neutral',
            style: 'margin:0 0 10px 8px',
            click: function() { self.clearLog(); }
        }, T('清空日志'));

        var autoRefreshLogLabel = E('label', { style: 'margin:0 0 10px 12px;font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:4px' }, [
            E('input', { type: 'checkbox', click: function(ev) { self.toggleAutoRefreshLog(ev.target.checked); } }),
            T('自动刷新')
        ]);

        var backupsListEl = E('div', { style: 'font-size:12px;line-height:1.6;' }, T('点击「刷新备份」加载列表'));
        this.backupsListEl = backupsListEl;

        var refreshBackupsBtn = E('button', {
            class: 'btn cbi-button cbi-button-action',
            click: function() { self.fetchBackups(); }
        }, T('刷新备份'));

        var node = E('div', { class: 'cbi-map' }, [
            E('h2', {}, T('AdGuard Home 控制中心')),
            E('div', { class: 'cbi-map-descr' }, T('实时状态监控 · 服务控制 · 日志查看 · 一键升级')),

            E('div', { class: 'cbi-section' }, [
                E('h3', {}, T('实时仪表盘')),
                E('table', { class: 'table cbi-section-table', style: 'width:100%; max-width:650px;' }, [
                    E('tr', { class: 'tr' }, [
                        E('td', { class: 'td', style: 'width:32%;font-weight:bold' }, T('核心部署')),
                        E('td', { class: 'td' }, isBinInstalled
                            ? E('span', { style: 'color:#2dca73;font-weight:bold' }, T('✔ 已下载') + ' (' + (status.bin_path || '/opt/AdGuardHome/AdGuardHome') + ')')
                            : E('span', {}, [
                                E('span', { style: 'color:#e74c3c;font-weight:bold' }, T('✖ 未安装')),
                                '  ',
                                E('button', {
                                    class: 'btn cbi-button cbi-button-apply',
                                    style: 'margin-left:8px',
                                    click: function() { self.doInstallCore(); }
                                }, T('下载安装'))
                            ])
                        )
                    ]),
                    E('tr', { class: 'tr' }, [
                        E('td', { class: 'td', style: 'font-weight:bold' }, T('核心版本')),
                        E('td', { class: 'td' }, [versionCode])
                    ]),
                    E('tr', { class: 'tr' }, [
                        E('td', { class: 'td', style: 'font-weight:bold' }, T('服务状态')),
                        E('td', { class: 'td' }, isServiceInstalled
                            ? E('span', { style: 'color:#2dca73' }, T('✔ 已安装系统服务 | ✔ 开机自启已注册'))
                            : E('span', {}, [
                                E('span', { style: 'color:#f39c12;font-weight:bold' }, T('⚠️ 未注册服务')),
                                '  ',
                                E('button', {
                                    class: 'btn cbi-button cbi-button-apply',
                                    style: 'margin-left:8px;background-color:#9b59b6;color:#fff!important;text-shadow:0 -1px 0 rgba(0,0,0,0.3);font-weight:bold',
                                    click: function() { self.execAction('install_service'); }
                                }, T('注册系统服务'))
                            ])
                        )
                    ]),
                    E('tr', { class: 'tr' }, [
                        E('td', { class: 'td', style: 'font-weight:bold' }, T('运行状态')),
                        E('td', { class: 'td' }, [runningSpan])
                    ]),
                    E('tr', { class: 'tr' }, [
                        E('td', { class: 'td', style: 'font-weight:bold' }, T('Web 端口')),
                        E('td', { class: 'td' }, [portSpan])
                    ]),
                    E('tr', { class: 'tr' }, [
                        E('td', { class: 'td', style: 'font-weight:bold' }, T('管理入口')),
                        E('td', { class: 'td' }, [urlContainer])
                    ])
                ])
            ]),

            E('div', { class: 'cbi-section' }, [
                E('h3', {}, T('服务控制台')),
                E('div', { style: 'padding:15px; background:' + theme.panelBg + '; border:1px solid ' + theme.panelBorder + '; border-radius:4px' }, [
                    E('div', { style: 'margin-bottom:12px;' }, [
                        E('strong', {}, T('当前控制模式：')),
                        E('span', { style: isServiceInstalled ? 'color:#2dca73;font-weight:bold' : 'color:#f39c12;font-weight:bold' },
                            isServiceInstalled ? T('Init.d 系统服务级调用') : T('AdGuardHome 二进制直接控制（命令保底）'))
                    ]),
                    E('button', { class: 'btn cbi-button cbi-button-apply', style: 'margin-right:10px', click: function() { self.execAction('start'); } }, T('启动服务')),
                    E('button', { class: 'btn cbi-button cbi-button-action', style: 'margin-right:10px', click: function() { self.execAction('restart'); } }, T('重启服务')),
                    E('button', { class: 'btn cbi-button cbi-button-reset', style: 'margin-right:10px', click: function() { self.execAction('stop'); } }, T('停止服务')),
                    isServiceInstalled ? '' : E('button', { class: 'btn cbi-button cbi-button-apply', style: 'background-color:#9b59b6;color:#ffffff!important; text-shadow:0 -1px 0 rgba(0,0,0,0.3); font-weight:bold', click: function() { self.execAction('install_service'); } }, T('注册系统服务'))
                ])
            ]),

            E('div', { class: 'cbi-section' }, [
                E('h3', {}, T('网络代理')),
                proxyContainer
            ]),

            E('div', { class: 'cbi-section' }, [
                E('h3', {}, T('面板版本')),
                E('div', { style: 'padding:15px; background:' + theme.panelBg + '; border:1px solid ' + theme.panelBorder + '; border-radius:4px' }, [
                    E('div', { style: 'margin-bottom:12px;' }, [
                        E('strong', {}, T('当前面板版本：')),
                        dashCurrCode,
                        E('strong', {}, T('面板最新版本：')),
                        dashLatestCode
                    ]),
                    dashCheckBtn,
                    dashUpgradeBtn
                ])
            ]),

            E('div', { class: 'cbi-section' }, [
                E('h3', {}, T('备份管理')),
                E('div', { style: 'padding:15px; background:' + theme.panelBg + '; border:1px solid ' + theme.panelBorder + '; border-radius:4px' }, [
                    E('div', { style: 'margin-bottom:12px;' }, [
                        refreshBackupsBtn,
                        E('span', { style: 'margin-left:10px; font-size:11px; color:' + theme.mutedColor }, T('列出 /root/agh_backup_* 备份目录，可恢复或删除'))
                    ]),
                    backupsListEl
                ])
            ]),

            E('div', { class: 'cbi-section' }, [
                E('h3', {}, T('AdGuardHome 版本')),
                E('div', { style: 'padding:15px; background:' + theme.panelBg + '; border:1px solid ' + theme.panelBorder + '; border-radius:4px' }, [
                    E('div', { style: 'margin-bottom:12px;' }, [
                        E('strong', {}, T('当前 AdGuardHome 版本：')),
                        E('code', { style: 'margin-right:20px' }, versionStr),
                        E('strong', {}, T('AdGuardHome 最新版本：')),
                        latestVersionCode
                    ]),
                    checkUpdateBtn,
                    upgradeBtn,
                    forceBtn
                ])
            ]),

            E('div', { class: 'cbi-section' }, [
                E('h3', {}, T('日志查看器')),
                E('div', { style: 'padding:15px; background:' + theme.panelBg + '; border:1px solid ' + theme.panelBorder + '; border-radius:4px' }, [
                    refreshLogBtn,
                    clearLogBtn,
                    autoRefreshLogLabel,
                    E('div', { style: secStyle }, T('AdGuardHome 状态')),
                    statusPre,
                    E('div', { style: secStyle }, T('执行 / 升级日志')),
                    execPre,
                    E('div', { style: secStyle }, T('系统 / 运行日志')),
                    sysPre
                ])
            ])
        ]);

        this.rootNode = node;
        this.startPolling();

        /* 代理控件：预填 + 安全事件绑定 / Proxy control: prefill + safe event binding */
        this.prefillProxy(status.proxy || '');
        this.bindProxyEvents();

        // 自动触发核心与面板更新检查 + 加载备份列表 + 自动测试代理连通性（页面加载即测，让用户"心里有数"）
        // Auto-trigger core & panel update checks + load backup list + auto-test proxy connectivity (test on load so the user is informed)
        setTimeout(function() {
            self.checkUpdate();
            self.checkDashboardUpdate();
            self.fetchBackups();
            self.testProxyAll();
        }, 1000);

        return node;
    },

    updateStatusUI: function(status) {
        this.statusData = status;
        var theme = _themeStyles();
        var isRunning = !!status.running;
        var pid = status.pid || '—';
        var versionStr = status.version || T('未知');
        var port = status.port || 3000;

        if (this.versionEl) {
            this.versionEl.textContent = versionStr;
        }

        if (this.runningEl) {
            this.runningEl.textContent = isRunning
                ? T('● 正在运行') + (pid !== '—' ? ' (PID ' + pid + ')' : '')
                : T('■ 已停止');
            this.runningEl.style.color = isRunning ? '#2dca73' : '#e74c3c';
            this.runningEl.style.fontWeight = 'bold';
        }

        if (this.portEl) {
            this.portEl.textContent = String(port);
        }

        if (this.urlEl) {
            this.urlEl.innerHTML = '';
            if (isRunning) {
                var targetUrl = window.location.protocol + '//' + window.location.hostname + ':' + port;
                this.urlEl.appendChild(E('a', { href: targetUrl, target: '_blank', style: 'font-weight:bold;color:' + theme.linkColor }, targetUrl));
            } else {
                this.urlEl.textContent = T('服务未启动');
            }
        }
    },

    /* ── Proxy control logic ── */
    prefillProxy: function(proxy) {
        if (!this.proxyRadioEls) return;
        var builtins = ['', 'https://ghfast.top/', 'https://gh-proxy.com/', 'https://kkgithub.com/'];
        var isBuiltin = false;
        for (var i = 0; i < builtins.length; i++) {
            if (builtins[i] === proxy) { isBuiltin = true; break; }
        }
        if (isBuiltin) {
            for (var j = 0; j < this.proxyRadioEls.length; j++) {
                var r = this.proxyRadioEls[j];
                if (r.proxy === proxy) { r.radioEl.checked = true; break; }
            }
            if (this.proxyCustomInput) { this.proxyCustomInput.value = ''; }
        } else {
            if (this.proxyCustomRadio) { this.proxyCustomRadio.checked = true; }
            if (this.proxyCustomInput) { this.proxyCustomInput.value = proxy || ''; }
        }
    },

    getProxyByKey: function(key) {
        if (key === '__custom__') {
            return this.proxyCustomInput ? (this.proxyCustomInput.value || '').trim() : '';
        }
        return key;
    },

    getSelectedProxy: function() {
        if (!this.proxyRadioEls) return '';
        for (var i = 0; i < this.proxyRadioEls.length; i++) {
            var r = this.proxyRadioEls[i];
            if (r.radioEl && r.radioEl.checked) return this.getProxyByKey(r.proxy);
        }
        return '';
    },

    bindProxyEvents: function() {
        var self = this;
        var items = this.proxyRadioEls || [];
        
        for (var i = 0; i < items.length; i++) {
            (function(r) {
                if (r.testBtn) {
                    r.testBtn.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        self.testProxyOne(r.proxy);
                    });
                }
                /* 切换代理即时持久化：让 check / upgrade 请求真正使用所选代理 / Persist proxy selection on change so check & upgrade requests actually use it */
                if (r.radioEl) {
                    r.radioEl.addEventListener('change', function() {
                        self.sendSetProxy(self.getProxyByKey(r.proxy)).catch(function() {});
                    });
                }
            })(items[i]);
        }

        /* 修复死循环点：改用 input 事件，且绝对不上锁/不触发 focus 递归级联 / Fix infinite-loop point: use the input event instead, and never lock / never trigger focus recursion cascade */
        if (this.proxyCustomInput) {
            var inp = this.proxyCustomInput;
            inp.addEventListener('input', function() {
                if (self.proxyCustomRadio && !self.proxyCustomRadio.checked) {
                    self.proxyCustomRadio.checked = true;
                }
            });
            /* 自定义代理输入提交（失焦/回车）后即时持久化，确保 reload 后仍在 / Persist the custom proxy on commit (blur/Enter) so it survives a page reload */
            inp.addEventListener('change', function() {
                if (self.proxyCustomRadio) self.proxyCustomRadio.checked = true;
                var v = (inp.value || '').trim();
                self.sendSetProxy(v).then(function(d) {
                    if (d && d.success && self.statusData) self.statusData.proxy = v;
                }).catch(function() {});
            });
            inp.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' || e.keyCode === 13) { inp.blur(); }
            });
        }

        if (this.proxyGlobalTestBtn) {
            this.proxyGlobalTestBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                self.testProxyAll();
            });
        }
    },

    _setLatency: function(key, text, color) {
        var el = this.proxyLatencyEls && this.proxyLatencyEls[key];
        if (el) { el.textContent = text; el.style.color = color || ''; }
    },

    testProxyOne: function(key) {
        var self = this;
        var proxy = this.getProxyByKey(key);

        if (key === '__custom__' && !proxy) {
            self._setLatency(key, T('地址不能为空'), '#e74c3c');
            return Promise.resolve();
        }

        this._setLatency(key, T('测试中...'), '#f39c12');
        return this.sendProxyTest(proxy).then(function(data) {
            if (data && data.ok) {
                var ms = (data.latency !== undefined && data.latency !== null) ? Math.round(data.latency) : '?';
                self._setLatency(key, T('可用') + ' (' + ms + T('毫秒') + ')', '#2dca73');
            } else {
                self._setLatency(key, T('不可用'), '#e74c3c');
            }
            return data;
        }).catch(function() {
            self._setLatency(key, T('测试失败'), '#e74c3c');
        });
    },

    testProxyAll: function() {
        var self = this;
        if (this.proxyBusy) return;
        this.proxyBusy = true;

        if (this.proxyGlobalTestBtn) {
            this.proxyGlobalTestBtn.disabled = true;
            this.proxyGlobalTestBtn.textContent = T('测试中...');
        }

        var items = this.proxyRadioEls || [];
        /* 串行：对性能弱的路由器更友好（避免同时 5 个 curl 阻塞 Lua 进程） / Serial: friendlier to weak routers (avoid 5 concurrent curls blocking the Lua process) */
        (function run(i) {
            if (i >= items.length) {
                self.proxyBusy = false;
                if (self.proxyGlobalTestBtn) self.proxyGlobalTestBtn.disabled = false;
                if (self.proxyGlobalTestBtn) self.proxyGlobalTestBtn.textContent = T('测试所有');
                return;
            }
            self.testProxyOne(items[i].proxy).then(function() {
                run(i + 1);
            }).catch(function() {
                run(i + 1);
            });
        })(0);
    },

    /* ── Panel self-upgrade logic ── */
    checkDashboardUpdate: function() {
        var self = this;
        if (this.dashCheckBtn) {
            this.dashCheckBtn.disabled = true;
            this.dashCheckBtn.textContent = T('检查面板更新中...');
        }
        /* 检查过程/结果写入后端 EXEC_LOG，前端轮询日志查看器展示 / check process & result are written to EXEC_LOG; poll the log viewer to show them */
        this.startLogPolling();
        return this.fetchDashboardUpdate().then(function(res) {
            var curr = (res && res.current_version) || T('未知');
            var latest = (res && res.latest_version) || T('未知');
            if (self.dashCurrVerEl) self.dashCurrVerEl.textContent = curr;
            if (self.dashLatestVerEl) {
                if (res && res.need_update) {
                    self.dashLatestVerEl.textContent = latest;
                } else if (res && res.latest_version) {
                    self.dashLatestVerEl.textContent = latest + ' (' + T('面板已是最新版本') + ')';
                } else {
                    self.dashLatestVerEl.textContent = T('检查失败');
                }
            }
            if (self.dashUpgradeBtn && res && res.need_update) {
                self.dashUpgradeBtn.style.display = '';
            } else if (self.dashUpgradeBtn) {
                self.dashUpgradeBtn.style.display = 'none';
            }
        }).catch(function() {
            if (self.dashLatestVerEl) self.dashLatestVerEl.textContent = T('检查失败');
        }).then(function() {
            if (self.dashCheckBtn) {
                self.dashCheckBtn.disabled = false;
                self.dashCheckBtn.textContent = T('检查面板更新');
            }
        });
    },

    doDashboardUpgrade: function() {
        var self = this;
        ui.showModal(E('h4', {}, T('确认升级面板')), [
            E('p', {}, T('将从 GitHub 下载并部署最新版面板文件。期间 LuCI 会短暂重启。')),
            E('div', { style: 'text-align:right; margin-top:15px;' }, [
                E('button', { class: 'btn cbi-button', click: function() { ui.hideModal(); } }, T('取消')),
                E('button', { class: 'btn cbi-button cbi-button-apply', style: 'margin-left:10px', click: function() {
                    ui.hideModal();
                    self.sendDashboardUpgrade().then(function() {
                        ui.addNotification(null, T('升级面板任务已启动，请在下方日志查看器中查看进度'), 'info');
                        self.startDashboardPolling();
                    }).catch(function() {
                        ui.addNotification(null, T('面板升级任务启动失败'), 'error');
                    });
                }}, T('确认升级面板'))
            ])
        ]);
    },

    startDashboardPolling: function() {
        /* startLogPolling 已统一处理 === dashboard upgrade done / FAILED 检测 + 页面刷新 + _autoRefreshPaused 恢复 / startLogPolling already handles === dashboard upgrade done / FAILED detection + page refresh + _autoRefreshPaused restore */
        this.startLogPolling();
    },

    startPolling: function() {
        var self = this;
        if (this.pollInterval) clearInterval(this.pollInterval);
        this.pollInterval = setInterval(function() {
            if (!self.rootNode || !document.body.contains(self.rootNode)) {
                clearInterval(self.pollInterval);
                self.pollInterval = null;
                if (self.logPollInterval) {
                    clearInterval(self.logPollInterval);
                    self.logPollInterval = null;
                }
                return;
            }
            self.fetchStatus().then(function(data) {
                self.updateStatusUI(data);
            }).catch(function() {});
        }, 5000);
    },

    /* 把服务端拉取的 EXEC_LOG 增量合并进累计缓冲区：跨多次检查不丢失历史（除非手动清空） / Merge the pulled EXEC_LOG into the accumulated buffer: history survives across checks (until manual clear) */
    /* 把服务端拉取的某段日志增量合并进该段累计缓冲区，返回 { acc, last }。
       同段内服务端在尾部追加 → 只并入新增；新一轮（服务端被清空重写）→ 整段作为新块追加，避免重复。
       Merge a server-pulled segment into that segment's accumulator; returns { acc, last }.
       Same run (server appends at tail) → merge only the new part; new run (server truncated then rewrote) → append whole block, avoid dupes. */
    _accumPart: function(acc, last, raw) {
        if (raw == null) return { acc: acc, last: last };
        if (raw.length === 0) return { acc: acc, last: raw };
        if (last.length === 0) {
            return { acc: raw, last: raw };
        }
        if (raw.length > last.length && raw.indexOf(last) === 0) {
            /* 同一次运行：服务端日志在末尾追加，只把新增部分并入累计 / same run: server log grew at the tail; merge only the new part */
            acc = acc + raw.slice(last.length);
        } else if (raw === last) {
            /* 无变化 / unchanged */
        } else {
            /* 新一轮（服务端被清空后重新写入）：整段作为新块并入，避免重复 / new run (server truncated then rewrote): append whole block as a new run, avoid duplicates */
            if (!(acc.length >= raw.length && acc.slice(-raw.length) === raw)) {
                acc = acc + "\n" + raw;
            }
        }
        return { acc: acc, last: raw };
    },

    /* 把三段日志分别渲染到固定位置：第一部位直接清除重载；第二、第三部分滚动追加 / Render the three log segments into fixed positions: part 1 clears+reloads; parts 2&3 scroll-append */
    _renderLog: function(data) {
        var self = this;
        if (!data) return;
        /* 第一部分：AdGuardHome 状态 —— 直接清除重载（每次都重新拉取，不累计） / Part 1: AGH status — clear + reload (always re-fetched, not accumulated) */
        if (self.statusLogEl) {
            self.statusLogEl.textContent = (data.status && data.status.trim()) || T('无状态信息');
            self.statusLogEl.scrollTop = self.statusLogEl.scrollHeight;
        }
        /* 第二部分：执行/升级日志 —— 滚动追加（行数封顶） / Part 2: exec/upgrade log — scroll-append (line-capped) */
        if (self.execLogEl) {
            var r2 = self._accumPart(self.execAccum, self.execLast, data.exec_log || '');
            self.execAccum = r2.acc;
            self.execLast = r2.last;
            self.execLogEl.textContent = self._tailLines(self.execAccum, self.MAX_LOG_LINES);
            self.execLogEl.scrollTop = self.execLogEl.scrollHeight;
        }
        /* 第三部分：系统/运行日志 —— 滚动追加（行数封顶） / Part 3: system/runtime log — scroll-append (line-capped) */
        if (self.sysLogEl) {
            var r3 = self._accumPart(self.sysAccum, self.sysLast, data.system_log || '');
            self.sysAccum = r3.acc;
            self.sysLast = r3.last;
            self.sysLogEl.textContent = self._tailLines(self.sysAccum, self.MAX_LOG_LINES);
            self.sysLogEl.scrollTop = self.sysLogEl.scrollHeight;
        }
    },

    /* 取最后 N 行（滚动窗口），避免 DOM 无限增长 / Take the last N lines (scrolling window) to avoid unbounded DOM growth */
    _tailLines: function(text, n) {
        if (!text) return '';
        var lines = text.split("\n");
        if (lines.length <= n) return text;
        return lines.slice(-n).join("\n");
    },

    refreshLog: function() {
        var self = this;
        this.fetchLog().then(function(data) {
            /* 三段各自渲染：第一部分清除重载，第二、三部分滚动追加 / render three segments: part1 clear+reload, parts2&3 scroll-append */
            self._renderLog(data);
        }).catch(function() {
            if (self.statusLogEl) self.statusLogEl.textContent = T('获取日志失败');
        });
    },

    clearLog: function() {
        var self = this;
        request.post(L.url('admin/services/adguardhome/clear_log')).then(function(res) {
            return res.json();
        }).then(function(d) {
            if (d && d.success) {
                /* 仅清视图：执行/升级日志(EXEC_LOG)已由服务端清空并持久；
                   系统/运行日志属系统自身，不在服务端删除，刷新后由 fetchLog 重新拉取继续显示；
                   此处清空当前三段视图并重置前端累计缓冲区（第一部分本就每次重载，无需累计）。
                   [EN] View-only clear: exec/upgrade log (EXEC_LOG) is already cleared & persisted server-side;
                   system/runtime log belongs to the system and is not deleted server-side;
                   after refresh fetchLog re-pulls it. Here we clear the three view segments and reset the
                   accumulators (part 1 is reloaded every time anyway, so it needs no accumulation). */
                if (self.statusLogEl) self.statusLogEl.textContent = "";
                if (self.execLogEl) self.execLogEl.textContent = "";
                if (self.sysLogEl) self.sysLogEl.textContent = "";
                self.execAccum = "";
                self.execLast = "";
                self.sysAccum = "";
                self.sysLast = "";
            } else {
                alert((d && d.error) || T('清空失败'));
            }
        }).catch(function() { alert(T('网络错误')); });
    },

    autoRefreshLogInterval: null,
    _autoRefreshPaused: false,
    toggleAutoRefreshLog: function(enabled) {
        var self = this;
        if (this.autoRefreshLogInterval) {
            clearInterval(this.autoRefreshLogInterval);
            this.autoRefreshLogInterval = null;
        }
        if (enabled) {
            /* 自动刷新：3 秒间隔（与升级时的 2 秒轮询区分，避免冲突） / Auto-refresh: 3s interval (separate from the 2s upgrade poll to avoid conflicts) */
            this.autoRefreshLogInterval = setInterval(function() {
                /* 升级进行中时自动暂停（logPollInterval 已在工作），避免重复请求/覆盖升级通知 / Auto-pause while upgrade is in progress (logPollInterval is already running) to avoid duplicate requests / overwriting the upgrade notice */
                if (self.logPollInterval) return;
                if (self._autoRefreshPaused) return;
                self.refreshLog();
            }, 3000);
        }
    },

    startLogPolling: function() {
        var self = this;
        if (this.logPollInterval) clearInterval(this.logPollInterval);
        /* 升级开始：临时暂停自动刷新，等升级结束再恢复，避免两个定时器同时拉日志 / Upgrade start: temporarily pause auto-refresh, resume after upgrade ends, to avoid two timers pulling logs at once */
        var wasAuto = !!this.autoRefreshLogInterval;
        if (wasAuto) this._autoRefreshPaused = true;
        var pollCount = 0;
        this.logPollInterval = setInterval(function() {
            pollCount++;
            self.fetchLog().then(function(data) {
                /* 三段各自渲染：第一部分清除重载，第二、三部分滚动追加 / render three segments: part1 clear+reload, parts2&3 scroll-append */
                self._renderLog(data);
                if (data && data.exec_log) {
                    /* 完成/失败判定基于执行/升级日志（第二部分）中的标记 / completion/failure detection uses markers in the exec/upgrade log (part 2) */
                    var c = data.exec_log;
                    var done = false;
                    if (c.indexOf('FAILED') !== -1) {
                        done = true;
                        ui.addNotification(null, T('升级失败，已自动回滚；请检查日志与代理设置'), 'error');
                    } else if (c.indexOf('=== core upgrade done') !== -1
                            || c.indexOf('=== dashboard upgrade done') !== -1
                            || c.indexOf('=== core install done') !== -1
                            || c.indexOf('=== Reinstall done') !== -1
                            || c.indexOf('=== Restore from /root/agh_backup') !== -1
                            || c.indexOf('恢复完成（仅面板文件') !== -1) {
                        done = true;
                        ui.addNotification(null, T('升级完成，正在刷新页面...'), 'info');
                        setTimeout(function() {
                            window.location.href = window.location.pathname + '?_t=' + new Date().getTime();
                        }, 2000);
                    } else if (c.indexOf('=== check done ===') !== -1) {
                        /* 检查完成：仅停止轮询，不刷新页面 / check finished: stop polling only, no page refresh */
                        done = true;
                    }
                    if (done) {
                        clearInterval(self.logPollInterval);
                        self.logPollInterval = null;
                        /* 升级结束：恢复用户之前开启的自动刷新 / Upgrade end: resume the auto-refresh the user had enabled */
                        self._autoRefreshPaused = false;
                    }
                }
            }).catch(function() {});
            if (pollCount >= 150) {
                clearInterval(self.logPollInterval);
                self.logPollInterval = null;
                self._autoRefreshPaused = false;
            }
        }, 2000);
    },

    execAction: function(action) {
        var self = this;
        if (this._actionBusy) return;   // 防抖：快速连点忽略 / debounce: ignore rapid repeated clicks
        this._actionBusy = true;
        ui.showModal(E('h4', {}, T('执行中...')), [E('p', { class: 'spinning' }, action)]);
        this.sendAction(action).then(function(res) {
            self._actionBusy = false;
            ui.hideModal();
            if (res && res.success) {
                ui.addNotification(null, T('操作执行成功'), 'info');
                setTimeout(function() {
                    self.fetchStatus().then(function(data) { self.updateStatusUI(data); }).catch(function() {});
                }, 1500);
            } else {
                var msg = (res && res.output) || (res && res.error) || T('未知错误');
                ui.addNotification(null, T('操作失败: ') + msg, 'error');
            }
            /* 按钮点击后重新加载日志三段：第一部分(状态)清除重载，第二、三部分滚动追加 / after a button click, reload the three log segments: part1 clear+reload, parts2&3 scroll-append */
            self.refreshLog();
        }).catch(function(err) {
            self._actionBusy = false;
            ui.hideModal();
            ui.addNotification(null, T('执行异常: ') + (err.message || err), 'error');
            self.refreshLog();
        });
    },

    checkUpdate: function() {
        var self = this;
        if (this.checkUpdateBtn) {
            this.checkUpdateBtn.disabled = true;
            this.checkUpdateBtn.textContent = T('检查 AdGuardHome 更新中...');
        }
        /* 检查过程/结果写入后端 EXEC_LOG，前端轮询日志查看器展示 / check process & result are written to EXEC_LOG; poll the log viewer to show them */
        this.startLogPolling();
        return this.fetchUpdate().then(function(res) {
            var latest = (res && res.latest_version) || T('未知');
            if (self.latestVersionEl) self.latestVersionEl.textContent = latest;
            var current = self.statusData ? (self.statusData.version || '') : '';
            if (latest && latest !== T('未知') && latest !== current && self.upgradeBtn) {
                self.upgradeBtn.style.display = '';
            } else if (latest && latest !== T('未知') && latest === current && self.latestVersionEl) {
                self.latestVersionEl.textContent = latest + ' (' + T('AdGuardHome 已是最新版本') + ')';
            }
        }).catch(function(err) {
            if (self.latestVersionEl) self.latestVersionEl.textContent = T('检查失败');
        }).then(function() {
            if (self.checkUpdateBtn) {
                self.checkUpdateBtn.disabled = false;
                self.checkUpdateBtn.textContent = T('检查 AdGuardHome 更新');
            }
        });
    },

    doInstallCore: function() {
        var self = this;
        ui.showModal(E('h4', {}, T('下载安装 AdGuard Home')), [
            E('p', {}, T('将从 GitHub 官方脚本下载安装 AdGuard Home 核心。安装期间请保持网络连接。')),
            E('div', { style: 'text-align:right; margin-top:15px;' }, [
                E('button', { class: 'btn cbi-button', click: function() { ui.hideModal(); } }, T('取消')),
                E('button', { class: 'btn cbi-button cbi-button-apply', style: 'margin-left:10px', click: function() {
                    ui.hideModal();
                    self.sendAction('install_core').then(function(res) {
                        if (res && res.success) {
                            ui.addNotification(null, T('安装任务已启动，请在下方日志查看器中查看进度'), 'info');
                            self.startLogPolling();
                        } else {
                            ui.addNotification(null, T('安装任务启动失败'), 'error');
                        }
                    }).catch(function() {
                        ui.addNotification(null, T('安装任务启动失败'), 'error');
                    });
                }}, T('确认安装'))
            ])
        ]);
    },

    doUpgrade: function(force) {
        var self = this;
        var title = force ? T('确认强制重装') : T('确认升级');
        var desc = force
            ? T('将强制下载在线最新版本并覆盖安装当前版本。升级期间服务将中断。')
            : T('将下载并安装最新版本的 AdGuard Home 核心。升级期间服务可能短暂中断。');

        ui.showModal(E('h4', {}, title), [
            E('p', {}, desc),
            E('div', { style: 'text-align:right; margin-top:15px;' }, [
                E('button', { class: 'btn cbi-button', click: function() { ui.hideModal(); } }, T('取消')),
                E('button', { class: 'btn cbi-button cbi-button-apply', style: 'margin-left:10px', click: function() {
                    ui.hideModal();
                    self.sendUpgrade(force).then(function() {
                        var msg = force ? T('强制重装任务已启动，请在下方日志查看器中查看进度') : T('升级任务已启动，请在下方日志查看器中查看进度');
                        ui.addNotification(null, msg, 'info');
                        self.startLogPolling();
                    }).catch(function() {
                        ui.addNotification(null, T('升级任务启动失败'), 'error');
                    });
                }}, title)
            ])
        ]);
    },

    handleSaveApply: null,
    handleSave: null,
    handleReset: null
});
