#!/bin/bash
set -e

echo "Building Homeroom AppImage..."

# Ensure appimagetool is extracted (bypasses FUSE 2 requirement)
APPDIR_TOOL="/tmp/squashfs-root/AppRun"
if [ ! -f "$APPDIR_TOOL" ]; then
  echo "Extracting appimagetool..."
  rm -rf /tmp/squashfs-root
  curl -L -o /tmp/appimagetool-x86_64.AppImage https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage
  chmod +x /tmp/appimagetool-x86_64.AppImage
  (cd /tmp && /tmp/appimagetool-x86_64.AppImage --appimage-extract > /dev/null)
  rm -f /tmp/appimagetool-x86_64.AppImage
fi

# Build the frontend (single config also used by `tauri build`)
echo "Building frontend..."
npm run build

# Build the Tauri binary
echo "Building Tauri binary..."
cd src-tauri
# The frontend is embedded by `tauri::generate_context!()` at compile time,
# but cargo only re-runs when src-tauri files change — not ../dist. Touch
# lib.rs so a frontend-only round always re-embeds the fresh dist/.
touch src/lib.rs
cargo build --release
cd ..

# Create AppDir structure
echo "Creating AppDir..."
APPDIR="src-tauri/target/release/Homeroom.AppDir"
rm -rf "$APPDIR"
mkdir -p "$APPDIR/usr/bin"
mkdir -p "$APPDIR/usr/lib"
mkdir -p "$APPDIR/usr/share/applications"
mkdir -p "$APPDIR/usr/share/icons/hicolor/128x128/apps"
mkdir -p "$APPDIR/usr/share/icons/hicolor/256x256/apps"

# Copy binary
cp src-tauri/target/release/homeroom "$APPDIR/usr/bin/"

# Copy icons
cp src-tauri/icons/128x128.png "$APPDIR/Homeroom.png"
cp src-tauri/icons/128x128.png "$APPDIR/usr/share/icons/hicolor/128x128/apps/Homeroom.png"
cp src-tauri/icons/128x128@2x.png "$APPDIR/usr/share/icons/hicolor/256x256/apps/Homeroom.png"

# Copy desktop entry
cat > "$APPDIR/Homeroom.desktop" << 'EOF'
[Desktop Entry]
Type=Application
Name=Homeroom
Comment=Student planner for timetable, homework, and attendance.
Exec=homeroom
Icon=Homeroom
StartupWMClass=homeroom
Categories=Education;
Terminal=false
EOF
cp "$APPDIR/Homeroom.desktop" "$APPDIR/usr/share/applications/"

# Create AppRun script
cat > "$APPDIR/AppRun" << 'EOF'
#!/bin/bash
SELF=$(readlink -f "$0")
HERE=${SELF%/*}
export LD_LIBRARY_PATH="${HERE}/usr/lib:${LD_LIBRARY_PATH}"
exec "${HERE}/usr/bin/homeroom" "$@"
EOF
chmod +x "$APPDIR/AppRun"

# Copy shared libraries
echo "Copying shared libraries..."
ldd "$APPDIR/usr/bin/homeroom" | grep "=> /" | awk '{print $3}' | while read lib; do
  cp "$lib" "$APPDIR/usr/lib/" 2>/dev/null || true
done

# Version follows package.json so releases stay in sync with the tag.
VERSION="$(node -p "require('./package.json').version")"

# Create AppImage using appimagetool (no FUSE 2 needed)
echo "Creating AppImage..."
ARCH=x86_64 "$APPDIR_TOOL" "$APPDIR" "src-tauri/target/release/Homeroom_${VERSION}_amd64.AppImage"

# Also pack a plain tarball for systems without FUSE 2 (AppImages need
# libfuse2 to execute; the tarball runs via ./AppRun with no FUSE at all).
echo "Creating tarball..."
tar -czf "src-tauri/target/release/Homeroom_${VERSION}_linux-x86_64.tar.gz" \
  -C "src-tauri/target/release" \
  --transform 's,^Homeroom.AppDir,Homeroom,' Homeroom.AppDir

echo "Done!"
echo "  AppImage: src-tauri/target/release/Homeroom_${VERSION}_amd64.AppImage (needs libfuse2 to run)"
echo "  Tarball:  src-tauri/target/release/Homeroom_${VERSION}_linux-x86_64.tar.gz (extract and run ./Homeroom/AppRun, no FUSE needed)"
