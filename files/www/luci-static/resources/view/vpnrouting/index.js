'use strict';
'require view';
'require rpc';
'require dom';
'require poll';

var callGetState   = rpc.declare({ object:'luci.vpnrouting', method:'get_state',    expect:{} });
var callGetExitIPs = rpc.declare({ object:'luci.vpnrouting', method:'get_exit_ips', expect:{} });
var callApplyMode  = rpc.declare({ object:'luci.vpnrouting', method:'apply_mode',   params:['mode'],   expect:{} });
var callConfirmMode= rpc.declare({ object:'luci.vpnrouting', method:'confirm_mode', expect:{} });
var callGetRules   = rpc.declare({ object:'luci.vpnrouting', method:'get_rules',    expect:{} });
var callSaveRules  = rpc.declare({ object:'luci.vpnrouting', method:'save_rules',   params:['rules'],  expect:{} });
var callTestRoute  = rpc.declare({ object:'luci.vpnrouting', method:'test_route',   params:['ip'],     expect:{} });

var MODES = { split:'Split Tunnel', xray_only:'Xray Only', wg_only:'WG Only', direct:'Direct' };
var _rules = [];
var _state = {};
var rollbackTimer = null;

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtBytes(b) {
	b = parseInt(b) || 0;
	if (b < 1024) return b + ' B';
	if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
	if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
	return (b / 1073741824).toFixed(2) + ' GB';
}

function fmtAge(s) {
	s = parseInt(s);
	if (isNaN(s) || s < 0) return 'never';
	if (s < 60)   return s + 's ago';
	if (s < 3600) return Math.floor(s / 60) + 'm ago';
	return Math.floor(s / 3600) + 'h ago';
}

function dot(ok) {
	return E('span', {
		style: 'display:inline-block;width:9px;height:9px;border-radius:50%;flex-shrink:0;margin-right:5px;background:' + (ok ? '#2ecc71' : '#e74c3c')
	});
}

function healthBadge(h) {
	var c = { healthy:['#d5f5e3','#1e8449','Healthy'], degraded:['#fef9e7','#b7950b','Degraded'], broken:['#fdedec','#c0392b','Broken'] }[h]
	     || ['#fef9e7','#b7950b','Unknown'];
	return E('span', { style:'background:'+c[0]+';color:'+c[1]+';border-radius:4px;padding:2px 10px;font-size:12px;font-weight:600' }, [c[2]]);
}

function firstIP(cidr) {
	return (cidr || '').split('/')[0];
}

// ── view ──────────────────────────────────────────────────────────────────────

return view.extend({

	load: function() {
		return Promise.all([callGetState(), callGetRules()]);
	},

	render: function(data) {
		var self    = this;
		_state      = data[0] || {};
		var rulesD  = data[1] || {};
		_rules = (rulesD.rules || []).map(function(r) {
			return { dest: r.dest || '', via: r.via || 'wg', enabled: r.enabled !== false };
		});

		// ── Status cards ──────────────────────────────────────────────────────
		var statusRow = E('div', { id:'vr-status-row', style:'margin-bottom:20px' }, []);
		this._renderStatusCards(statusRow, _state);

		// ── Rollback banner ───────────────────────────────────────────────────
		var rollback = parseInt(_state.rollback_remaining) || 0;
		var rollbackBanner = E('div', {
			id: 'vr-rollback-banner',
			style: 'display:' + (rollback > 0 ? 'flex' : 'none') + ';align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;background:#fef9e7;border:1px solid #f0c040;border-radius:6px;padding:12px 16px;margin-bottom:16px'
		}, [
			E('div', {}, [
				E('span', { style:'font-weight:600;color:#856404' }, ['Safety rollback active — ']),
				E('span', { id:'vr-rollback-cd', style:'color:#856404' }, [rollback + 's']),
				E('span', { style:'color:#856404' }, [' remaining. Settings revert unless confirmed.'])
			]),
			E('button', {
				style: 'background:#27ae60;color:#fff;border:none;border-radius:4px;padding:7px 18px;cursor:pointer;font-weight:600;flex-shrink:0',
				click: function() { self._confirmMode(this); }
			}, ['Confirm — Keep Settings'])
		]);

		// ── Routing table ─────────────────────────────────────────────────────
		var rulesSection = this._buildRulesSection();

		// ── Page ──────────────────────────────────────────────────────────────
		var page = E('div', { style:'font-family:sans-serif;padding:4px;max-width:860px' }, [
			E('div', { style:'display:flex;align-items:center;justify-content:space-between;margin-bottom:18px' }, [
				E('h2', { style:'margin:0;font-size:20px;color:#2c3e50' }, ['VPN Routing']),
				healthBadge(_state.health || 'healthy')
			]),
			rollbackBanner,
			statusRow,
			rulesSection
		]);

		this._loadExitIPs();
		if (rollback > 0) this._startCountdown(rollback);

		// Refresh status cards every 30s without reloading the page
		var self2 = self;
		poll.add(function() {
			return callGetState().then(function(s) {
				_state = s || _state;
				var row = document.getElementById('vr-status-row');
				if (row) self2._renderStatusCards(row, _state);
			});
		}, 30);

		return page;
	},

	// ── Status cards renderer (called on load + every poll) ───────────────────

	_renderStatusCards: function(container, state) {
		var xray     = state.xray || {};
		var wg       = state.wg   || {};
		var xrayOk   = !!xray.running;
		var wgOk     = !!wg.connected;
		var tproxyOk = xray.tproxy === true;
		var tproxyWarn = xrayOk && !tproxyOk;
		var mode     = state.mode || 'split';
		var health   = state.health || 'healthy';

		var xrayCard = E('div', { style:'background:#fff;border:1px solid #ddd;border-radius:6px;padding:14px 16px;flex:1;min-width:200px' }, [
			E('div', { style:'font-size:11px;font-weight:700;color:#aaa;letter-spacing:.6px;margin-bottom:9px' }, ['XRAY VLESS']),
			E('div', { style:'display:flex;align-items:center;font-size:14px;font-weight:600;color:#2c3e50;margin-bottom:8px' }, [
				dot(xrayOk),
				xrayOk ? 'Running' : 'Stopped',
				xray.active_name
					? E('span', { style:'font-weight:400;color:#999;font-size:12px;margin-left:8px' }, [xray.active_name])
					: null
			].filter(Boolean)),
			E('table', { style:'border-collapse:collapse;font-size:12px;width:100%' }, [
				E('tr', {}, [
					E('td', { style:'color:#aaa;padding:2px 10px 2px 0;white-space:nowrap' }, ['TPROXY']),
					E('td', { style:'padding:2px 0' }, [
						tproxyWarn
							? E('span', { style:'color:#c0392b;font-weight:600' }, ['✗ Inactive — LAN traffic NOT proxied'])
							: tproxyOk
								? E('span', { style:'color:#27ae60;font-weight:600' }, ['✓ Active'])
								: E('span', { style:'color:#aaa' }, ['Inactive'])
					])
				]),
				E('tr', {}, [
					E('td', { style:'color:#aaa;padding:2px 10px 2px 0' }, ['Via Xray']),
					E('td', {}, [E('code', { id:'vr-xray-ip', style:'font-size:12px' }, ['checking…'])])
				]),
				E('tr', {}, [
					E('td', { style:'color:#aaa;padding:2px 10px 2px 0' }, ['Direct']),
					E('td', {}, [E('code', { id:'vr-isp-ip', style:'font-size:12px' }, ['checking…'])])
				])
			])
		]);

		var wgCard = E('div', { style:'background:#fff;border:1px solid #ddd;border-radius:6px;padding:14px 16px;flex:1;min-width:200px;display:flex;flex-direction:column;justify-content:space-between' }, [
			E('div', {}, [
				E('div', { style:'font-size:11px;font-weight:700;color:#aaa;letter-spacing:.6px;margin-bottom:9px' }, ['WIREGUARD']),
				E('div', { style:'display:flex;align-items:center;font-size:14px;font-weight:600;color:#2c3e50;margin-bottom:6px' }, [
					dot(wgOk),
					wgOk ? 'Connected' : 'No handshake',
					E('span', { style:'font-weight:400;color:#999;font-size:12px;margin-left:8px' }, [fmtAge(wg.handshake_age)])
				]),
				wg.active_name
					? E('div', { style:'font-size:12px;color:#aaa;margin-bottom:4px' }, [wg.active_name])
					: null
			].filter(Boolean)),
			E('div', { style:'margin-top:10px' }, [
				E('a', {
					href: '/cgi-bin/luci/admin/services/wireguard',
					style: 'font-size:12px;color:#2980b9;text-decoration:none;font-weight:500'
				}, ['Configure WireGuard →'])
			])
		]);

		var modeLabels = { split:'Split Tunnel', xray_only:'Xray Only', wg_only:'WG Only', direct:'Direct' };
		var hColors = { healthy:['#d5f5e3','#1e8449'], degraded:['#fef9e7','#b7950b'], broken:['#fdedec','#c0392b'] };
		var hc = hColors[health] || hColors.degraded;
		var summaryBar = E('div', { style:'display:flex;align-items:center;gap:16px;padding:8px 14px;background:#f9f9f9;border:1px solid #eee;border-radius:6px;font-size:12px;color:#666;flex-wrap:wrap' }, [
			E('span', {}, ['Mode: ', E('strong', {}, [modeLabels[mode] || mode])]),
			E('span', { style:'color:#ddd' }, ['|']),
			E('span', {}, [
				'Health: ',
				E('span', { style:'background:'+hc[0]+';color:'+hc[1]+';border-radius:3px;padding:1px 7px;font-weight:600' }, [
					health.charAt(0).toUpperCase() + health.slice(1)
				])
			]),
			tproxyWarn
				? E('span', { style:'color:#c0392b;font-weight:600' }, ['⚠ Enable Xray to restore TPROXY'])
				: null
		].filter(Boolean));

		while (container.firstChild) container.removeChild(container.firstChild);
		container.appendChild(E('div', { style:'display:flex;gap:14px;flex-wrap:wrap;margin-bottom:10px' }, [xrayCard, wgCard]));
		container.appendChild(summaryBar);

		// Re-fetch exit IPs after each status refresh
		this._loadExitIPs();
	},

	// ── Routing table ─────────────────────────────────────────────────────────

	_buildRulesSection: function() {
		var self = this;
		var mode = _state.mode || 'split';

		var modeSelect = E('select', {
			id: 'vr-mode-select',
			style: 'padding:5px 8px;border:1px solid #ccc;border-radius:4px;font-size:13px;background:#fff'
		}, Object.keys(MODES).map(function(k) {
			return E('option', { value:k, selected: k === mode ? 'selected' : null }, [MODES[k]]);
		}));

		var modeMsg = E('span', { id:'vr-mode-msg', style:'font-size:12px;margin-left:6px' });
		var applyBtn = E('button', {
			style: 'background:#2980b9;color:#fff;border:none;border-radius:4px;padding:5px 14px;cursor:pointer;font-size:13px;font-weight:600;margin-left:4px',
			click: function() { self._applyMode(this, modeSelect, modeMsg); }
		}, ['Apply']);

		var thead = E('thead', {}, [E('tr', {}, [
			E('th', { style:'text-align:left;padding:8px 10px 8px 0;font-size:12px;color:#aaa;font-weight:600;border-bottom:2px solid #eee' }, ['Destination']),
			E('th', { style:'text-align:left;padding:8px 12px;font-size:12px;color:#aaa;font-weight:600;border-bottom:2px solid #eee;width:32%' }, ['Route Via']),
			E('th', { style:'text-align:center;padding:8px 6px;font-size:12px;color:#aaa;font-weight:600;border-bottom:2px solid #eee;width:58px' }, ['Active']),
			E('th', { style:'border-bottom:2px solid #eee;width:110px' }, [])
		])]);

		var tbody = E('tbody', { id:'vr-rules-tbody' });
		this._renderTableBody(tbody);

		var saveMsg = E('span', { id:'vr-save-msg', style:'font-size:13px;margin-left:6px' });

		return E('div', { style:'background:#fff;border:1px solid #ddd;border-radius:6px;overflow:hidden' }, [
			E('div', { style:'display:flex;align-items:center;justify-content:space-between;padding:13px 18px;border-bottom:1px solid #eee;flex-wrap:wrap;gap:10px' }, [
				E('span', { style:'font-weight:600;font-size:14px;color:#333' }, ['Routing Rules']),
				E('div', { style:'display:flex;align-items:center;gap:4px;flex-wrap:wrap' }, [
					E('span', { style:'font-size:12px;color:#888' }, ['Mode:']),
					modeSelect, applyBtn, modeMsg
				])
			]),
			E('div', { style:'padding:0 18px 6px' }, [
				E('table', { style:'border-collapse:collapse;width:100%;font-size:13px' }, [thead, tbody])
			]),
			E('div', { style:'padding:12px 18px 16px;display:flex;align-items:center;flex-wrap:wrap;gap:8px;border-top:1px solid #f5f5f5' }, [
				E('button', {
					style: 'background:#fff;color:#2980b9;border:1px solid #2980b9;border-radius:4px;padding:5px 13px;cursor:pointer;font-size:13px',
					click: function() {
						_rules.push({ dest:'', via:'wg', enabled:true });
						self._renderTableBody(document.getElementById('vr-rules-tbody'));
					}
				}, ['+ Add Rule']),
				E('button', {
					id: 'vr-save-btn',
					style: 'background:#2980b9;color:#fff;border:none;border-radius:4px;padding:5px 13px;cursor:pointer;font-size:13px;font-weight:600',
					click: function() { self._saveRules(this, saveMsg); }
				}, ['Save Rules']),
				saveMsg
			])
		]);
	},

	_renderTableBody: function(tbody) {
		var self  = this;
		var xray  = _state.xray || {};
		var mode  = _state.mode || 'split';
		var bypass = (xray.bypass || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean);

		while (tbody.firstChild) tbody.removeChild(tbody.firstChild);

		function sep(label) {
			return E('tr', {}, [
				E('td', { colspan:'4', style:'padding:10px 0 4px;font-size:11px;color:#bbb;font-weight:700;letter-spacing:.5px;text-transform:uppercase' }, [label])
			]);
		}

		// ── Custom rules ──────────────────────────────────────────────────────
		if (_rules.length > 0) {
			tbody.appendChild(sep('Custom Rules'));
		}

		_rules.forEach(function(rule, i) {
			var destInput = E('input', {
				type: 'text', value: rule.dest,
				placeholder: '192.168.68.0/22',
				style: 'width:100%;box-sizing:border-box;padding:4px 7px;border:1px solid #ddd;border-radius:4px;font-size:12px;font-family:monospace'
			});
			destInput.addEventListener('input', function() { _rules[i].dest = this.value.trim(); });

			var viaSelect = E('select', {
				style: 'width:100%;padding:4px 7px;border:1px solid #ddd;border-radius:4px;font-size:12px;background:#fff'
			}, [
				E('option', { value:'wg',     selected: rule.via === 'wg'     ? 'selected' : null }, ['WireGuard']),
				E('option', { value:'direct', selected: rule.via === 'direct' ? 'selected' : null }, ['Direct (ISP)'])
			]);
			viaSelect.addEventListener('change', function() { _rules[i].via = this.value; });

			var checkbox = E('input', { type:'checkbox', checked: rule.enabled ? 'checked' : null, style:'cursor:pointer;width:15px;height:15px' });
			checkbox.addEventListener('change', function() { _rules[i].enabled = this.checked; });

			var testBtn = E('button', {
				style: 'background:#fff;color:#2980b9;border:1px solid #cce3f7;border-radius:4px;padding:3px 9px;cursor:pointer;font-size:11px;margin-right:5px',
				click: function() { self._testRoute(firstIP(rule.dest), rule.via, this); }
			}, ['Test']);
			var delBtn = E('button', {
				style: 'background:#fff;color:#c0392b;border:1px solid #e0bcbc;border-radius:4px;padding:3px 7px;cursor:pointer;font-size:11px',
				click: function() { _rules.splice(i, 1); self._renderTableBody(document.getElementById('vr-rules-tbody')); }
			}, ['×']);

			tbody.appendChild(E('tr', { style:'border-bottom:1px solid #f8f8f8;opacity:' + (rule.enabled ? '1' : '0.45') }, [
				E('td', { style:'padding:5px 10px 5px 0' }, [destInput]),
				E('td', { style:'padding:5px 12px' }, [viaSelect]),
				E('td', { style:'padding:5px 6px;text-align:center' }, [checkbox]),
				E('td', { style:'padding:5px 0;text-align:right;white-space:nowrap' }, [testBtn, delBtn])
			]));
		});

		// ── Geo bypass (from Xray profile) ───────────────────────────────────
		if (bypass.length > 0) {
			tbody.appendChild(sep('Geo Bypass  ·  from Xray profile'));
			bypass.forEach(function(rule) {
				tbody.appendChild(E('tr', { style:'border-bottom:1px solid #f8f8f8' }, [
					E('td', { style:'padding:7px 10px 7px 0;font-size:12px;font-family:monospace;color:#666' }, [rule]),
					E('td', { style:'padding:7px 12px;font-size:12px;color:#666' }, ['Direct (ISP)']),
					E('td', { style:'padding:7px 6px;text-align:center;font-size:11px;color:#bbb' }, ['config']),
					E('td', { style:'padding:7px 0;text-align:right' }, [
						E('a', {
							style: 'font-size:11px;color:#aaa;text-decoration:none;cursor:pointer',
							click: function(e) {
								e.preventDefault();
								window.location.href = '/cgi-bin/luci/admin/services/xray';
							}
						}, ['edit →'])
					])
				]));
			});
		}

		// ── Default ───────────────────────────────────────────────────────────
		tbody.appendChild(sep('Default'));
		var defDest, defVia, defColor;
		var xrayOk = !!xray.running;
		var wgOk   = !!(_state.wg || {}).connected;

		if (mode === 'split' || mode === 'xray_only') {
			defDest  = 'All other traffic';
			defVia   = xrayOk ? 'Xray VLESS' : 'Direct (ISP) [Xray Stopped]';
			defColor = xrayOk ? '#2980b9' : '#e74c3c';
		} else if (mode === 'wg_only') {
			defDest  = 'All traffic';
			defVia   = wgOk ? 'WireGuard tunnel' : 'Direct (ISP) [WG Down]';
			defColor = wgOk ? '#27ae60' : '#e74c3c';
		} else {
			defDest  = 'All traffic';
			defVia   = 'Direct (ISP)';
			defColor = '#888';
		}
		tbody.appendChild(E('tr', {}, [
			E('td', { style:'padding:8px 10px 10px 0;font-size:13px;color:#aaa;font-style:italic' }, [defDest]),
			E('td', { style:'padding:8px 12px 10px;font-size:13px;font-weight:600;color:' + defColor }, [defVia]),
			E('td'), E('td')
		]));
	},

	// ── Test route ────────────────────────────────────────────────────────────

	_testRoute: function(ip, expectedVia, btn) {
		if (!ip) {
			btn.textContent = '?';
			return;
		}
		btn.disabled = true;
		btn.textContent = '…';
		callTestRoute(ip).then(function(r) {
			btn.disabled = false;
			if (!r || !r.dev) {
				btn.textContent = 'no route';
				btn.style.color = '#e74c3c';
				btn.style.borderColor = '#e0bcbc';
			} else {
				var isWg  = (r.dev === 'wg0');
				var pass  = (expectedVia === 'wg' && isWg) || (expectedVia === 'direct' && !isWg);
				btn.textContent    = (pass ? '✓ ' : '✗ ') + r.dev;
				btn.style.color    = pass ? '#27ae60' : '#e74c3c';
				btn.style.borderColor = pass ? '#a8e6cf' : '#e0bcbc';
			}
			setTimeout(function() {
				btn.textContent = 'Test';
				btn.style.color = '';
				btn.style.borderColor = '';
			}, 5000);
		}).catch(function() {
			btn.disabled = false;
			btn.textContent = 'Test';
		});
	},

	// ── Save rules ────────────────────────────────────────────────────────────

	_saveRules: function(btn, msg) {
		var self  = this;
		var valid = _rules.filter(function(r) { return r.dest && r.dest.trim(); });
		btn.disabled = true;
		btn.textContent = 'Saving…';
		msg.textContent = '';

		callSaveRules(valid).then(function(res) {
			btn.disabled = false;
			btn.textContent = 'Save Rules';
			if (res && res.error) {
				msg.style.color = '#c0392b';
				msg.textContent = 'Error: ' + res.error;
				return;
			}
			_rules = valid;
			self._renderTableBody(document.getElementById('vr-rules-tbody'));
			msg.style.color = '#27ae60';
			msg.textContent = '✓ Saved and applied.';
			setTimeout(function() { msg.textContent = ''; }, 4000);
		}).catch(function() {
			btn.disabled = false;
			btn.textContent = 'Save Rules';
			msg.style.color = '#c0392b';
			msg.textContent = 'Save failed.';
		});
	},

	// ── Apply mode ────────────────────────────────────────────────────────────

	_applyMode: function(btn, modeSelect, msg) {
		var self = this;
		var mode = modeSelect.value;
		btn.disabled = true;
		btn.textContent = 'Applying…';
		msg.textContent = '';

		callApplyMode(mode).then(function(res) {
			btn.disabled = false;
			btn.textContent = 'Apply';
			if (!res || res.error) {
				msg.style.color = '#c0392b';
				msg.textContent = 'Error';
				return;
			}
			_state.mode = mode;
			self._renderTableBody(document.getElementById('vr-rules-tbody'));
			if (res.needs_confirm) {
				var banner = document.getElementById('vr-rollback-banner');
				if (banner) banner.style.display = 'flex';
				var rem = (res.rollback_at > Math.floor(Date.now() / 1000))
					? res.rollback_at - Math.floor(Date.now() / 1000) : 60;
				self._startCountdown(rem);
				msg.style.color = '#856404';
				msg.textContent = 'Applied. Confirm within ' + rem + 's or it reverts.';
			} else {
				msg.style.color = '#27ae60';
				msg.textContent = 'Applied.';
				setTimeout(function() { msg.textContent = ''; }, 3000);
			}
		}).catch(function() {
			btn.disabled = false;
			btn.textContent = 'Apply';
			msg.style.color = '#c0392b';
			msg.textContent = 'Failed.';
		});
	},

	// ── Confirm rollback ──────────────────────────────────────────────────────

	_confirmMode: function(btn) {
		btn.disabled = true;
		btn.textContent = 'Confirming…';
		callConfirmMode().then(function() {
			if (rollbackTimer) { clearInterval(rollbackTimer); rollbackTimer = null; }
			var banner = document.getElementById('vr-rollback-banner');
			if (banner) banner.style.display = 'none';
		}).catch(function() {
			btn.disabled = false;
			btn.textContent = 'Confirm — Keep Settings';
		});
	},

	_startCountdown: function(initial) {
		var remaining = initial;
		if (rollbackTimer) clearInterval(rollbackTimer);
		rollbackTimer = setInterval(function() {
			remaining--;
			var el = document.getElementById('vr-rollback-cd');
			if (el) el.textContent = remaining + 's';
			if (remaining <= 0) {
				clearInterval(rollbackTimer);
				rollbackTimer = null;
				var banner = document.getElementById('vr-rollback-banner');
				if (banner) banner.style.display = 'none';
			}
		}, 1000);
	},

	// ── Exit IPs (async) ─────────────────────────────────────────────────────

	_loadExitIPs: function() {
		callGetExitIPs().then(function(data) {
			var el;
			el = document.getElementById('vr-xray-ip');
			if (el) el.textContent = (data && data.xray) || '—';
			el = document.getElementById('vr-isp-ip');
			if (el) el.textContent = (data && data.isp)  || '—';
		}).catch(function() {
			['vr-xray-ip', 'vr-isp-ip'].forEach(function(id) {
				var el = document.getElementById(id);
				if (el) el.textContent = 'unavailable';
			});
		});
	},

	handleSaveApply: null,
	handleSave:      null,
	handleReset:     null
});
