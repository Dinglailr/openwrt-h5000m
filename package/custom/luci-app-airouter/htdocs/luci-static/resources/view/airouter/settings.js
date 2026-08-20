'use strict';
'require view';
'require form';
'require uci';

return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('airouter', 'AI Router Settings', 'Configure multiple AI providers here. You can add multiple instances of the same provider type (e.g. multiple OpenAI endpoints). Switch between them in the Chat tab.');

		s = m.section(form.NamedSection, 'settings', 'global', 'Global Settings');
		s.anonymous = true;

		o = s.option(form.TextValue, 'system_prompt', 'System Prompt');
		o.rows = 4;
		o.default = 'You are an AI router assistant built into OpenWrt. You have access to UCI and shell commands. Do NOT ask for permission to run tools to fulfill the user request. ALWAYS use the tools automatically to answer queries. Be concise.';
		o.description = 'The default instruction given to the AI on how to behave.';

		o = s.option(form.TextValue, 'tool_description', 'Shell Tool Description');
		o.rows = 3;
		o.default = 'Run any shell command on the router. Use for diagnostics (ping, traceroute, ifstatus, logread), reading files (cat, head, tail), checking status (uptime, free, df, top, ip, iw, iwinfo), and any other system administration task the user requests.';
		o.description = 'Controls what the AI believes the shell tool can do. Broaden it to unlock more capabilities, or restrict it for safety.';

		o = s.option(form.Flag, 'watchdog_enabled', 'Enable Modem Watchdog');
		o.rmempty = false;
		o.default = '1';
		o.description = 'Automatically restart the modem if it becomes unresponsive (checks every 2 minutes).';

		o = s.option(form.Value, 'watchdog_max_fails', 'Watchdog Failure Threshold');
		o.rmempty = false;
		o.default = '3';
		o.description = 'Number of consecutive failures (checks) before triggering a modem reset.';


		s = m.section(form.GridSection, 'provider', 'AI Providers');
		s.addremove = true;
		s.anonymous = true; 
		s.rowcolors = true;

		o = s.option(form.ListValue, 'engine', 'Engine');
		o.value('openai', 'OpenAI/DeepSeek');
		o.value('anthropic', 'Anthropic');
		o.value('gemini', 'Gemini');

		o = s.option(form.Value, 'name', 'Display Name');
		o.description = 'Name to identify this specific key/instance.';
		o.default = 'My AI Instance';

		o = s.option(form.Value, 'api_key', 'API Key');
		o.password = true;
		o.textvalue = function(section_id) {
			var val = this.cfgvalue(section_id);
			if (val && val.length > 15) {
				return val.substring(0, 8) + '...' + val.substring(val.length - 4);
			}
			return 'Not set';
		};

		o = s.option(form.Value, 'model', 'Model Name');
		o.default = 'gpt-4o-mini';

		o = s.option(form.Value, 'api_base', 'API Base URL');
		o.depends('engine', 'openai');
		o.placeholder = 'https://api.openai.com/v1';
		o.textvalue = function(section_id) {
			var eng = uci.get('airouter', section_id, 'engine');
			if (eng !== 'openai') return '-';
			return this.cfgvalue(section_id) || 'https://api.openai.com/v1';
		};

		return m.render();
	}
});
