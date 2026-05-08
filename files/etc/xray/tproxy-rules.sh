#!/bin/sh
TPROXY_PORT=12345
TPROXY_MARK=0x1
TABLE=xray_tproxy
PRIVATE_RANGES="{ 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8, 100.64.0.0/10, 169.254.0.0/16, 224.0.0.0/4, 240.0.0.0/4 }"
CUSTOM_BYPASS=/etc/xray/custom-bypass

case "${1:-add}" in
  add)
    ip rule add fwmark $TPROXY_MARK table 100 prio 100 2>/dev/null || true
    ip route add local 0.0.0.0/0 dev lo table 100 2>/dev/null || true
    nft add table inet $TABLE 2>/dev/null || true

    # Named set populated from custom routing rules — bypasses TPROXY interception
    nft add set inet $TABLE bypass4 '{ type ipv4_addr; flags interval; }' 2>/dev/null || true
    nft flush set inet $TABLE bypass4 2>/dev/null || true
    [ -f "$CUSTOM_BYPASS" ] && while IFS= read -r cidr; do
      [ -n "$cidr" ] && nft add element inet $TABLE bypass4 "{ $cidr }" 2>/dev/null || true
    done < "$CUSTOM_BYPASS"

    nft add chain inet $TABLE prerouting '{ type filter hook prerouting priority mangle; policy accept; }' 2>/dev/null || true
    nft flush chain inet $TABLE prerouting 2>/dev/null || true
    nft add rule inet $TABLE prerouting \
      meta iifname "br-lan" meta l4proto tcp \
      ip daddr != $PRIVATE_RANGES ip daddr != @bypass4 \
      tproxy ip to :$TPROXY_PORT meta mark set $TPROXY_MARK
    nft add rule inet $TABLE prerouting \
      meta iifname "br-lan" meta l4proto udp \
      ip daddr != $PRIVATE_RANGES ip daddr != @bypass4 \
      tproxy ip to :$TPROXY_PORT meta mark set $TPROXY_MARK
    ;;
  del)
    ip rule del fwmark $TPROXY_MARK table 100 prio 100 2>/dev/null || true
    ip route del local 0.0.0.0/0 dev lo table 100 2>/dev/null || true
    nft delete table inet $TABLE 2>/dev/null || true
    ;;
esac
