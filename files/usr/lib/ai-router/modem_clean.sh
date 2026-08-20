#!/bin/sh
# Force-flush the modem port
PORT=$1
[ -c "$PORT" ] || exit 1
(cat "$PORT" > /dev/null 2>/dev/null & PID=$!; sleep 1; kill -9 $PID 2>/dev/null; wait $PID 2>/dev/null)
