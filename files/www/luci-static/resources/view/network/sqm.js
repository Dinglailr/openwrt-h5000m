'use strict';
'require fs';
'require ui';
'require rpc';
'require uci';
'require view';
'require form';
'require tools.widgets as widgets';

return view.extend({
	handleEnableSQM: rpc.declare({
		object: 'luci',
		method: 'setInitAction',
		params: ['sqm', 'enable'],
		expect: { result: false }
	}),

	load: function() {
		return Promise.all([
			L.resolveDefault(fs.list('/var/run/sqm/available_qdiscs'), []),
			L.resolveDefault(fs.list('/usr/lib/sqm'), []).then(function(scripts) {
				var tasks = [];
				for (var i = 0; i < scripts.length; i++)
					if (scripts[i].name.endsWith('.qos')) tasks.push(scripts[i].name);
				return tasks;
			}),
			uci.load('sqm')
		]);
	},

	render: function(data) {
		var qdiscs = data[0], scripts = data[1];
		var m, s, o;

		m = new form.Map('sqm', _('Smart Queue Management'));

		s = m.section(form.TypedSection, 'queue');
		s.anonymous = true; s.addremove = true;

		s.tab('tab_basic',     _('Basic Settings'));
		s.tab('tab_qdisc',     _('Queue Discipline'));
		s.tab('tab_linklayer', _('Link Layer'));
		s.tab('tab_calibrate', _('Auto-Calibration'));

		o = s.taboption('tab_basic', form.Flag, 'enabled', _('Enable SQM'));
		o.rmempty = false;

		o = s.taboption('tab_basic', widgets.DeviceSelect, 'interface', _('Interface'));
		o.rmempty = false;

		o = s.taboption('tab_basic', form.Value, 'download', _('Download (kbps)'));
		o = s.taboption('tab_basic', form.Value, 'upload', _('Upload (kbps)'));

		o = s.taboption('tab_calibrate', form.Flag, 'cal_enabled', _('Auto-Tune on Connect'));
		o.default = '0';

		o = s.taboption('tab_calibrate', form.Value, 'cal_scale', _('Scale (%)'));
		o.datatype = 'range(50,100)'; o.default = '90'; o.depends('cal_enabled', '1');

		o = s.taboption('tab_calibrate', form.Value, 'cal_test_secs', _('Test Time (s)'));
		o.datatype = 'range(5,60)'; o.default = '12'; o.depends('cal_enabled', '1');

		o = s.taboption('tab_calibrate', form.Button, '_run', _('Manual Start'));
		o.inputtitle = _('▶ Run Calibration Now');
		o.inputstyle = 'apply';
		o.depends('enabled', '1');
		o.onclick = L.bind(function(ev, section_id) {
			var iface = uci.get('sqm', section_id, 'interface');
			if (!iface) return ui.addNotification(null, E('p', {}, [_('Please select an interface and Save first.')]), 'error');
			
			var btn = ev.target;
			btn.disabled = true;
			
			return fs.exec('/bin/sh', ['-c', '/etc/sqm/calibrate.sh ' + iface + ' &']).then(function() {
				var timeLeft = 35;
				var timer = setInterval(function() {
					timeLeft--;
					btn.textContent = _('Calibrating... ') + timeLeft + 's';
					if (timeLeft <= 0) {
						clearInterval(timer);
						location.reload();
					}
				}, 1000);
				ui.addNotification(null, E('p', {}, [_('Calibration started for ') + iface + _('. Please wait 35 seconds.')]), 'info');
			});
		}, this);

		o = s.taboption('tab_qdisc', form.ListValue, 'qdisc', _('Discipline'));
		for (var i = 0; i < qdiscs.length; i++) o.value(qdiscs[i].name);
		o.default = 'cake';

		o = s.taboption('tab_qdisc', form.ListValue, 'script', _('Script'));
		for (i = 0; i < scripts.length; i++) o.value(scripts[i]);
		o.default = 'piece_of_cake.qos';

		o = s.taboption('tab_linklayer', form.ListValue, 'linklayer', _('Link Layer'));
		o.value('none', 'None'); o.value('ethernet', 'Ethernet'); o.default = 'none';

		o = s.taboption('tab_linklayer', form.Value, 'overhead', _('Overhead (bytes)'));
		o.depends('linklayer', 'ethernet');

		return m.render();
	}
});
