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
