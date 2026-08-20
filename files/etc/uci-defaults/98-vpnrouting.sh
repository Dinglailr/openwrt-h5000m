#!/bin/sh
[ -f /etc/config/vpnrouting ] || {
  cat > /etc/config/vpnrouting << 'EOF'
config routing 'routing'
	option mode 'split'
EOF
}
exit 0
