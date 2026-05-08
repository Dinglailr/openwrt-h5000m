'use strict';
'require view';
'require rpc';
'require ui';
'require poll';

var callStatus   = rpc.declare({ object:'luci.xray', method:'status',           expect:{'':{}}, });
var callEnable   = rpc.declare({ object:'luci.xray', method:'enable',            expect:{'':{}}, });
var callDisable  = rpc.declare({ object:'luci.xray', method:'disable',           expect:{'':{}}, });
var callExitIP   = rpc.declare({ object:'luci.xray', method:'get_exit_ip',       expect:{'':{}}, });
var callList     = rpc.declare({ object:'luci.xray', method:'list_profiles',     expect:{'':{}}, });
var callGet      = rpc.declare({ object:'luci.xray', method:'get_profile',       params:['id'],  expect:{'':{}}, });
var callSave     = rpc.declare({ object:'luci.xray', method:'save_profile',
  params:['id','name','address','port','uuid','public_key','short_id','server_name','fingerprint','direct_ip','direct_domain'],
  expect:{'':{}}, });
var callDelete   = rpc.declare({ object:'luci.xray', method:'delete_profile',    params:['id'],  expect:{'':{}}, });
var callActivate = rpc.declare({ object:'luci.xray', method:'activate_profile',  params:['id'],  expect:{'':{}}, });

/* ── small helpers ─────────────────────────────────────────────────────────── */

function val(id) {
  var el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function setVal(id, v) {
  var el = document.getElementById(id);
  if (el) el.value = v || '';
}

function inp(id, label, placeholder, hint) {
  return E('div', { class:'cbi-value' }, [
    E('label', { class:'cbi-value-title', for:id }, label),
    E('div',   { class:'cbi-value-field' }, [
      E('input', { id:id, class:'cbi-input-text', type:'text',
        style:'width:100%;max-width:400px', placeholder:placeholder }),
      hint ? E('div', { class:'cbi-value-description' }, hint) : null
    ].filter(Boolean))
  ]);
}

/* ── view ──────────────────────────────────────────────────────────────────── */

return view.extend({

  _editing: null,   /* profile id being edited, or 'new' */

  load: function() {
    return Promise.all([ callStatus(), callList() ]);
  },

  /* ── status card ────────────────────────────────────────────────────────── */

  renderStatus: function(status) {
    var self    = this;
    var running = !!status.running;

    return E('div', { class:'cbi-section' }, [
      E('legend', {}, 'Status'),
      E('div', { class:'cbi-section-node' }, [

        E('div', { style:'display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:16px' }, [
          E('span', {
            id:'xray-badge',
            class:'label ' + (running ? 'success' : 'danger'),
            style:'font-size:1em;padding:5px 14px'
          }, running ? '● ACTIVE' : '○ DISABLED'),
          status.active_name
            ? E('span', { style:'color:#888;font-size:.9em' }, 'Profile: ' + status.active_name)
            : (!status.has_profiles
                ? E('span', { style:'color:#e74c3c;font-size:.9em' }, 'No profiles configured')
                : E('span', { style:'color:#e74c3c;font-size:.9em' }, 'No profile active'))
        ]),

        E('table', { class:'table', style:'margin-bottom:16px' }, [
          E('tr', { class:'tr' }, [
            E('td', { class:'td left', style:'width:180px;font-weight:600' }, 'Transparent Proxy'),
            E('td', { class:'td' }, E('span', { id:'xray-tproxy' },
              status.tproxy ? 'Active — all LAN clients proxied' : 'Inactive'))
          ]),
          E('tr', { class:'tr' }, [
            E('td', { class:'td left', style:'font-weight:600' }, 'Exit IP'),
            E('td', { class:'td' }, E('code', { id:'xray-exitip' }, running ? 'checking…' : '—'))
          ]),
          E('tr', { class:'tr' }, [
            E('td', { class:'td left', style:'font-weight:600' }, 'SOCKS5'),
            E('td', { class:'td' }, E('code', {}, '127.0.0.1 : 1080'))
          ])
        ]),

        E('div', { style:'display:flex;gap:10px;flex-wrap:wrap' }, [
          E('button', {
            id:'xray-btn-enable',
            class:'btn cbi-button cbi-button-apply',
            disabled: running || !status.has_profiles,
            click: ui.createHandlerFn(this, 'handleEnable')
          }, 'Enable'),
          E('button', {
            id:'xray-btn-disable',
            class:'btn cbi-button cbi-button-reset',
            disabled: !running,
            click: ui.createHandlerFn(this, 'handleDisable')
          }, 'Disable'),
          E('button', {
            class:'btn cbi-button',
            click: ui.createHandlerFn(this, 'handleRefresh')
          }, '↻ Refresh')
        ])

      ])
    ]);
  },

  /* ── profile table ──────────────────────────────────────────────────────── */

  renderProfileTable: function(profiles, activeId) {
    var self = this;
    var rows = profiles.map(function(p) {
      var isActive = (p.id === activeId);
      return E('tr', { class:'tr' }, [
        E('td', { class:'td left' }, [
          isActive ? E('span', { style:'color:#27ae60;margin-right:6px' }, '★') : null,
          E('strong', {}, p.name)
        ]),
        E('td', { class:'td' }, p.address + ' : ' + p.port),
        E('td', { class:'td' }, [
          isActive
            ? E('span', { class:'label success', style:'font-size:.78em;padding:2px 8px' }, 'ACTIVE')
            : E('button', {
                class:'btn cbi-button cbi-button-apply',
                style:'padding:3px 10px;font-size:.85em',
                click: ui.createHandlerFn(self, 'handleActivate', p.id)
              }, 'Use')
        ]),
        E('td', { class:'td', style:'white-space:nowrap' }, [
          E('button', {
            class:'btn cbi-button',
            style:'padding:3px 10px;font-size:.85em;margin-right:4px',
            click: ui.createHandlerFn(self, 'handleEdit', p.id)
          }, 'Edit'),
          E('button', {
            class:'btn cbi-button cbi-button-negative',
            style:'padding:3px 10px;font-size:.85em',
            click: ui.createHandlerFn(self, 'handleDelete', p.id, p.name, isActive)
          }, 'Delete')
        ])
      ]);
    });

    return E('div', { class:'cbi-section' }, [
      E('legend', {}, 'Profiles'),
      E('div', { class:'cbi-section-node' }, [

        rows.length === 0
          ? E('p', { style:'color:#888' }, 'No profiles yet. Add one below.')
          : E('table', { class:'table' }, [
              E('tr', { class:'tr cbi-rowstyle-1' }, [
                E('th', { class:'th left' }, 'Name'),
                E('th', { class:'th' },      'Server'),
                E('th', { class:'th' },      ''),
                E('th', { class:'th' },      'Actions')
              ])
            ].concat(rows)),

        E('div', { style:'margin-top:12px' }, [
          E('button', {
            class:'btn cbi-button cbi-button-add',
            click: ui.createHandlerFn(this, 'handleNew')
          }, '+ Add Profile')
        ])

      ])
    ]);
  },

  /* ── edit / add form ────────────────────────────────────────────────────── */

  renderForm: function(profile) {
    var self    = this;
    var isNew   = !profile || !profile.id;
    var title   = isNew ? 'Add Profile' : 'Edit — ' + (profile.name || '');

    return E('div', { id:'xray-form-section', class:'cbi-section' }, [
      E('legend', {}, title),
      E('div', { class:'cbi-section-node' }, [

        inp('xf-name',    'Profile Name',    'e.g. US VPS (BandwagonHost)',
          'A friendly label — shown in the profile list'),
        inp('xf-addr',    'Server Address',  'vpn.example.com',
          'Domain or IP of your Xray server'),
        inp('xf-port',    'Port',            '443', null),
        inp('xf-uuid',    'UUID',            'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
          'Your client UUID from the server panel'),
        inp('xf-pubkey',  'Reality Public Key', 'base64-encoded key',
          'From your server\'s Reality configuration'),
        inp('xf-shortid', 'Short ID',        'hex string e.g. 9e060651',
          'From your server\'s Reality configuration'),
        inp('xf-sni',     'Server Name (SNI)', 'www.microsoft.com',
          'The domain the connection pretends to be'),
        inp('xf-fp',      'Fingerprint',     'chrome',
          'TLS fingerprint: chrome / firefox / safari / edge'),

        E('div', { class:'cbi-section', style:'margin-top:20px;padding:14px;background:#f9f9f9;border-radius:6px;border:1px solid #e0e0e0' }, [
          E('div', { style:'font-weight:600;font-size:13px;margin-bottom:12px;color:#444' }, ['Routing Rules']),
          inp('xf-direct-ip', 'Direct IP Rules', 'geoip:private, geoip:cn',
            'Comma-separated. geoip:XX = country IP database (built into Xray). ' +
            'geoip:private = RFC1918. geoip:cn = China. ' +
            'Custom CIDRs also accepted (e.g. 1.2.3.0/24). These destinations bypass the proxy.'),
          inp('xf-direct-dom', 'Direct Domain Rules', 'geosite:cn',
            'Comma-separated. geosite:XX = domain category database. ' +
            'geosite:cn = Chinese sites. geosite:geolocation-!cn = non-Chinese sites. ' +
            'Plain domains also accepted (e.g. example.com). These bypass the proxy.'),
        ]),

        E('div', { class:'cbi-value' }, [
          E('div', { class:'cbi-value-field' }, [
            E('div', { style:'display:flex;gap:10px;flex-wrap:wrap;align-items:center' }, [
              E('button', {
                id:'xf-btn-save',
                class:'btn cbi-button cbi-button-apply',
                click: ui.createHandlerFn(this, '_handleProfileSave', isNew ? null : profile.id)
              }, isNew ? 'Save Profile' : 'Save Changes'),
              E('button', {
                class:'btn cbi-button',
                click: ui.createHandlerFn(this, 'handleCancelEdit')
              }, 'Cancel'),
              E('span', { id:'xf-msg', style:'color:#888;font-size:.9em' }, '')
            ])
          ])
        ])

      ])
    ]);
  },

  _fillForm: function(p) {
    setVal('xf-name',       p.name          || '');
    setVal('xf-addr',       p.address       || '');
    setVal('xf-port',       p.port          || '443');
    setVal('xf-uuid',       p.uuid          || '');
    setVal('xf-pubkey',     p.public_key    || '');
    setVal('xf-shortid',    p.short_id      || '');
    setVal('xf-sni',        p.server_name   || 'www.microsoft.com');
    setVal('xf-fp',         p.fingerprint   || 'chrome');
    setVal('xf-direct-ip',  p.direct_ip     || 'geoip:private,geoip:cn');
    setVal('xf-direct-dom', p.direct_domain || 'geosite:cn');
  },

  /* ── action handlers ────────────────────────────────────────────────────── */

  handleEnable: function() {
    var self = this;
    var btn  = document.getElementById('xray-btn-enable');
    if (btn) { btn.disabled = true; btn.textContent = 'Enabling…'; }
    return callEnable().then(function(r) {
      if (r && r.error) {
        ui.addNotification(null, E('p', r.error), 'danger');
        if (btn) { btn.disabled = false; btn.textContent = 'Enable'; }
      } else {
        return self.refreshStatus();
      }
    });
  },

  handleDisable: function() {
    var self = this;
    var btn  = document.getElementById('xray-btn-disable');
    if (btn) { btn.disabled = true; btn.textContent = 'Disabling…'; }
    return callDisable().then(function() { return self.refreshStatus(); });
  },

  handleRefresh: function() {
    return this.refreshStatus();
  },

  handleNew: function() {
    this._editing = 'new';
    var existing = document.getElementById('xray-form-section');
    if (existing) existing.parentNode.removeChild(existing);
    var form = this.renderForm(null);
    document.getElementById('xray-profile-anchor').appendChild(form);
    setVal('xf-port',       '443');
    setVal('xf-sni',        'www.microsoft.com');
    setVal('xf-fp',         'chrome');
    setVal('xf-direct-ip',  'geoip:private,geoip:cn');
    setVal('xf-direct-dom', 'geosite:cn');
    document.getElementById('xf-name') && document.getElementById('xf-name').focus();
  },

  handleEdit: function(id) {
    var self = this;
    this._editing = id;
    return callGet(id).then(function(p) {
      if (p && p.error) { ui.addNotification(null, E('p', p.error), 'danger'); return; }
      var existing = document.getElementById('xray-form-section');
      if (existing) existing.parentNode.removeChild(existing);
      p.id = id;
      var form = self.renderForm(p);
      document.getElementById('xray-profile-anchor').appendChild(form);
      self._fillForm(p);
    });
  },

  handleCancelEdit: function() {
    this._editing = null;
    var existing = document.getElementById('xray-form-section');
    if (existing) existing.parentNode.removeChild(existing);
  },

  _handleProfileSave: function(existingId) {
    var btn  = document.getElementById('xf-btn-save');
    var msg  = document.getElementById('xf-msg');
    var name = val('xf-name'), addr = val('xf-addr'),
        uuid = val('xf-uuid'), pk   = val('xf-pubkey'), sid = val('xf-shortid');

    if (!name || !addr || !uuid || !pk || !sid) {
      ui.addNotification(null, E('p', 'Name, Address, UUID, Public Key and Short ID are required.'), 'danger');
      return;
    }

    var port   = parseInt(val('xf-port')) || 443;
    var sni    = val('xf-sni')        || 'www.microsoft.com';
    var fp     = val('xf-fp')         || 'chrome';
    var dirIp  = val('xf-direct-ip')  || 'geoip:private,geoip:cn';
    var dirDom = val('xf-direct-dom') || 'geosite:cn';

    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    if (msg) { msg.textContent = ''; }

    var self = this;
    return callSave(existingId || '', name, addr, port, uuid, pk, sid, sni, fp, dirIp, dirDom).then(function(r) {
      if (r && r.error) {
        ui.addNotification(null, E('p', r.error), 'danger');
        if (btn) { btn.disabled = false; btn.textContent = existingId ? 'Save Changes' : 'Save Profile'; }
      } else {
        if (msg) msg.textContent = 'Saved — refreshing…';
        setTimeout(function() { window.location.reload(); }, 600);
      }
    }).catch(function(e) {
      ui.addNotification(null, E('p', String(e)), 'danger');
      if (btn) { btn.disabled = false; btn.textContent = existingId ? 'Save Changes' : 'Save Profile'; }
    });
  },

  handleDelete: function(id, name, isActive) {
    if (!window.confirm(
      (isActive ? '⚠ This is the active profile — Xray will stop working after deletion.\n\n' : '') +
      'Delete profile "' + name + '"?'
    )) return;
    return callDelete(id).then(function(r) {
      if (r && r.error) { ui.addNotification(null, E('p', r.error), 'danger'); return; }
      window.location.reload();
    });
  },

  handleActivate: function(id) {
    var self = this;
    /* find the Use button for this row and show progress */
    var btns = document.querySelectorAll('button');
    var useBtn = null;
    for (var i = 0; i < btns.length; i++) {
      if (btns[i].textContent === 'Use' && btns[i].onclick) { useBtn = btns[i]; break; }
    }
    if (useBtn) { useBtn.disabled = true; useBtn.textContent = 'Switching…'; }

    return callActivate(id).then(function(r) {
      if (r && r.error) {
        ui.addNotification(null, E('p', r.error), 'danger');
        if (useBtn) { useBtn.disabled = false; useBtn.textContent = 'Use'; }
        return;
      }
      if (r && r.restarted) {
        ui.addNotification(null, E('p', 'Profile switched and Xray restarted with new config.'), 'success');
      }
      window.location.reload();
    });
  },

  /* ── live status refresh (no full reload) ───────────────────────────────── */

  refreshStatus: function() {
    return callStatus().then(function(s) {
      var running = !!s.running;

      var badge = document.getElementById('xray-badge');
      if (badge) {
        badge.textContent = running ? '● ACTIVE' : '○ DISABLED';
        badge.className   = 'label ' + (running ? 'success' : 'danger');
      }
      var tpEl = document.getElementById('xray-tproxy');
      if (tpEl) tpEl.textContent = s.tproxy ? 'Active — all LAN clients proxied' : 'Inactive';

      var btnEn  = document.getElementById('xray-btn-enable');
      var btnDis = document.getElementById('xray-btn-disable');
      if (btnEn)  { btnEn.disabled  = running || !s.has_profiles; btnEn.textContent  = 'Enable'; }
      if (btnDis) { btnDis.disabled = !running;                   btnDis.textContent = 'Disable'; }

      var ipEl = document.getElementById('xray-exitip');
      if (ipEl) {
        if (running) {
          ipEl.textContent = 'checking…';
          callExitIP().then(function(r) {
            if (ipEl) ipEl.textContent = (r && r.ip) ? r.ip : '—';
          });
        } else {
          ipEl.textContent = '—';
        }
      }
    });
  },

  /* ── top-level render ───────────────────────────────────────────────────── */

  render: function(data) {
    var self     = this;
    var status   = data[0] || {};
    var profiles = (data[1] && data[1].profiles) ? data[1].profiles : [];
    var activeId = status.active_profile || '';

    var view = E('div', { class:'cbi-map' }, [
      E('h2', { class:'cbi-map-title' }, 'Xray VPN'),
      E('div', { class:'cbi-map-descr' }, 'VLESS + XTLS-Reality multi-profile manager'),

      this.renderStatus(status),
      this.renderProfileTable(profiles, activeId),

      /* anchor where the edit form is appended dynamically */
      E('div', { id:'xray-profile-anchor' })
    ]);

    /* fetch exit IP once on load if running */
    if (status.running) {
      callExitIP().then(function(r) {
        var el = document.getElementById('xray-exitip');
        if (el) el.textContent = (r && r.ip) ? r.ip : '—';
      });
    }

    /* poll status every 30s */
    poll.add(function() { return self.refreshStatus(); }, 30);

    return view;
  },

  handleSaveApply: null,
  handleSave:      null,
  handleReset:     null
});
