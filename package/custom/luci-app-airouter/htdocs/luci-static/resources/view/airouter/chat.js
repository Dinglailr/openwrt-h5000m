'use strict';
'require view';
'require rpc';
'require ui';
'require dom';
'require uci';

var callAsk = rpc.declare({
	object: 'luci.airouter',
	method: 'ask',
	params: [ 'message', 'provider' ],
	expect: { reply: '' }
});

var callClear = rpc.declare({
	object: 'luci.airouter',
	method: 'clear',
	expect: { status: '' }
});

/* Lightweight Markdown → HTML renderer */
function renderMarkdown(md) {
	var html = md;

	// Escape HTML entities first
	html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

	// Code blocks (``` ... ```)
	html = html.replace(/```(\w*)\n([\s\S]*?)```/g, function(m, lang, code) {
		return '<pre style="background:#263238;color:#eeffff;padding:10px;border-radius:4px;overflow-x:auto;font-size:13px;"><code>' + code.trim() + '</code></pre>';
	});

	// Inline code
	html = html.replace(/`([^`]+)`/g, '<code style="background:#e8e8e8;padding:2px 5px;border-radius:3px;font-size:13px;">$1</code>');

	// Headers
	html = html.replace(/^#### (.+)$/gm, '<h4 style="margin:8px 0 4px;">$1</h4>');
	html = html.replace(/^### (.+)$/gm, '<h3 style="margin:8px 0 4px;">$1</h3>');
	html = html.replace(/^## (.+)$/gm, '<h2 style="margin:8px 0 4px;font-size:16px;">$1</h2>');
	html = html.replace(/^# (.+)$/gm, '<h1 style="margin:8px 0 4px;font-size:18px;">$1</h1>');

	// Bold + Italic
	html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
	html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
	html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

	// Horizontal rules
	html = html.replace(/^---+$/gm, '<hr style="border:none;border-top:1px solid #ccc;margin:8px 0;">');

	// Tables
	html = html.replace(/^(\|.+\|)\n(\|[-| :]+\|)\n((?:\|.+\|\n?)+)/gm, function(m, header, sep, body) {
		var ths = header.split('|').filter(function(c){return c.trim();}).map(function(c){
			return '<th style="border:1px solid #ccc;padding:4px 8px;background:#e0e0e0;">' + c.trim() + '</th>';
		}).join('');
		var rows = body.trim().split('\n').map(function(row) {
			var tds = row.split('|').filter(function(c){return c.trim();}).map(function(c){
				return '<td style="border:1px solid #ccc;padding:4px 8px;">' + c.trim() + '</td>';
			}).join('');
			return '<tr>' + tds + '</tr>';
		}).join('');
		return '<table style="border-collapse:collapse;margin:8px 0;width:100%;"><thead><tr>' + ths + '</tr></thead><tbody>' + rows + '</tbody></table>';
	});

	// Unordered lists
	html = html.replace(/^[\-\*] (.+)$/gm, '<li style="margin-left:20px;">$1</li>');
	html = html.replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, '<ul style="margin:4px 0;padding-left:10px;">$1</ul>');

	// Ordered lists
	html = html.replace(/^\d+\. (.+)$/gm, '<li style="margin-left:20px;">$1</li>');

	// Line breaks (double newline = paragraph, single = <br>)
	html = html.replace(/\n\n/g, '</p><p style="margin:6px 0;">');
	html = html.replace(/\n/g, '<br>');

	return '<p style="margin:6px 0;">' + html + '</p>';
}

return view.extend({
	load: function() {
		return uci.load('airouter').then(function() {
			var providers = [];
			uci.sections('airouter', 'provider', function(s) {
				providers.push({
					id: s['.name'],
					name: s.name || s['.name'],
					engine: s.engine
				});
			});
			return providers;
		});
	},

	render: function(providers) {
		var providerSelect = E('select', { id: 'provider-select', class: 'cbi-input-select', style: 'margin-bottom: 10px;' });
		if (providers.length === 0) {
			providerSelect.appendChild(E('option', { value: '' }, 'No providers configured! Please go to Settings.'));
			providerSelect.disabled = true;
		} else {
			providers.forEach(function(p) {
				providerSelect.appendChild(E('option', { value: p.id }, p.name + ' (' + p.engine + ')'));
			});
		}

		var container = E('div', { class: 'cbi-map' }, [
			E('h2', {}, 'AI Router Chat'),
			E('div', { class: 'cbi-map-descr' }, 'Chat with the AI agent to manage your router.'),
			E('div', { class: 'cbi-section' }, [
				E('div', {}, [
					E('label', { style: 'font-weight: bold; margin-right: 10px;' }, 'Select Provider: '),
					providerSelect
				]),
				E('div', { 
					id: 'chat-history', 
					style: 'height: 400px; overflow-y: auto; border: 1px solid #ccc; padding: 10px; margin-bottom: 10px; background: #fafafa; border-radius: 4px;' 
				}),
				E('div', { class: 'cbi-value', style: 'display: flex; gap: 10px; align-items: center;' }, [
					E('input', { 
						type: 'text', 
						id: 'chat-input', 
						class: 'cbi-input-text', 
						style: 'flex-grow: 1;', 
						placeholder: 'Type your message...',
						keydown: function(ev) {
							if (ev.key === 'Enter') {
								document.getElementById('btn-send').click();
							}
						}
					}),
					E('button', {
						id: 'btn-send',
						class: 'btn cbi-button-apply',
						click: function(ev) {
							var input = document.getElementById('chat-input');
							var text = input.value.trim();
							var provider = document.getElementById('provider-select').value;
							if (!text || !provider) return;
							
							var chat = document.getElementById('chat-history');
							var userMsg = E('div', { style: 'margin: 5px 0; padding: 8px; border-radius: 5px; background: #e1f5fe; text-align: right;' }, [
								E('strong', {}, 'You:'), E('br'), text
							]);
							chat.appendChild(userMsg);
							
							var thinkMsg = E('div', { style: 'margin: 5px 0; padding: 8px; border-radius: 5px; background: #f0f4c3; text-align: left; font-style: italic; color: #555;' }, 'AI is thinking');
							chat.appendChild(thinkMsg);
							chat.scrollTop = chat.scrollHeight;
							
							var dotCount = 0;
							var thinkTimer = setInterval(function() {
								dotCount = (dotCount + 1) % 4;
								var dots = '';
								for(var j=0; j<dotCount; j++) dots += '.';
								thinkMsg.textContent = 'AI is thinking' + dots;
							}, 400);
							
							input.value = '';
							input.disabled = true;
							ev.target.disabled = true;
							
							callAsk(text, provider).then(function(reply) {
								clearInterval(thinkTimer);
								chat.removeChild(thinkMsg);
								
								input.disabled = false;
								ev.target.disabled = false;
								
								var aiMsg = E('div', { style: 'margin: 5px 0; padding: 8px; border-radius: 5px; background: #f0f4c3; text-align: left;' });
								chat.appendChild(aiMsg);
								
								var header = E('strong', {}, 'AI Agent:');
								var br = E('br');
								var contentDiv = E('div', { class: 'ai-md-content' });
								aiMsg.appendChild(header);
								aiMsg.appendChild(br);
								aiMsg.appendChild(contentDiv);
								
								chat.scrollTop = chat.scrollHeight;
								input.focus();
								
								// Typewriter with progressive markdown rendering
								var words = reply.split(' ');
								var accumulated = '';
								var i = 0;
								var timer = setInterval(function() {
									if (i < words.length) {
										accumulated += (i > 0 ? ' ' : '') + words[i];
										contentDiv.innerHTML = renderMarkdown(accumulated);
										chat.scrollTop = chat.scrollHeight;
										i++;
									} else {
										clearInterval(timer);
										// Final render for completeness
										contentDiv.innerHTML = renderMarkdown(reply);
									}
								}, 30);
							}).catch(function(err) {
								clearInterval(thinkTimer);
								chat.removeChild(thinkMsg);
								
								input.disabled = false;
								ev.target.disabled = false;
								alert('Error: ' + err);
							});
						}
					}, 'Send'),
					E('button', {
						class: 'btn cbi-button-reset',
						click: function() {
							callClear().then(function() {
								document.getElementById('chat-history').innerHTML = '';
								var chat = document.getElementById('chat-history');
								var msg = E('div', { style: 'margin: 5px 0; padding: 8px; border-radius: 5px; background: #f0f4c3; text-align: left;' }, [
									E('strong', {}, 'AI Agent:'), E('br'), 'History cleared.'
								]);
								chat.appendChild(msg);
							});
						}
					}, 'Clear History')
				])
			])
		]);
		return container;
	},
	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
