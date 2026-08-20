'use strict';
'require rpc';
'require form';
'require network';

var callFileList = rpc.declare({
	object: 'file',
	method: 'list',
	params: ['path'],
	expect: { entries: [] },
	filter: function(list, params) {
		var rv = [];
		for (var i = 0; i < list.length; i++)
			if (list[i].name.match(/^cdc-wdm/))
				rv.push(params.path + list[i].name);
		return rv.sort();
	}
});

network.registerPatternVirtual(/^wwan\d+$/);

return network.registerProtocol('mbim', {
	getI18n: function() { return _('ModemManager (MBIM)'); },
	getIfname: function() { return this._ubus('l3_device') || 'wwan0'; },
	getPackageName: function() { return 'umbim'; },
	isFloating: function() { return true; },
	isVirtual: function() { return true; },
	getDevices: function() { return null; },
	containsDevice: function(ifname) {
		return network.getIfnameOf(ifname) == this.getIfname();
	},
	renderFormOptions: function(s) {
		var o;
		o = s.taboption('general', form.Value, '_modem_device', _('Modem device'));
		o.ucioption = 'device';
		o.rmempty = false;
		o.load = function(section_id) {
			return callFileList('/dev/').then(L.bind(function(devices) {
				for (var i = 0; i < devices.length; i++)
					this.value(devices[i]);
				return form.Value.prototype.load.apply(this, [section_id]);
			}, this));
		};
		o = s.taboption('general', form.Value, 'apn', _('APN'));
		o.rmempty = false;
		o = s.taboption('general', form.Value, 'pincode', _('PIN'));
		o.datatype = 'and(uinteger,minlength(4),maxlength(8))';
		o = s.taboption('advanced', form.Value, 'mtu', _('Override MTU'));
		o.placeholder = '1500';
		o.datatype = 'max(9200)';
	}
});
