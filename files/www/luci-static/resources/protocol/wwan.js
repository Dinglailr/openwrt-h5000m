'use strict';
'require form';
'require network';

return network.registerProtocol('wwan', {
	getI18n: function() { return _('WWAN (Mobile Broadband)'); },
	getIfname: function() { return this._ubus('l3_device') || 'wwan0'; },
	isFloating: function() { return true; },
	isVirtual: function() { return true; },
	getDevices: function() { return null; },
	containsDevice: function(ifname) {
		return network.getIfnameOf(ifname) == this.getIfname();
	},
	renderFormOptions: function(s) {
		var o;
		o = s.taboption('general', form.Value, 'apn', _('APN'));
		o = s.taboption('general', form.Value, 'pincode', _('PIN'));
		o.datatype = 'and(uinteger,minlength(4),maxlength(8))';
	}
});
