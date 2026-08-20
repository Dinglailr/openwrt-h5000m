#!/bin/bash
# Hiveton H5000M - Nuclear Build Orchestrator
# Resolves: Mac case-insensitivity & RootFS Error 1

VOL_NAME="h5000m_native_vol"
CONT_NAME="h5000m_builder"
BUILDER_IMAGE="h5000m-builder:latest"
BASE_IMAGE="ubuntu:22.04"

echo "🚀 Starting Native (arm64) Nuclear Build for Hiveton H5000M..."

# 1. Build the environment image once — reused on every subsequent run
if ! docker image inspect $BUILDER_IMAGE >/dev/null 2>&1; then
    echo "🔨 Building builder image (one-time, will be cached)..."
    docker build -f Dockerfile.builder -t $BUILDER_IMAGE .
else
    echo "✅ Builder image already cached — skipping apt install"
fi

# 2. Create case-sensitive volume if it doesn't exist
if ! docker volume inspect $VOL_NAME >/dev/null 2>&1; then
    echo "📦 Creating case-sensitive Docker volume..."
    docker volume create $VOL_NAME
fi

# 3. Sync local changes to the volume (exclude Mac-compiled binaries at source)
echo "📂 Syncing local project to Docker volume..."
docker run --rm --user root \
  -v "$(pwd):/src" -v "$VOL_NAME:/dest" \
  $BUILDER_IMAGE bash -c "rsync -a \
    --exclude='*.o' \
    --exclude='*.a' \
    --exclude='*.so' \
    --exclude='staging_dir/host' \
    --exclude='staging_dir/toolchain*' \
    --exclude='build_dir' \
    --exclude='tmp' \
    --exclude='/feeds' \
    --exclude='/feeds.conf' \
    --exclude='package/feeds' \
    /src/ /dest/"

# 4. Wipe old image output so make always rebuilds the firmware image with latest files/
echo "🗑️  Clearing stale image output..."
docker run --rm --user root \
  -v "$VOL_NAME:/openwrt" \
  $BUILDER_IMAGE bash -c "
    rm -rf /openwrt/bin/targets/
    find /openwrt/build_dir -maxdepth 3 -name 'root-mediatek' -type d -exec rm -rf {} + 2>/dev/null || true
  "

# Kill any leftover container from a previous run
docker rm -f $CONT_NAME >/dev/null 2>&1 || true

# 5. Launch Build Container — exits cleanly when build is done so docker wait works
echo "🛠️ Launching builder and starting compilation..."
docker run -d --name $CONT_NAME \
    -v "$VOL_NAME:/openwrt" \
    --user root \
    $BUILDER_IMAGE bash -c "
    git config --global --add safe.directory '*'
    chmod +x /openwrt/build_inner.sh
    chown -R builduser:builduser /openwrt
    sudo -u builduser bash /openwrt/build_inner.sh \
        && echo SUCCESS > /openwrt/.build_status \
        || echo FAILED  > /openwrt/.build_status
    "

echo "📈 Monitor: docker logs -f $CONT_NAME  OR  docker exec $CONT_NAME tail -f /openwrt/build.log"

# 6. Wait for build, then extract firmware to ./firmware-out/
echo "⏳ Waiting for build to complete..."
docker wait $CONT_NAME >/dev/null

mkdir -p firmware-out
# Stale-artifact guard: remember when this run started, so a previous build's
# output can never be mistaken for this one's.
RUN_STARTED=$(date +%s)
BUILD_VERDICT=$(docker run --rm -v "$VOL_NAME:/openwrt" $BUILDER_IMAGE cat /openwrt/.build_status 2>/dev/null | tr -d '[:space:]')
docker run --rm --user root \
  -v "$VOL_NAME:/openwrt" \
  -v "$(pwd)/firmware-out:/out" \
  $BUILDER_IMAGE bash -c "cp /openwrt/bin/targets/mediatek/filogic/openwrt-mediatek-filogic-hiveton_h5000m-squashfs-sysupgrade.bin /out/ 2>/dev/null && echo 'COPY_OK' || echo 'COPY_FAIL'"

FW=firmware-out/openwrt-mediatek-filogic-hiveton_h5000m-squashfs-sysupgrade.bin
FW_MTIME=$(stat -f %m "$FW" 2>/dev/null || echo 0)
if [ "$BUILD_VERDICT" = "SUCCESS" ] && [ -f "$FW" ] && [ "$FW_MTIME" -ge "$RUN_STARTED" ]; then
    echo "🎉 SUCCESS! Firmware at: $(pwd)/firmware-out/openwrt-mediatek-filogic-hiveton_h5000m-squashfs-sysupgrade.bin"
    ls -lh firmware-out/openwrt-mediatek-filogic-hiveton_h5000m-squashfs-sysupgrade.bin
    osascript -e 'display notification "H5000M firmware ready in firmware-out/" with title "Build SUCCESS" sound name "Glass"' 2>/dev/null || true
else
    if [ "$BUILD_VERDICT" != "SUCCESS" ]; then
        echo "❌ BUILD FAILED (builder reported: ${BUILD_VERDICT:-no status})"
    elif [ "$FW_MTIME" -lt "$RUN_STARTED" ]; then
        echo "❌ BUILD FAILED — firmware-out/ holds only a STALE image from $(date -r "$FW_MTIME" '+%Y-%m-%d %H:%M'); this run produced nothing."
    fi
    echo "   top errors:"
    docker run --rm --user root -v "$VOL_NAME:/openwrt" $BUILDER_IMAGE \
        bash -c 'grep -E "^ERROR:|failed to build" /openwrt/build.log | tail -5' 2>/dev/null || true
    echo "Full log: docker run --rm -v $VOL_NAME:/openwrt $BUILDER_IMAGE tail -100 /openwrt/build.log"
    osascript -e 'display notification "Check build.log for errors" with title "Build FAILED" sound name "Basso"' 2>/dev/null || true
    exit 1
fi
