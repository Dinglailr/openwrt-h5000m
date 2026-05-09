#!/bin/bash
set -e

cd /openwrt
# staging_dir/host + build_dir/host are rsync-excluded so they hold only
# container-built native binaries — preserve them to skip tool rebuilds.
# Only wipe kconfig tools (must be rebuilt fresh each run).
rm -f scripts/config/mconf scripts/config/conf
find scripts/config -name "*.o" -delete 2>/dev/null || true

# Clean untracked files in all feeds that can block git pull
find feeds -name "*.po" -not -path "*/\.git/*" -delete 2>/dev/null || true
for feed in luci packages routing telephony video; do
    git -C "feeds/$feed" clean -fd -q 2>/dev/null || true
done

./scripts/feeds update -a
./scripts/feeds install -a

# Allow arm64 host in Go bootstrap Makefile (robust: only patches if arm64 not already present)
GO_BOOTSTRAP_MK="feeds/packages/lang/golang/golang-bootstrap/Makefile"
if grep -q "linux/arm64" "$GO_BOOTSTRAP_MK" 2>/dev/null; then
    echo "Go bootstrap arm64 already present — skipping patch"
else
    sed -i 's/linux\/amd64 \\/linux\/amd64 \\\n  linux\/arm64 \\/' "$GO_BOOTSTRAP_MK" \
        && echo "Go bootstrap arm64 patch applied" \
        || { echo "ERROR: Go bootstrap patch failed — check $GO_BOOTSTRAP_MK"; exit 1; }
fi

# Fix for Go bootstrap failure natively on arm64:
echo "CONFIG_GOLANG_EXTERNAL_BOOTSTRAP_ROOT=\"/usr/lib/go\"" >> .config

# Required for APK version validation — avoids base-files-~unknown APK error
echo "r28161-0" > /openwrt/version

# Pre-flight Disk Space Check (Requires at least 10GB free in the Docker VM)
FREE_SPACE=$(df -BG /openwrt | awk 'NR==2 {print $4}' | sed 's/G//')
if [ "$FREE_SPACE" -lt 10 ]; then
    echo "❌ ERROR: Not enough disk space in Docker VM! Only ${FREE_SPACE}GB available."
    echo "Please run 'docker system prune' or increase your Docker Desktop virtual disk limit."
    exit 1
fi

# .config synced from host — expand defaults without clobbering package choices.
make HOSTCC=gcc HOSTCXX=g++ defconfig
# defconfig strips these hidden/overridden options — force them back
echo "CONFIG_TARGET_PER_DEVICE_ROOTFS=y" >> .config
sed -i 's/CONFIG_GOLANG_EXTERNAL_BOOTSTRAP_ROOT=""/CONFIG_GOLANG_EXTERNAL_BOOTSTRAP_ROOT="\/usr\/lib\/go"/' .config

echo "✨ Starting compilation (Log: /openwrt/build.log)..."
# Pass REVISION explicitly — getver.sh can return 'unknown' when TOPDIR is unavailable in sub-shells
# -j(nproc): Native architecture means no Rosetta pipe crashes!
make -j$(nproc) REVISION=r28161-0 HOSTCC=gcc HOSTCXX=g++ V=s > /openwrt/build.log 2>&1
echo "✅ make finished successfully"
