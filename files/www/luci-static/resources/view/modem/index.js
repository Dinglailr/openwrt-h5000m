'use strict';
'require view';
'require rpc';
'require poll';
'require ui';

var callStatus = rpc.declare({ object: 'luci.modem', method: 'status', params: [] });
var callAtCmd  = rpc.declare({ object: 'luci.modem', method: 'at_cmd',  params: ['cmd'] });

return view.extend({
	_atHistory: [],

	load: function() {
		return callStatus();
	},

	// ── signal quality helpers ─────────────────────────────────────────────

	_rsrpQuality: function(rsrp) {
		var v = parseInt(rsrp);
		if (isNaN(v)) return null;
		if (v >= -80)  return ['Excellent', '#27ae60'];
		if (v >= -90)  return ['Good',      '#2ecc71'];
		if (v >= -100) return ['Fair',      '#f39c12'];
		if (v >= -110) return ['Poor',      '#e67e22'];
		return ['Bad', '#c0392b'];
	},

	_sinrQuality: function(sinr) {
		var v = parseInt(sinr);
		if (isNaN(v)) return null;
		if (v >= 20) return ['Excellent', '#27ae60'];
		if (v >= 13) return ['Good',      '#2ecc71'];
		if (v >= 0)  return ['Fair',      '#f39c12'];
		return ['Poor', '#c0392b'];
	},

	_badge: function(label, color) {
		return E('span', {
			style: 'background:' + color + ';color:#fff;border-radius:4px;padding:2px 8px;font-size:12px;font-weight:600'
		}, [label]);
	},

	_row: function(label, value, hint) {
		return E('tr', {}, [
			E('td', { style: 'color:#888;padding:4px 16px 4px 0;white-space:nowrap;font-size:13px' }, [label]),
			E('td', { style: 'font-size:13px;font-weight:500' }, [value || '—']),
			hint ? E('td', { style: 'color:#aaa;font-size:11px;padding-left:8px' }, [hint]) : E('td')
		]);
	},

	_card: function(title, rows, extra) {
		var trs = rows.map(function(r) { return r; });
		return E('div', {
			style: 'background:#fff;border:1px solid #ddd;border-radius:6px;padding:14px 16px;flex:1;min-width:240px'
		}, [
			E('div', { style: 'font-size:11px;font-weight:700;color:#aaa;letter-spacing:.6px;margin-bottom:10px' }, [title]),
			E('table', { style: 'border-collapse:collapse;width:100%' }, trs),
			extra || ''
		]);
	},

	// ── status render ──────────────────────────────────────────────────────

	_renderStatus: function(s, container) {
		var self = this;
		if (!s || s.error) {
			container.innerHTML = '';
			container.appendChild(E('div', { style: 'color:#c0392b;padding:12px' },
				['Error: ' + (s ? s.error : 'no response from modem')]));
			return;
		}

		var rsrpQ = self._rsrpQuality(s.rsrp);
		var sinrQ = self._sinrQuality(s.sinr);
		var sigQuality = rsrpQ ? self._badge(rsrpQ[0], rsrpQ[1]) : '—';

		// Sim status badge
		var simOk = s.sim_status === 'READY';
		var simBadge = self._badge(
			simOk ? 'Ready' : (s.sim_status || 'Not Inserted'),
			simOk ? '#27ae60' : '#c0392b'
		);

		// Registration badge
		var regOk = s.registration && s.registration.indexOf('Registered') === 0;
		var regBadge = self._badge(
			s.registration || 'Not Registered',
			regOk ? '#27ae60' : (s.registration === 'Searching' ? '#f39c12' : '#c0392b')
		);

		var cards = E('div', {
			style: 'display:flex;flex-wrap:wrap;gap:12px;margin-bottom:16px'
		}, [
			// Module card
			self._card('MODULE', [
				self._row('Model',    s.model),
				self._row('Firmware', s.revision),
				self._row('IMEI',     s.imei),
				self._row('Port',     s.port)
			]),

			// SIM card
			self._card('SIM', [
				self._row('Status', simBadge),
				self._row('ICCID',  s.iccid),
				self._row('IMSI',   s.imsi)
			]),

			// Network card
			self._card('NETWORK', [
				self._row('Registration', regBadge),
				self._row('Operator',     s.operator),
				self._row('Technology',   s.technology),
				self._row('Band',         s.band),
				self._row('IP Address',   s.ip)
			]),

			// Signal card
			self._card('SIGNAL', [
				self._row('Quality', sigQuality),
				self._row('RSRP', s.rsrp ? s.rsrp + ' dBm' : null, 'Ref Signal Received Power'),
				self._row('RSRQ', s.rsrq ? s.rsrq + ' dB'  : null, 'Ref Signal Received Quality'),
				self._row('SINR', s.sinr ? s.sinr + ' dB'  : null, 'Signal to Interference+Noise Ratio'),
				self._row('RSSI', s.rssi ? s.rssi + ' dBm' : null, 'Received Signal Strength')
			], s.temp_modem
				? E('div', { style: 'margin-top:8px;padding-top:8px;border-top:1px solid #eee;font-size:12px;color:#888' },
					['Modem ' + s.temp_modem + '°C' + (s.temp_cpu ? '  ·  CPU ' + s.temp_cpu + '°C' : '')])
				: null
			)
		]);

		container.innerHTML = '';
		container.appendChild(cards);
	},

	// ── AT terminal ───────────────────────────────────────────────────────

	_renderTerminal: function() {
		var self = this;

		var output = E('pre', {
			id: 'at-output',
			style: 'background:#1a1a2e;color:#e0e0e0;font-family:monospace;font-size:13px;' +
			       'padding:12px;border-radius:4px;min-height:200px;max-height:400px;' +
			       'overflow-y:auto;white-space:pre-wrap;word-break:break-all;margin:0'
		}, ['Ready. Enter an AT command below.\n']);

		var input = E('input', {
			type: 'text',
			id: 'at-input',
			placeholder: 'e.g. AT+QCSQ',
			style: 'flex:1;padding:6px 10px;border:1px solid #ccc;border-radius:4px;font-family:monospace;font-size:13px',
			keydown: function(ev) {
				if (ev.key === 'Enter') sendBtn.click();
				if (ev.key === 'ArrowUp') {
					var h = self._atHistory;
					if (h.length) input.value = h[h.length - 1];
				}
			}
		});

		var sendBtn = E('button', {
			class: 'btn cbi-button-action',
			style: 'white-space:nowrap',
			click: function() {
				var cmd = input.value.trim().toUpperCase();
				if (!cmd) return;
				self._atHistory.push(cmd);
				if (self._atHistory.length > 20) self._atHistory.shift();
				input.value = '';
				sendBtn.disabled = true;
				sendBtn.textContent = 'Sending…';
				var ts = new Date().toLocaleTimeString();
				output.textContent += '\n[' + ts + '] > ' + cmd + '\n';
				callAtCmd(cmd).then(function(r) {
					sendBtn.disabled = false;
					sendBtn.textContent = 'Send';
					if (r && r.response) {
						output.textContent += r.response + '\n';
					} else if (r && r.error) {
						output.textContent += 'Error: ' + r.error + '\n';
					}
					output.scrollTop = output.scrollHeight;
				}).catch(function(err) {
					sendBtn.disabled = false;
					sendBtn.textContent = 'Send';
					output.textContent += 'RPC error: ' + err + '\n';
					output.scrollTop = output.scrollHeight;
				});
			}
		}, 'Send');

		var clearBtn = E('button', {
			class: 'btn',
			style: 'white-space:nowrap',
			click: function() { output.textContent = 'Cleared.\n'; }
		}, 'Clear');

		// Quick command buttons
		var quickCmds = ['ATI', 'AT+CPIN?', 'AT+COPS?', 'AT+QCSQ', 'AT+QNWINFO', 'AT+CEREG?', 'AT+QTEMP', 'AT+CGPADDR=1'];
		var quickBar = E('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px' },
			quickCmds.map(function(cmd) {
				return E('button', {
					class: 'btn',
					style: 'font-size:11px;font-family:monospace;padding:3px 8px',
					click: function() {
						input.value = cmd;
						sendBtn.click();
					}
				}, [cmd]);
			})
		);

		return E('div', { style: 'background:#fff;border:1px solid #ddd;border-radius:6px;padding:14px 16px' }, [
			E('div', { style: 'font-size:11px;font-weight:700;color:#aaa;letter-spacing:.6px;margin-bottom:12px' }, ['AT TERMINAL']),
			quickBar,
			output,
			E('div', { style: 'display:flex;gap:8px;margin-top:10px;align-items:center' }, [
				input, sendBtn, clearBtn
			])
		]);
	},

	// ── render ────────────────────────────────────────────────────────────

	render: function(initData) {
		var self = this;

		var statusContainer = E('div', { id: 'modem-status' }, [
			E('div', { style: 'color:#888;padding:12px' }, ['Loading modem status…'])
		]);

		var lastUpdate = E('span', {
			style: 'font-size:11px;color:#aaa;margin-left:12px'
		}, ['']);

		var refreshBtn = E('button', {
			class: 'btn',
			style: 'font-size:12px',
			click: function() {
				lastUpdate.textContent = 'Refreshing…';
				callStatus().then(function(s) {
					self._renderStatus(s, statusContainer);
					lastUpdate.textContent = 'Updated ' + new Date().toLocaleTimeString();
				});
			}
		}, '↻ Refresh');

		// Initial render
		self._renderStatus(initData, statusContainer);
		if (initData && !initData.error)
			lastUpdate.textContent = 'Updated ' + new Date().toLocaleTimeString();

		// Auto-refresh every 20s (status takes ~12s to collect)
		poll.add(function() {
			return callStatus().then(function(s) {
				self._renderStatus(s, statusContainer);
				lastUpdate.textContent = 'Updated ' + new Date().toLocaleTimeString();
			});
		}, 20);

		return E('div', {}, [
			E('h2', {}, ['5G Modem — Quectel RM520N-GL']),
			E('div', { style: 'display:flex;align-items:center;margin-bottom:14px' }, [
				E('span', { style: 'font-size:13px;color:#555' }, ['Status auto-refreshes every 20s']),
				lastUpdate,
				E('span', { style: 'flex:1' }),
				refreshBtn
			]),
			statusContainer,
			E('div', { style: 'margin-top:16px' }, [self._renderTerminal()])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
