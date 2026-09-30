#!/bin/bash
# Prepares src-tauri/gen/android after a fresh `tauri android init`.
# The scaffold alone is not shippable:
#   1. icons — init leaves placeholder art; copy the real launcher set
#      (src-tauri/icons/android/res, byte-identical on every machine).
#   2. manifest — the barcode-scanner plugin needs the native CAMERA
#      permission or the camera view crashes on open.
#   3. gradle — play-services-mlkit-barcode-scanning:18.1.0 declares
#      vision-common:17.2.0 while its barcode-scanning-common:17.0.0 needs
#      vision-common:17.0.0; the mixed set breaks ML Kit init and crashes
#      the scanner with an NPE. Pin the tested pairing (strictly: a plain
#      constraint would still lose to the higher version).
# Idempotent: safe to re-run (CI runs it on every build).
set -e
cd "$(dirname "$0")/.."

GEN=src-tauri/gen/android/app/src/main/res
[ -d "src-tauri/gen/android" ] || { echo "prepare-android: no gen/android (run 'tauri android init' first)"; exit 1; }

cp -r src-tauri/icons/android/res/. "$GEN/"
echo "prepare-android: launcher icons copied"

bash scripts/patch-android-manifest.sh

# R8 runs on release builds (mapping.txt in outputs proves it) and the
# barcode-scanner plugin ships no ML Kit keep rules: R8 renames the
# reflectively-instantiated registrars and the scanner dies with an NPE on
# open. The app template already feeds every *.pro under app/ to R8, so
# append the keeps to the generated proguard-rules.pro (guarded: re-runs
# and template-owned content above are untouched).
PROGUARD=src-tauri/gen/android/app/proguard-rules.pro
[ -f "$PROGUARD" ] || { echo "prepare-android: $PROGUARD not found"; exit 1; }
if ! grep -q "com.google.mlkit" "$PROGUARD"; then
  cat >> "$PROGUARD" <<'EOF'

# QR scanner (barcode-scanner plugin + ML Kit, see scripts/prepare-android.sh).
-keep class com.google.mlkit.** { *; }
-keep class com.google.android.gms.vision.** { *; }
-keep class app.tauri.barcodescanner.** { *; }
EOF
  echo "prepare-android: added ML Kit keep rules"
else
  echo "prepare-android: ML Kit keep rules already present"
fi

# Deterministic versionCode from package.json (major*1000000 +
# minor*10000 + patch*100, e.g. 0.1.1 -> 10100). The CLI auto-increments
# a counter kept in gitignored gen/, so throwaway builds on different
# machines produce incomparable codes and Android rejects updates with
# INSTALL_FAILED_VERSION_DOWNGRADE. Deriving it from the app version keeps
# every release monotonically increasing everywhere, including CI.
VERSION="$(node -p "require('./package.json').version")"
MAJOR="${VERSION%%.*}"
REST="${VERSION#*.}"
MINOR="${REST%%.*}"
PATCH="${REST#*.}"
PATCH="${PATCH%%[^0-9]*}"
CODE=$((MAJOR * 1000000 + MINOR * 10000 + PATCH * 100))
PROPS=src-tauri/gen/android/app/tauri.properties
if [ -f "$PROPS" ] && grep -q "tauri.android.versionCode" "$PROPS"; then
  sed -i "s/^tauri.android.versionCode=.*/tauri.android.versionCode=$CODE/" "$PROPS"
else
  echo "tauri.android.versionCode=$CODE" >> "$PROPS"
fi
echo "prepare-android: versionCode=$CODE"

GRADLE=src-tauri/gen/android/app/build.gradle.kts
if ! grep -q 'strictly("17.0.0")' "$GRADLE"; then
  python3 - "$GRADLE" <<'EOF'
import sys
path = sys.argv[1]
src = open(path).read()
block = '''    // ML Kit alignment for the barcode scanner (see scripts/prepare-android.sh).
    constraints {
        implementation("com.google.mlkit:vision-common") {
            version {
                strictly("17.0.0")
            }
        }
    }
'''
marker = "dependencies {"
assert src.count(marker) == 1, "unexpected dependencies blocks"
open(path, "w").write(src.replace(marker, marker + "\n" + block, 1))
EOF
  echo "prepare-android: pinned vision-common to 17.0.0"
else
  echo "prepare-android: vision-common pin already present"
fi
