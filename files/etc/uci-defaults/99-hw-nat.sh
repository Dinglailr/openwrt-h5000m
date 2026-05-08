#!/bin/sh
# Enable hardware flow offloading on first boot (Filogic 880 / MT7988).
# Software offload is the fallback; hw offload uses the NPE for line-rate NAT.
uci set firewall.@defaults[0].flow_offloading=1
uci set firewall.@defaults[0].flow_offloading_hw=1
uci commit firewall
exit 0
