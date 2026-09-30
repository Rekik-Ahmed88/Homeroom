#!/bin/bash
# Patches the generated Android manifest after a fresh `tauri android init`.
# The scaffold has no CAMERA permission and the barcode-scanner plugin does
# not inject one itself — without it the camera view crashes on open.
# Idempotent: safe to run on an already-patched manifest.
set -e

MANIFEST="src-tauri/gen/android/app/src/main/AndroidManifest.xml"
[ -f "$MANIFEST" ] || { echo "patch-android-manifest: $MANIFEST not found (run 'tauri android init' first)"; exit 1; }

if ! grep -q "android.permission.CAMERA" "$MANIFEST"; then
  sed -i 's|<uses-permission android:name="android.permission.INTERNET" />|<uses-permission android:name="android.permission.INTERNET" />\n    <!-- QR pairing (barcode-scanner plugin) -->\n    <uses-permission android:name="android.permission.CAMERA" />|' "$MANIFEST"
  echo "patch-android-manifest: added CAMERA permission"
else
  echo "patch-android-manifest: CAMERA permission already present"
fi
