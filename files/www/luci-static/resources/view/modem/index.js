'use strict';
'require view';
'require rpc';
'require poll';
'require ui';

var callStatus    = rpc.declare({ object: 'luci.modem', method: 'status',     params: [] });
var callAtCmd     = rpc.declare({ object: 'luci.modem', method: 'at_cmd',     params: ['cmd'], timeout: 120 });
var callScanPorts = rpc.declare({ object: 'luci.modem', method: 'scan_ports', params: [] });
var callSetPort   = rpc.declare({ object: 'luci.modem', method: 'set_port',   params: ['port'] });

return view.extend({
	_atHistory: [],

	// Lazy load: render the page shell immediately; status fills in async
	load: function() {
		return Promise.resolve(null);
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

	_badge: function(label, color) {
		return E('span', {
			style: 'background:' + color + ';color:#fff;border-radius:4px;' +
			       'padding:2px 8px;font-size:12px;font-weight:600'
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
		return E('div', {
			style: 'background:#fff;border:1px solid #ddd;border-radius:6px;' +
			       'padding:14px 16px;flex:1;min-width:240px'
		}, [
			E('div', { style: 'font-size:11px;font-weight:700;color:#aaa;letter-spacing:.6px;margin-bottom:10px' }, [title]),
			E('table', { style: 'border-collapse:collapse;width:100%' }, rows),
			extra || ''
		]);
	},

	// ── port configuration ─────────────────────────────────────────────────

	_renderPortConfig: function(currentPort) {
		var self = this;

		var portInput = E('input', {
			type: 'text',
			value: currentPort || '',
			placeholder: '/dev/ttyUSB2',
			style: 'flex:1;padding:6px 10px;border:1px solid #ccc;border-radius:4px;' +
			       'font-family:monospace;font-size:13px;max-width:200px'
		});

		var scanResults = E('div', {
			style: 'margin-top:8px;font-size:12px;color:#555;min-height:20px'
		}, ['']);

		var scanBtn = E('button', {
			class: 'btn',
			title: 'Scan /dev/ttyUSB* and /dev/ttyACM* for ports that respond to AT',
			click: function() {
				scanBtn.disabled = true;
				scanBtn.textContent = 'Scanning…';
				scanResults.textContent = '';
				callScanPorts().then(function(r) {
					scanBtn.disabled = false;
					scanBtn.textContent = 'Scan';
					if (!r || !r.ports || !r.ports.length) {
						scanResults.textContent = 'No serial ports found';
						return;
					}
					var atPorts = r.ports.filter(function(p) { return p.at_ok; });
					if (!atPorts.length) {
						scanResults.textContent = 'No AT-capable port found — check modem connection';
						return;
					}
					scanResults.innerHTML = '';
					scanResults.appendChild(document.createTextNode('AT port(s) detected: '));
					atPorts.forEach(function(p) {
						var btn = E('button', {
							class: 'btn',
							style: 'font-size:11px;font-family:monospace;padding:2px 7px;margin-left:4px',
							click: function() { portInput.value = p.port; }
						}, [p.port]);
						scanResults.appendChild(btn);
					});
				}).catch(function() {
					scanBtn.disabled = false;
					scanBtn.textContent = 'Scan';
					scanResults.textContent = 'Scan failed';
				});
			}
		}, 'Scan');

		var saveBtn = E('button', {
			class: 'btn cbi-button-action',
			title: 'Save selected port to /etc/config/modem',
			click: function() {
				var port = portInput.value.trim();
				if (!port) return;
				saveBtn.disabled = true;
				saveBtn.textContent = 'Saving…';
				callSetPort(port).then(function(r) {
					saveBtn.disabled = false;
					if (r && r.ok) {
						saveBtn.textContent = '✓ Saved';
						setTimeout(function() { saveBtn.textContent = 'Save'; }, 2000);
					} else {
						saveBtn.textContent = r && r.error ? r.error : 'Error';
						setTimeout(function() { saveBtn.textContent = 'Save'; }, 3000);
					}
				}).catch(function() {
					saveBtn.disabled = false;
					saveBtn.textContent = 'Save';
				});
			}
		}, 'Save');

		return E('div', {
			style: 'background:#fff;border:1px solid #ddd;border-radius:6px;' +
			       'padding:14px 16px;margin-bottom:16px'
		}, [
			E('div', {
				style: 'font-size:11px;font-weight:700;color:#aaa;letter-spacing:.6px;margin-bottom:10px'
			}, ['PORT CONFIGURATION']),
			E('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, [
				E('span', { style: 'font-size:13px;color:#555;white-space:nowrap' }, ['AT Port']),
				portInput,
				scanBtn,
				saveBtn
			]),
			scanResults
		]);
	},

	// ── status render ──────────────────────────────────────────────────────

	_renderStatus: function(s, container, titleEl) {
		var self = this;

		// Handle Busy state gracefully: keep old cards but show a warning
		var busy = (s && s.error === 'Modem Busy');
		var busyBadge = document.getElementById('modem-busy-badge');

		if (busy) {
			if (!busyBadge) {
				busyBadge = E('div', { id: 'modem-busy-badge', style: 'background:#f39c12;color:#fff;padding:8px 16px;border-radius:4px;margin-bottom:12px;font-weight:600;display:flex;align-items:center' }, [
					E('span', { class: 'spinning', style: 'margin-right:10px' }),
					'Modem is busy processing a long command (e.g. Scanning)...'
				]);
				container.parentNode.insertBefore(busyBadge, container);
			}
			return; // Don't clear or update cards while busy
		} else if (busyBadge) {
			busyBadge.parentNode.removeChild(busyBadge);
		}

		if (!s || (!s.error && !s.manufacturer && !s.model)) {
			container.innerHTML = '';
			container.appendChild(E('div', { style: 'color:#888;padding:12px' },
				['Modem disabled — enable the modem network interface to view status.']));
			return;
		}

		if (s.error && !busy) {
			container.innerHTML = '';
			container.appendChild(E('div', { style: 'color:#c0392b;padding:12px' },
				['Error: ' + s.error]));
			return;
		}

		// Update page title dynamically from modem's own identity
		if (titleEl) {
			var name = [s.manufacturer, s.model].filter(Boolean).join(' ');
			if (name) titleEl.textContent = name;
		}

		var rsrpQ = self._rsrpQuality(s.rsrp);
		var sigQuality = rsrpQ ? self._badge(rsrpQ[0], rsrpQ[1]) : '—';

		var simOk = s.sim_status === 'READY';
		var simBadge = self._badge(
			simOk ? 'Ready' : (s.sim_status || 'Not Inserted'),
			simOk ? '#27ae60' : '#c0392b'
		);

		// When no SIM, suppress misleading "Searching" from registration commands
		var regText = s.registration;
		if (!simOk && s.sim_status && s.sim_status !== 'READY') {
			regText = 'No SIM';
		}
		var regOk = regText && regText.indexOf('Registered') === 0;
		var regBadge = self._badge(
			regText || 'Not Registered',
			regOk ? '#27ae60' : (regText === 'Searching' ? '#f39c12' : '#c0392b')
		);

		var cards = E('div', {
			style: 'display:flex;flex-wrap:wrap;gap:12px;margin-bottom:16px'
		}, [
			self._card('MODULE', [
				self._row('Manufacturer', s.manufacturer),
				self._row('Model',        s.model),
				self._row('Firmware',     s.revision),
				self._row('IMEI',         s.imei),
				self._row('Port',         s.port)
			]),

			self._card('SIM', [
				self._row('Status', simBadge),
				self._row('ICCID',  s.iccid),
				self._row('IMSI',   s.imsi)
			]),

			self._card('NETWORK', [
				self._row('Registration', regBadge),
				self._row('Operator',     s.operator),
				self._row('Technology',   s.technology),
				self._row('Band',         s.band),
				self._row('IP Address',   s.ip)
			]),

			self._card('SIGNAL', [
				self._row('Quality', sigQuality),
				self._row('RSRP', s.rsrp ? s.rsrp + ' dBm' : null, 'Ref Signal Received Power'),
				self._row('RSRQ', s.rsrq ? s.rsrq + ' dB'  : null, 'Ref Signal Received Quality'),
				self._row('SINR', s.sinr ? s.sinr + ' dB'  : null, 'Signal/Interference+Noise Ratio'),
				self._row('RSSI', s.rssi ? s.rssi + ' dBm' : null, 'Received Signal Strength')
			], s.temp_modem
				? E('div', {
					style: 'margin-top:8px;padding-top:8px;border-top:1px solid #eee;font-size:12px;color:#888'
				  }, ['Modem ' + s.temp_modem + '°C' + (s.temp_cpu ? '  ·  CPU ' + s.temp_cpu + '°C' : '')])
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
			placeholder: 'e.g. AT+CGMI',
			style: 'flex:1;padding:6px 10px;border:1px solid #ccc;border-radius:4px;' +
			       'font-family:monospace;font-size:13px',
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
				if (sendBtn.disabled) return;
				var cmd = input.value.trim().toUpperCase();
				if (!cmd) return;
				self._atHistory.push(cmd);
				if (self._atHistory.length > 20) self._atHistory.shift();
				input.value = '';
				sendBtn.disabled = true;
				input.disabled = true;
				sendBtn.textContent = 'Sending…';
				var ts = new Date().toLocaleTimeString();
				output.textContent += '\n[' + ts + '] > ' + cmd + '\n';
				var waitMsg = E('span', { class: 'spinning', style: 'color:#aaa;font-style:italic' }, [' Waiting for modem response...']);
				output.appendChild(waitMsg);
				output.scrollTop = output.scrollHeight;

				callAtCmd(cmd).then(function(r) {
					sendBtn.disabled = false;
					input.disabled = false;
					input.focus();
					sendBtn.textContent = 'Send';
					if (waitMsg.parentNode) waitMsg.parentNode.removeChild(waitMsg);
					if (r && r.response) {
						var resp = r.response;
						var nl = String.fromCharCode(10);
						var lines = resp.split(nl);
						for (var i = lines.length - 1; i >= 0; i--) {
							if (lines[i].trim() === cmd) { resp = lines.slice(i + 1).join(nl).replace(/^[\r\n\s]+/, ''); break; }
						}
						output.textContent += resp + nl;
					} else if (r && r.error)
						output.textContent += 'Error: ' + r.error + '\n';
					output.scrollTop = output.scrollHeight;
				}).catch(function(err) {
					sendBtn.disabled = false;
					input.disabled = false;
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

		// Quick commands with tooltips explaining what each one does
		var quickCmds = [
			{ cmd: 'ATI',          tip: 'Module identity: manufacturer, model and firmware revision' },
			{ cmd: 'AT+CGMI',      tip: 'Manufacturer name — 3GPP standard, works on all modems' },
			{ cmd: 'AT+CGMM',      tip: 'Model number — 3GPP standard, works on all modems' },
			{ cmd: 'AT+CPIN?',     tip: 'SIM card status: READY, NOT INSERTED, SIM PIN, SIM PUK…' },
			{ cmd: 'AT+COPS?',     tip: 'Active network operator, format and access technology (2G/3G/4G/5G)' },
			{ cmd: 'AT+QCSQ',      tip: 'Extended signal quality: RSRP, RSRQ, SINR — Quectel vendor command' },
			{ cmd: 'AT+CESQ',      tip: 'Extended signal quality: RSRP, RSRQ — 3GPP standard (TS 27.007)' },
			{ cmd: 'AT+CSQ',       tip: 'Basic received signal strength (RSSI) — 3GPP, all modems' },
			{ cmd: 'AT+QNWINFO',   tip: 'Current network type and frequency band — Quectel vendor command' },
			{ cmd: 'AT+CEREG?',    tip: 'LTE/NR packet-switched registration status and cell info' },
			{ cmd: 'AT+QTEMP',     tip: 'Module temperature sensors (modem core, CPU…) — Quectel vendor command' },
			{ cmd: 'AT+CGPADDR=1', tip: 'IP address(es) assigned to PDP/EPS/PDU context 1' }
		];

		var quickBar = E('div', {
			style: 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px'
		}, quickCmds.map(function(item) {
			return E('button', {
				class: 'btn',
				title: item.tip,
				style: 'font-size:11px;font-family:monospace;padding:3px 8px',
				click: function() {
					input.value = item.cmd;
					sendBtn.click();
				}
			}, [item.cmd]);
		}));

		return E('div', {
			style: 'background:#fff;border:1px solid #ddd;border-radius:6px;padding:14px 16px'
		}, [
			E('div', {
				style: 'font-size:11px;font-weight:700;color:#aaa;letter-spacing:.6px;margin-bottom:12px'
			}, ['AT TERMINAL']),
			quickBar,
			output,
			E('div', { style: 'display:flex;gap:8px;margin-top:10px;align-items:center' }, [
				input, sendBtn, clearBtn
			])
		]);
	},

	// ── render ────────────────────────────────────────────────────────────

	// ── render ────────────────────────────────────────────────────────────
	render: function() {
		var self = this;

		var titleEl = E('h2', {}, ['5G Modem']);

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
					self._renderStatus(s, statusContainer, titleEl);
					lastUpdate.textContent = 'Updated ' + new Date().toLocaleTimeString();
				});
			}
		}, '↻ Refresh');

		// Kick off async status load immediately — page is already painted
		callStatus().then(function(s) {
			self._renderStatus(s, statusContainer, titleEl);
			lastUpdate.textContent = 'Updated ' + new Date().toLocaleTimeString();
		});

		// Auto-refresh every 20s
		poll.add(function() {
			return callStatus().then(function(s) {
				self._renderStatus(s, statusContainer, titleEl);
				lastUpdate.textContent = 'Updated ' + new Date().toLocaleTimeString();
			});
		}, 20);

		return E('div', {}, [
			titleEl,
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
