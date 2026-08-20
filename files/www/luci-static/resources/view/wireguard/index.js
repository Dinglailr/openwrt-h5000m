'use strict';
'require view';
'require rpc';
'require ui';
'require poll';

var callStatus   = rpc.declare({ object:'luci.wireguard', method:'status',           expect:{} });
var callEnable   = rpc.declare({ object:'luci.wireguard', method:'enable',            expect:{} });
var callDisable  = rpc.declare({ object:'luci.wireguard', method:'disable',           expect:{} });
var callList     = rpc.declare({ object:'luci.wireguard', method:'list_profiles',     expect:{} });
var callGet      = rpc.declare({ object:'luci.wireguard', method:'get_profile',       params:['id'],  expect:{} });
var callSave     = rpc.declare({ object:'luci.wireguard', method:'save_profile',
  params:['id','name','private_key','address','dns','peer_public_key','endpoint_host','endpoint_port','persistent_keepalive','preshared_key','allowed_ips'],
  expect:{} });
var callDelete   = rpc.declare({ object:'luci.wireguard', method:'delete_profile',   params:['id'],  expect:{} });
var callActivate = rpc.declare({ object:'luci.wireguard', method:'activate_profile', params:['id'],  expect:{} });

// ── helpers ──────────────────────────────────────────────────────────────────

function val(id) {
  var el = document.getElementById(id);
  return el ? el.value.trim() : '';
}
function setVal(id, v) {
  var el = document.getElementById(id);
  if (el) el.value = (v == null ? '' : v);
}

function fmtBytes(b) {
  b = parseInt(b) || 0;
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
  return (b / 1073741824).toFixed(2) + ' GB';
}

function fmtAge(s) {
  s = parseInt(s);
  if (isNaN(s) || s < 0) return 'Never';
  if (s < 60)   return s + 's ago';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  return Math.floor(s / 3600) + 'h ago';
}

function inp(id, label, placeholder, hint, type) {
  return E('div', { class:'cbi-value' }, [
    E('label', { class:'cbi-value-title', for:id }, [label]),
    E('div',   { class:'cbi-value-field' }, [
      E('input', { id:id, class:'cbi-input-text', type: type || 'text',
        style:'width:100%;max-width:440px', placeholder:placeholder }),
      hint ? E('div', { class:'cbi-value-description' }, [hint]) : null
    ].filter(Boolean))
  ]);
}

// ── view ─────────────────────────────────────────────────────────────────────

return view.extend({

  _editing: null,

  load: function() {
    return Promise.all([callStatus(), callList()]);
  },

  // ── Status section ──────────────────────────────────────────────────────

  renderStatus: function(status) {
    var self      = this;
    var connected = !!status.connected;
    var up        = !!status.up;

    return E('div', { class:'cbi-section' }, [
      E('legend', {}, ['Status']),
      E('div',   { class:'cbi-section-node' }, [

        E('div', { style:'display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:16px' }, [
          E('span', {
            id: 'wg-badge',
            class: 'label ' + (connected ? 'success' : up ? 'warning' : 'danger'),
            style: 'font-size:1em;padding:5px 14px'
          }, [connected ? '● CONNECTED' : up ? '○ NO HANDSHAKE' : '○ DOWN']),
          status.active_name
            ? E('span', { style:'color:#888;font-size:.9em' }, ['Profile: ' + status.active_name])
            : (!status.has_profiles
                ? E('span', { style:'color:#e74c3c;font-size:.9em' }, ['No profiles configured'])
                : E('span', { style:'color:#888;font-size:.9em' }, ['No profile active']))
        ]),

        E('table', { class:'table', style:'margin-bottom:16px' }, [
          E('tr', { class:'tr' }, [
            E('td', { class:'td left', style:'width:180px;font-weight:600' }, ['Endpoint']),
            E('td', { class:'td' }, [E('code', { id:'wg-endpoint' }, [status.endpoint || '—'])])
          ]),
          E('tr', { class:'tr' }, [
            E('td', { class:'td left', style:'font-weight:600' }, ['Last Handshake']),
            E('td', { class:'td' }, [E('span', { id:'wg-age' }, [fmtAge(status.handshake_age)])])
          ]),
          E('tr', { class:'tr' }, [
            E('td', { class:'td left', style:'font-weight:600' }, ['Traffic']),
            E('td', { class:'td' }, [
              E('span', { id:'wg-traffic' }, [
                '↑ ' + fmtBytes(status.tx) + '  ↓ ' + fmtBytes(status.rx)
              ])
            ])
          ])
        ]),

        E('div', { style:'display:flex;gap:10px;flex-wrap:wrap' }, [
          E('button', {
            id: 'wg-btn-enable',
            class: 'btn cbi-button cbi-button-apply',
            disabled: up,
            click: ui.createHandlerFn(this, 'handleEnable')
          }, ['Enable']),
          E('button', {
            id: 'wg-btn-disable',
            class: 'btn cbi-button cbi-button-reset',
            disabled: !up,
            click: ui.createHandlerFn(this, 'handleDisable')
          }, ['Disable']),
          E('button', {
            class: 'btn cbi-button',
            click: ui.createHandlerFn(this, 'handleRefresh')
          }, ['↻ Refresh'])
        ])

      ])
    ]);
  },

  // ── Profile table ───────────────────────────────────────────────────────

  renderProfileTable: function(profiles, activeId) {
    var self = this;
    var rows = profiles.map(function(p) {
      var isActive = (p.id === activeId);
      return E('tr', { class:'tr' }, [
        E('td', { class:'td left' }, [
          isActive ? E('span', { style:'color:#27ae60;margin-right:6px' }, ['★']) : null,
          E('strong', {}, [p.name])
        ]),
        E('td', { class:'td' }, [p.endpoint_host + ' : ' + p.endpoint_port]),
        E('td', { class:'td' }, [
          isActive
            ? E('span', { class:'label success', style:'font-size:.78em;padding:2px 8px' }, ['ACTIVE'])
            : E('button', {
                class: 'btn cbi-button cbi-button-apply',
                style: 'padding:3px 10px;font-size:.85em',
                click: ui.createHandlerFn(self, 'handleActivate', p.id, p.name)
              }, ['Use'])
        ]),
        E('td', { class:'td', style:'white-space:nowrap' }, [
          E('button', {
            class: 'btn cbi-button',
            style: 'padding:3px 10px;font-size:.85em;margin-right:4px',
            click: ui.createHandlerFn(self, 'handleEdit', p.id)
          }, ['Edit']),
          E('button', {
            class: 'btn cbi-button cbi-button-negative',
            style: 'padding:3px 10px;font-size:.85em',
            click: ui.createHandlerFn(self, 'handleDelete', p.id, p.name, isActive)
          }, ['Delete'])
        ])
      ]);
    });

    return E('div', { class:'cbi-section' }, [
      E('legend', {}, ['Profiles']),
      E('div',   { class:'cbi-section-node' }, [

        rows.length === 0
          ? E('p', { style:'color:#888' }, ['No profiles yet. Add one below.'])
          : E('table', { class:'table' }, [
              E('tr', { class:'tr cbi-rowstyle-1' }, [
                E('th', { class:'th left' }, ['Name']),
                E('th', { class:'th' },      ['Server']),
                E('th', { class:'th' },      ['']),
                E('th', { class:'th' },      ['Actions'])
              ])
            ].concat(rows)),

        E('div', { style:'margin-top:12px' }, [
          E('button', {
            class: 'btn cbi-button cbi-button-add',
            click: ui.createHandlerFn(this, 'handleNew')
          }, ['+ Add Profile'])
        ])

      ])
    ]);
  },

  // ── Edit/Add form ───────────────────────────────────────────────────────

  renderForm: function(profile) {
    var self  = this;
    var isNew = !profile || !profile.id;
    var title = isNew ? 'Add Profile' : 'Edit — ' + (profile.name || '');

    return E('div', { id:'wg-form-section', class:'cbi-section' }, [
      E('legend', {}, [title]),
      E('div',   { class:'cbi-section-node' }, [

        inp('wf-name',      'Profile Name',          'e.g. BandwagonHost VPS (LA)',
          'A friendly label shown in the profile list'),
        inp('wf-privkey',   'Private Key',           'base64-encoded WireGuard private key',
          'Your WireGuard interface private key (from the [Interface] section of your .conf file)'),
        inp('wf-addr',      'Client Address',        '10.0.0.2/24',
          'IP address assigned to this WireGuard interface (Address in [Interface])'),
        inp('wf-dns',       'DNS',                   '1.1.1.1, 8.8.8.8',
          'Comma or space separated DNS servers'),
        inp('wf-pubkey',    'Peer Public Key',       'base64-encoded server public key',
          'Server\'s WireGuard public key (PublicKey in [Peer])'),
        inp('wf-endpoint',  'Endpoint Host',         'vpn.example.com or IP',
          'Server hostname or IP (Endpoint in [Peer], without the port)'),
        inp('wf-port',      'Endpoint Port',         '51820', null),
        inp('wf-keepalive', 'Persistent Keepalive',  '25',
          'Recommended: 25 seconds for NAT traversal'),
        inp('wf-psk',       'Preshared Key',         '(optional)',
          'Optional pre-shared key for additional security (PresharedKey in [Peer])'),
        inp('wf-allowed-ips', 'Allowed IPs',         '10.0.0.0/24, 192.168.68.0/24',
          'Comma-separated subnets to route through this tunnel. Use 0.0.0.0/0 to route all traffic.'),

        E('div', { class:'cbi-value' }, [
          E('div', { class:'cbi-value-field' }, [
            E('div', { style:'display:flex;gap:10px;flex-wrap:wrap;align-items:center' }, [
              E('button', {
                id: 'wf-btn-save',
                class: 'btn cbi-button cbi-button-apply',
                click: ui.createHandlerFn(this, '_handleSave', isNew ? null : profile.id)
              }, [isNew ? 'Save Profile' : 'Save Changes']),
              E('button', {
                class: 'btn cbi-button',
                click: ui.createHandlerFn(this, 'handleCancelEdit')
              }, ['Cancel']),
              E('span', { id:'wf-msg', style:'color:#888;font-size:.9em' }, [''])
            ])
          ])
        ])

      ])
    ]);
  },

  _fillForm: function(p) {
    setVal('wf-name',      p.name                 || '');
    setVal('wf-privkey',   p.private_key          || '');
    setVal('wf-addr',      p.address              || '');
    setVal('wf-dns',       (p.dns || '1.1.1.1 8.8.8.8').replace(/ /g, ', '));
    setVal('wf-pubkey',    p.peer_public_key       || '');
    setVal('wf-endpoint',  p.endpoint_host        || '');
    setVal('wf-port',      p.endpoint_port        || '51820');
    setVal('wf-keepalive',   p.persistent_keepalive                  || '25');
    setVal('wf-psk',         p.preshared_key                         || '');
    setVal('wf-allowed-ips', (p.allowed_ips || '10.0.0.0/24').replace(/,/g, ', '));
  },

  // ── Handlers ────────────────────────────────────────────────────────────

  handleEnable: function() {
    var self = this;
    var btn  = document.getElementById('wg-btn-enable');
    if (btn) { btn.disabled = true; btn.textContent = 'Enabling…'; }
    return callEnable().then(function() { return self.refreshStatus(); });
  },

  handleDisable: function() {
    var self = this;
    var btn  = document.getElementById('wg-btn-disable');
    if (btn) { btn.disabled = true; btn.textContent = 'Disabling…'; }
    return callDisable().then(function() { return self.refreshStatus(); });
  },

  handleRefresh: function() {
    return this.refreshStatus();
  },

  handleNew: function() {
    this._editing = 'new';
    var existing = document.getElementById('wg-form-section');
    if (existing) existing.parentNode.removeChild(existing);
    var form = this.renderForm(null);
    document.getElementById('wg-profile-anchor').appendChild(form);
    setVal('wf-port',        '51820');
    setVal('wf-keepalive',   '25');
    setVal('wf-dns',         '1.1.1.1, 8.8.8.8');
    setVal('wf-allowed-ips', '10.0.0.0/24');
    var el = document.getElementById('wf-name');
    if (el) el.focus();
  },

  handleEdit: function(id) {
    var self = this;
    this._editing = id;
    return callGet(id).then(function(p) {
      if (p && p.error) { ui.addNotification(null, E('p', [p.error]), 'danger'); return; }
      var existing = document.getElementById('wg-form-section');
      if (existing) existing.parentNode.removeChild(existing);
      p.id = id;
      var form = self.renderForm(p);
      document.getElementById('wg-profile-anchor').appendChild(form);
      self._fillForm(p);
    });
  },

  handleCancelEdit: function() {
    this._editing = null;
    var existing = document.getElementById('wg-form-section');
    if (existing) existing.parentNode.removeChild(existing);
  },

  _handleSave: function(existingId) {
    var btn  = document.getElementById('wf-btn-save');
    var msg  = document.getElementById('wf-msg');
    var name    = val('wf-name');
    var privkey = val('wf-privkey');
    var addr    = val('wf-addr');
    var pubkey  = val('wf-pubkey');
    var endpoint= val('wf-endpoint');

    if (!name || !privkey || !addr || !pubkey || !endpoint) {
      ui.addNotification(null, E('p', ['Name, Private Key, Address, Peer Public Key and Endpoint Host are required.']), 'danger');
      return;
    }

    var port       = parseInt(val('wf-port'))      || 51820;
    var keepalive  = parseInt(val('wf-keepalive')) || 25;
    var dns        = val('wf-dns')        || '1.1.1.1, 8.8.8.8';
    var psk        = val('wf-psk');
    var allowedIps = val('wf-allowed-ips') || '10.0.0.0/24';

    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    if (msg) msg.textContent = '';

    var self = this;
    return callSave(existingId || '', name, privkey, addr, dns, pubkey, endpoint, port, keepalive, psk, allowedIps)
      .then(function(r) {
        if (r && r.error) {
          ui.addNotification(null, E('p', [r.error]), 'danger');
          if (btn) { btn.disabled = false; btn.textContent = existingId ? 'Save Changes' : 'Save Profile'; }
          return;
        }
        if (msg) msg.textContent = 'Saved — reloading…';
        setTimeout(function() { window.location.reload(); }, 800);
      })
      .catch(function(e) {
        ui.addNotification(null, E('p', [String(e)]), 'danger');
        if (btn) { btn.disabled = false; btn.textContent = existingId ? 'Save Changes' : 'Save Profile'; }
      });
  },

  handleDelete: function(id, name, isActive) {
    if (!window.confirm(
      (isActive ? '⚠ This is the active profile. The tunnel will go down.\n\n' : '') +
      'Delete profile "' + name + '"?'
    )) return;
    return callDelete(id).then(function(r) {
      if (r && r.error) { ui.addNotification(null, E('p', [r.error]), 'danger'); return; }
      window.location.reload();
    });
  },

  handleActivate: function(id, name) {
    if (!window.confirm('Switch to profile "' + name + '"?\n\nThe WireGuard tunnel will reconnect.')) return;
    var btns = document.querySelectorAll('button');
    var useBtn = null;
    for (var i = 0; i < btns.length; i++) {
      if (btns[i].textContent === 'Use') { useBtn = btns[i]; break; }
    }
    if (useBtn) { useBtn.disabled = true; useBtn.textContent = 'Switching…'; }
    return callActivate(id).then(function(r) {
      if (r && r.error) {
        ui.addNotification(null, E('p', [r.error]), 'danger');
        if (useBtn) { useBtn.disabled = false; useBtn.textContent = 'Use'; }
        return;
      }
      ui.addNotification(null, E('p', ['Profile activated. WireGuard reconnecting…']), 'success');
      window.location.reload();
    });
  },

  // ── Live status refresh ──────────────────────────────────────────────────

  refreshStatus: function() {
    return callStatus().then(function(s) {
      var connected = !!s.connected;
      var up        = !!s.up;

      var badge = document.getElementById('wg-badge');
      if (badge) {
        badge.textContent = connected ? '● CONNECTED' : up ? '○ NO HANDSHAKE' : '○ DOWN';
        badge.className   = 'label ' + (connected ? 'success' : up ? 'warning' : 'danger');
      }
      var el;
      el = document.getElementById('wg-endpoint');
      if (el) el.textContent = s.endpoint || '—';
      el = document.getElementById('wg-age');
      if (el) el.textContent = fmtAge(s.handshake_age);
      el = document.getElementById('wg-traffic');
      if (el) el.textContent = '↑ ' + fmtBytes(s.tx) + '  ↓ ' + fmtBytes(s.rx);

      var btnEn  = document.getElementById('wg-btn-enable');
      var btnDis = document.getElementById('wg-btn-disable');
      if (btnEn)  { btnEn.disabled  = up;  btnEn.textContent  = 'Enable'; }
      if (btnDis) { btnDis.disabled = !up; btnDis.textContent = 'Disable'; }
    });
  },

  // ── Top-level render ────────────────────────────────────────────────────

  render: function(data) {
    var self     = this;
    var status   = data[0] || {};
    var profiles = (data[1] && data[1].profiles) ? data[1].profiles : [];
    var activeId = status.active || '';

    var page = E('div', { class:'cbi-map' }, [
      E('h2', { class:'cbi-map-title' }, ['WireGuard']),
      E('div', { class:'cbi-map-descr' }, ['Multi-profile WireGuard tunnel manager']),
      this.renderStatus(status),
      this.renderProfileTable(profiles, activeId),
      E('div', { id:'wg-profile-anchor' })
    ]);

    poll.add(function() { return self.refreshStatus(); }, 15);

    return page;
  },

  handleSaveApply: null,
  handleSave:      null,
  handleReset:     null
});
