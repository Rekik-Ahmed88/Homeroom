#!/bin/bash
# Environment for Tauri Android builds. Source it first:
#   source scripts/android-env.sh && npm run android:apk
# Uses ~/Android/Sdk when present, else ANDROID_HOME/ANDROID_SDK_ROOT.
set -e

if [ -z "${JAVA_HOME:-}" ] || [ ! -x "$JAVA_HOME/bin/java" ]; then
  # Prefer a Gradle-compatible JDK (Gradle 9.6 supports up to Java 26).
  unset JAVA_HOME
  for candidate in "$HOME/Android/jdk-21" "$HOME/Android/jdk-17" /usr/lib/jvm/default /usr/lib/jvm/java-21-openjdk /usr/lib/jvm/java-17-openjdk /usr/lib/jvm/java-27-openjdk; do
    if [ -x "$candidate/bin/java" ]; then
      export JAVA_HOME="$candidate"
      break
    fi
  done
fi

if [ -d "$HOME/Android/Sdk" ]; then
  export ANDROID_HOME="$HOME/Android/Sdk"
  export ANDROID_SDK_ROOT="$HOME/Android/Sdk"
elif [ -n "${ANDROID_SDK_ROOT:-}" ]; then
  export ANDROID_HOME="$ANDROID_SDK_ROOT"
elif [ -n "${ANDROID_HOME:-}" ]; then
  export ANDROID_SDK_ROOT="$ANDROID_HOME"
fi

# Newest installed NDK (versioned dir), else a legacy unversioned ndk dir.
# The Tauri CLI reads NDK_HOME (not ANDROID_NDK_HOME), so export both.
if [ -d "$ANDROID_HOME/ndk" ]; then
  newest="$(ls -1 "$ANDROID_HOME/ndk" 2>/dev/null | sort -V | tail -1)"
  if [ -n "$newest" ] && [ -d "$ANDROID_HOME/ndk/$newest" ]; then
    export ANDROID_NDK_HOME="$ANDROID_HOME/ndk/$newest"
    export NDK_HOME="$ANDROID_NDK_HOME"
    echo "found ndk at $ANDROID_NDK_HOME"
  fi
fi

# Pin the Rust compiler explicitly. The Tauri CLI rewrites PATH for its
# cargo subprocesses, which can push a system rustc (without Android targets)
# ahead of rustup's — cargo resolves bare `rustc` via PATH and then fails
# with E0463 (can't find crate for `std`). An absolute RUSTC bypasses that.
if [ -z "${RUSTC:-}" ] && command -v rustup >/dev/null; then
  RUSTC="$(rustup which rustc 2>/dev/null || true)"
  [ -n "$RUSTC" ] && export RUSTC
fi

command -v java >/dev/null || { echo "android-env: no java found (set JAVA_HOME)"; exit 1; }
[ -d "${ANDROID_HOME:-}" ] || { echo "android-env: no SDK found (set ANDROID_HOME)"; exit 1; }
[ -d "${ANDROID_NDK_HOME:-}" ] || { echo "android-env: no NDK found under $ANDROID_HOME/ndk"; exit 1; }
