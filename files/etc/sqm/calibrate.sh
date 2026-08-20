#!/bin/sh
# Hiveton H5000M - Speed Auto-Calibration Script (Multi-Interface Aware)

IFACE="$1"
[ -z "$IFACE" ] && { echo "Usage: $0 <interface>"; exit 1; }

# Find the SQM section matching this interface
SQM_SECTION=$(uci -q show sqm | grep ".interface='$IFACE'" | cut -d. -f2 | head -1)
[ -z "$SQM_SECTION" ] && SQM_SECTION=$(echo "$IFACE" | tr -c 'a-zA-Z0-9_' '_')

# Parameters read from the specific SQM section with prefixes
TEST_SECS=$(uci -q get sqm.${SQM_SECTION}.cal_test_secs || echo 12)
FLOOR_KBPS=$(uci -q get sqm.${SQM_SECTION}.cal_floor_kbps || echo 5000)
SCALE=$(uci -q get sqm.${SQM_SECTION}.cal_scale || echo 90)

DL_URLS="
http://ipv4.download.thinkbroadband.com/100MB.zip
http://speedtest.tele2.net/100MB.zip
https://speed.hetzner.de/100MB.bin
http://bouygues.testdebit.info/100M.iso
http://speedtest.ftp.otenet.gr/files/test100Mb.db
"

UL_URLS="
https://httpbin.org/post
https://postman-echo.com/post
"

log() { logger -t sqm-calibrate "[$IFACE] $*"; }
rx_bytes() { cat /sys/class/net/$IFACE/statistics/rx_bytes 2>/dev/null || echo 0; }
tx_bytes() { cat /sys/class/net/$IFACE/statistics/tx_bytes 2>/dev/null || echo 0; }
to_kbps() { echo $(( $1 * 8 / $2 / 1000 )); }

# Pause modem monitoring during test
/etc/init.d/rpcd stop
measure_download() {
    local pids="" url before after elapsed
    before=$(rx_bytes)
    local t0=$(date +%s)
    for url in $DL_URLS; do
        curl -s -o /dev/null --max-time $TEST_SECS "$url" &
        pids="$pids $!"
    done
    sleep $TEST_SECS
    kill $pids 2>/dev/null; wait $pids 2>/dev/null
    after=$(rx_bytes)
    elapsed=$(( $(date +%s) - t0 ))
    [ "$elapsed" -lt 1 ] && elapsed=1
    to_kbps $(( after - before )) $elapsed
}

measure_upload() {
    local best=0 url before after elapsed kbps
    for url in $UL_URLS; do
        before=$(tx_bytes)
        local t0=$(date +%s)
        dd if=/dev/urandom bs=1M count=$(( TEST_SECS * 15 )) 2>/dev/null | \
          curl -s -o /dev/null --max-time $TEST_SECS \
               -X POST --data-binary @- "$url" &
        local cpid=$!
        sleep $TEST_SECS
        kill $cpid 2>/dev/null; wait $cpid 2>/dev/null
        after=$(tx_bytes)
        elapsed=$(( $(date +%s) - t0 ))
        [ "$elapsed" -lt 1 ] && elapsed=1
        kbps=$(to_kbps $(( after - before )) $elapsed)
        [ "$kbps" -gt "$best" ] && best=$kbps
        [ "$best" -gt "$FLOOR_KBPS" ] && break
    done
    echo $best
}

apply() {
# Resume modem monitoring
/etc/init.d/rpcd start
    local dl_kbps=$1 ul_kbps=$2
    [ "$dl_kbps" -lt "$FLOOR_KBPS" ] && { log "Download ${dl_kbps}kbps below floor, skipping"; return 1; }
    [ "$ul_kbps" -lt "$FLOOR_KBPS" ] && { log "Upload ${ul_kbps}kbps below floor, skipping"; return 1; }
    
    local dl_set=$(( dl_kbps * SCALE / 100 ))
    local ul_set=$(( ul_kbps * SCALE / 100 ))
    
    uci set sqm.${SQM_SECTION}=queue
    uci set sqm.${SQM_SECTION}.interface="$IFACE"
    uci set sqm.${SQM_SECTION}.enabled="1"
    uci set sqm.${SQM_SECTION}.download="$dl_set"
    uci set sqm.${SQM_SECTION}.upload="$ul_set"
    uci commit sqm
    
    /etc/init.d/sqm restart >/dev/null 2>&1
    log "Calibration Success: down=${dl_set}kbps, up=${ul_set}kbps"
    echo "$dl_set $ul_set" > "/var/run/sqm-calibrated-$IFACE"
}

log "Starting calibration"
# Pause modem monitoring during test
/etc/init.d/rpcd stop
DL=$(measure_download)
UL=$(measure_upload)
log "Raw results: download=${DL}kbps upload=${UL}kbps"
apply "$DL" "$UL"
# Resume modem monitoring
/etc/init.d/rpcd start
