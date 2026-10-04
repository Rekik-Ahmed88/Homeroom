#!/bin/bash
# Signs the unsigned release APK produced by `tauri android build` (release,
# i.e. without -d). Tauri ships unsigned release APKs by default; the release
# key is kept outside the repo at ~/.keystores and this completes the build
# the same way earlier release builds were signed.
#
# Usage: source scripts/android-env.sh && tauri android build -t aarch64 --apk
#        && bash scripts/sign-release-apk.sh
set -e
cd "$(dirname "$0")/.."

if [ -z "${ANDROID_HOME:-}" ]; then
  source scripts/android-env.sh
fi

# Newest installed build-tools' apksigner.
BUILD_TOOLS="$ANDROID_HOME/build-tools/$(ls -1 "$ANDROID_HOME"/build-tools/ 2>/dev/null | sort -V | tail -1)"
command -v apksigner >/dev/null 2>&1 || export PATH="$BUILD_TOOLS:$PATH"
APKSIGNER="$(command -v apksigner)" || { echo "sign-release-apk: apksigner not found (expected under $BUILD_TOOLS)"; exit 1; }

KEYSTORE="$HOME/.keystores/homeroom-2026.keystore"
PASSFILE="$HOME/.keystores/homeroom-2026.pass"
UNSIGNED="src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk"
OUT="artifacts/Homeroom-arm64-release.apk"

[ -f "$KEYSTORE" ] || { echo "sign-release-apk: keystore not found at $KEYSTORE"; exit 1; }
[ -f "$PASSFILE" ] || { echo "sign-release-apk: pass file not found at $PASSFILE"; exit 1; }
[ -f "$UNSIGNED" ] || { echo "sign-release-apk: unsigned APK not found at $UNSIGNED (run the release build first)"; exit 1; }

"$APKSIGNER" sign --ks "$KEYSTORE" --ks-pass "file:$PASSFILE" --ks-key-alias homeroom \
  --in "$UNSIGNED" --out "$OUT"
"$APKSIGNER" verify --verbose "$OUT"
echo "sign-release-apk: $OUT signed and verified"
