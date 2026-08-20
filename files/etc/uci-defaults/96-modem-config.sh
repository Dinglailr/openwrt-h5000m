#!/bin/sh
# Initialize modem UCI config (only if section missing)
uci -q get modem.config >/dev/null 2>&1 || {
    uci set modem.config=modem
    uci commit modem
}
