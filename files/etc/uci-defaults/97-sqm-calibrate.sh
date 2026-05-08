#!/bin/sh
# Initialize SQM calibration UCI defaults (only if section missing)
uci -q get sqm.calibrate >/dev/null 2>&1 || {
    uci set sqm.calibrate=calibrate
    uci set sqm.calibrate.enabled=1
    uci set sqm.calibrate.iface=eth0
    uci set sqm.calibrate.scale=90
    uci set sqm.calibrate.test_secs=12
    uci set sqm.calibrate.floor_kbps=5000
    uci set sqm.calibrate.nightly_hour=3
    uci commit sqm
}
