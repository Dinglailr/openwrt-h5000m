'use strict';
'require view';
'require form';
'require uci';
'require rpc';
'require fs';

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('ttl'),
			fs.trimmed('/var/run/ttl.status')
		]);
	},

	render: function(data) {
		var ttlStatus = data[1] || 'Unknown';
		var m, s, o;

		m = new form.Map('ttl', 'Network Optimizer', 
			'Optimize your travel router performance and bypass carrier restrictions.');

		s = m.section(form.NamedSection, 'settings', 'ttl', 'TTL Mangling (Stealth Mode)');
		s.description = 'Modify the Time-To-Live (TTL) of outgoing packets to hide tethering usage from mobile carriers.';

		// Status Badge
		o = s.option(form.DummyValue, '_status', 'Current Status');
		o.rawhtml = true;
		o.cfgvalue = function() {
			var color = (ttlStatus && ttlStatus.indexOf('Active') !== -1) ? '#27ae60' : '#7f8c8d';
			return '<span style="background:' + color + ';color:#fff;padding:2px 8px;border-radius:4px;font-weight:bold;">' + ttlStatus + '</span>';
		};

		o = s.option(form.Flag, 'enabled', 'Enable TTL Mangling');
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.Value, 'value', 'TTL Value');
		o.default = '65';
		o.datatype = 'range(1, 255)';
		o.description = 'Common values: 65 (iOS/Android bypass), 128 (Windows default).';
		o.depends('enabled', '1');

		o = s.option(form.MultiValue, 'interface', 'Target Interfaces');
		o.value('wwan', 'Wi-Fi WAN (Travelmate/Repeater)');
		o.value('wan_5g', '5G Modem (Quectel)');
		o.value('eth0', 'Ethernet WAN');
		o.default = ['wwan', 'wan_5g'];
		o.rmempty = false;
		o.description = 'Select one or more interfaces where TTL mangling should be applied.';

		return m.render().then(function(node) {
			var btn = E('button', {
				'class': 'btn cbi-button-apply',
				'click': function() {
					ui.showModal('Applying...', [ E('p', { 'class': 'spinning' }, 'Applying network optimizations...') ]);
					
					// Save, Apply, and then reload after a 3 second delay to account for firewall restart
					uci.save().then(function() {
						return uci.apply();
					}).finally(function() {
						setTimeout(function() {
							ui.hideModal();
							location.reload();
						}, 3000);
					});
				}
			}, 'Apply Optimizations');

			node.appendChild(E('div', { 'class': 'cbi-page-actions' }, [ btn ]));
			return node;
		});
	}
});
